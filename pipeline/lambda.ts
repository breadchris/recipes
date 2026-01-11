import {
  LambdaClient,
  InvokeCommand,
  InvocationType,
} from '@aws-sdk/client-lambda';
import {
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import type { LambdaTranscriptResponse } from './types';
import { config } from './config';

export interface LambdaExtractorConfig {
  functionName?: string;
  region?: string;
  bucketName?: string;
}

function ensureCacheDir() {
  if (!fs.existsSync(config.youtubeCacheDir)) {
    fs.mkdirSync(config.youtubeCacheDir, { recursive: true });
  }
}

export class LambdaExtractor {
  private lambdaClient: LambdaClient;
  private s3Client: S3Client;
  private functionName: string;
  private bucketName: string;

  constructor(extractorConfig: LambdaExtractorConfig = {}) {
    const region = extractorConfig.region ?? 'us-east-1';
    this.functionName = extractorConfig.functionName ?? 'youtube-extractor-dev';
    this.bucketName = extractorConfig.bucketName ?? 'recipes-youtube-cache-dev';

    this.lambdaClient = new LambdaClient({ region });
    this.s3Client = new S3Client({ region });

    ensureCacheDir();
  }

  /**
   * Invoke Lambda to extract video data synchronously.
   */
  async extractVideo(videoId: string, skipCache: boolean = false): Promise<LambdaTranscriptResponse> {
    const payload = {
      body: JSON.stringify({
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        options: { skipCache },
      }),
    };

    const command = new InvokeCommand({
      FunctionName: this.functionName,
      InvocationType: InvocationType.RequestResponse,
      Payload: Buffer.from(JSON.stringify(payload)),
    });

    const response = await this.lambdaClient.send(command);

    if (!response.Payload) {
      return {
        success: false,
        videoId,
        cached: false,
        message: 'No payload in Lambda response',
      };
    }

    const resultStr = Buffer.from(response.Payload).toString('utf-8');
    const result = JSON.parse(resultStr);
    const body = JSON.parse(result.body ?? '{}');

    return body as LambdaTranscriptResponse;
  }

  /**
   * Invoke Lambda asynchronously (fire and forget).
   */
  async extractVideoAsync(videoId: string): Promise<void> {
    const payload = {
      body: JSON.stringify({
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      }),
    };

    const command = new InvokeCommand({
      FunctionName: this.functionName,
      InvocationType: InvocationType.Event,
      Payload: Buffer.from(JSON.stringify(payload)),
    });

    await this.lambdaClient.send(command);
  }

  /**
   * Sync extracted videos from S3 to local cache.
   */
  async syncFromS3(videoIds: string[]): Promise<number> {
    let synced = 0;

    for (const videoId of videoIds) {
      const s3Key = `combined/${videoId}.json.gz`;
      const localPath = path.join(config.youtubeCacheDir, `${videoId}.json.gz`);

      try {
        const command = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
        });

        const response = await this.s3Client.send(command);

        if (response.Body) {
          const bodyBytes = await response.Body.transformToByteArray();
          fs.writeFileSync(localPath, Buffer.from(bodyBytes));
          synced++;
        }
      } catch {
        // File may not exist yet in S3
      }
    }

    return synced;
  }

  /**
   * Check if a video is already cached locally.
   */
  isLocalCached(videoId: string): boolean {
    const localPath = path.join(config.youtubeCacheDir, `${videoId}.json.gz`);
    return fs.existsSync(localPath);
  }
}
