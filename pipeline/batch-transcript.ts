#!/usr/bin/env npx tsx
/**
 * Batch fetch transcripts for videos from Supabase.
 *
 * This script fetches YouTube transcripts via Lambda for videos that don't have them,
 * then stores the transcript segments in Supabase.
 *
 * Usage:
 *   npm run pipeline:batch-transcript -- --channel LifeByMikeG
 *   npm run pipeline:batch-transcript -- --channel LifeByMikeG --parallel 5
 *   npm run pipeline:batch-transcript -- --channel LifeByMikeG --limit 10
 *   npm run pipeline:batch-transcript -- --channel LifeByMikeG --dry-run
 */

import fs from 'fs';
import path from 'path';
import { gunzipSync } from 'zlib';
import { parseArgs } from 'util';
import pLimit from 'p-limit';
import dotenv from 'dotenv';
import {
  getAllVideosForListing,
  saveTranscriptSegments,
  type VideoListItem,
} from '../lib/admin/data/supabase-io';
import { LambdaExtractor } from './lambda';
import { config } from './config';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

interface CachedVideoData {
  metadata?: {
    id: string;
    title: string;
    description?: string;
    duration?: number;
    channel?: string;
    channel_id?: string;
  };
  transcript?: {
    type: string;
    language: string;
    plainText: string;
    segments: Array<{ startTime: number; endTime: number; text: string }>;
  };
}

/**
 * Parse command line arguments
 */
function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      channel: { type: 'string', short: 'c' },
      limit: { type: 'string', short: 'l' },
      parallel: { type: 'string', short: 'p' },
      'dry-run': { type: 'boolean', short: 'd' },
      'skip-cache': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    console.log(`
Usage: npm run pipeline:batch-transcript -- [options]

Options:
  -c, --channel SLUG    Channel handle to process (required)
  -l, --limit N         Process only first N videos
  -p, --parallel N      Concurrent Lambda invocations (default: 3)
  -d, --dry-run         Show what would be processed without fetching
      --skip-cache      Force re-fetch even if cached in S3
  -h, --help            Show this help message

Examples:
  npm run pipeline:batch-transcript -- --channel LifeByMikeG
  npm run pipeline:batch-transcript -- --channel LifeByMikeG --parallel 5
  npm run pipeline:batch-transcript -- --channel LifeByMikeG --limit 10 --dry-run
`);
    process.exit(0);
  }

  if (!values.channel) {
    console.error('Error: --channel is required');
    process.exit(1);
  }

  return {
    channel: values.channel,
    limit: values.limit ? parseInt(values.limit, 10) : undefined,
    parallel: values.parallel ? parseInt(values.parallel, 10) : 3,
    dryRun: values['dry-run'] ?? false,
    skipCache: values['skip-cache'] ?? false,
  };
}

/**
 * Load transcript data from local cache file
 */
function loadCachedTranscript(videoId: string): CachedVideoData | null {
  const cachePath = path.join(config.youtubeCacheDir, `${videoId}.json.gz`);

  if (!fs.existsSync(cachePath)) {
    return null;
  }

  try {
    const compressed = fs.readFileSync(cachePath);
    return JSON.parse(gunzipSync(compressed).toString('utf-8'));
  } catch {
    return null;
  }
}

/**
 * Process a single video: fetch transcript via Lambda and save to Supabase
 */
async function processVideo(
  video: VideoListItem,
  extractor: LambdaExtractor,
  skipCache: boolean
): Promise<{ success: boolean; error?: string; segmentCount?: number }> {
  // Try to extract via Lambda
  const result = await extractor.extractVideo(video.video_id, skipCache);

  if (!result.success) {
    return { success: false, error: result.message || 'Lambda extraction failed' };
  }

  // Sync from S3 to local cache
  const synced = await extractor.syncFromS3([video.video_id]);

  if (synced === 0) {
    return { success: false, error: 'Failed to sync from S3' };
  }

  // Load the cached data
  const cachedData = loadCachedTranscript(video.video_id);

  if (!cachedData?.transcript?.segments) {
    return { success: false, error: 'No transcript segments in cached data' };
  }

  // Save transcript segments to Supabase
  await saveTranscriptSegments(
    video.video_id,
    cachedData.transcript.segments,
    cachedData.transcript.plainText
  );

  return {
    success: true,
    segmentCount: cachedData.transcript.segments.length,
  };
}

/**
 * Main function
 */
async function main() {
  const args = parseCliArgs();

  console.log('Batch Transcript Fetch Pipeline (Supabase)');
  console.log('='.repeat(50));
  console.log(`Channel: ${args.channel}`);
  console.log(`Parallel workers: ${args.parallel}`);
  if (args.limit) console.log(`Limit: ${args.limit} videos`);
  if (args.skipCache) console.log('Skip cache: enabled (force re-fetch)');
  if (args.dryRun) console.log('DRY RUN - no transcripts will be fetched');
  console.log();

  // Fetch all videos from Supabase
  console.log('Fetching videos from Supabase...');
  const allVideos = await getAllVideosForListing();
  console.log(`Total videos in database: ${allVideos.length}`);

  // Filter by channel (case-insensitive match)
  let videos = allVideos.filter((v) => {
    const channelName = v.channel_name?.toLowerCase() || '';
    const channelMatch = args.channel.toLowerCase();
    return channelName.includes(channelMatch);
  });
  console.log(`Videos from channel "${args.channel}": ${videos.length}`);

  // Filter to videos WITHOUT transcripts
  const beforeFilter = videos.length;
  videos = videos.filter((v) => !v.has_transcript);
  console.log(`Videos without transcripts: ${videos.length} (${beforeFilter - videos.length} already have transcripts)`);

  // Apply limit
  if (args.limit && videos.length > args.limit) {
    videos = videos.slice(0, args.limit);
    console.log(`After limit: ${videos.length} videos`);
  }

  console.log();

  if (videos.length === 0) {
    console.log('No videos to process.');
    return;
  }

  if (args.dryRun) {
    console.log('Videos that would be processed:');
    for (const video of videos) {
      console.log(`  ${video.video_id} | ${video.title}`);
    }
    console.log();
    console.log(`Total: ${videos.length} videos would be processed`);
    return;
  }

  // Process videos with parallel workers
  const extractor = new LambdaExtractor();
  const limit = pLimit(args.parallel);

  let processed = 0;
  let success = 0;
  let errors = 0;
  const errorDetails: { videoId: string; title: string; error: string }[] = [];

  console.log(`Processing ${videos.length} videos with ${args.parallel} parallel workers...`);
  console.log();

  await Promise.all(
    videos.map((video) =>
      limit(async () => {
        const index = ++processed;
        console.log(`[${index}/${videos.length}] Processing ${video.video_id}...`);
        console.log(`  Title: ${video.title}`);

        try {
          const result = await processVideo(video, extractor, args.skipCache);

          if (result.success) {
            console.log(`  Success: ${result.segmentCount} segments saved to Supabase`);
            success++;
          } else {
            console.log(`  Error: ${result.error}`);
            errors++;
            errorDetails.push({
              videoId: video.video_id,
              title: video.title,
              error: result.error || 'Unknown error',
            });
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.log(`  Error: ${errorMessage}`);
          errors++;
          errorDetails.push({
            videoId: video.video_id,
            title: video.title,
            error: errorMessage,
          });
        }
      })
    )
  );

  console.log();
  console.log('='.repeat(50));
  console.log(`Processed: ${processed}`);
  console.log(`Success: ${success}`);
  console.log(`Errors: ${errors}`);

  if (errorDetails.length > 0) {
    console.log();
    console.log('Error details:');
    for (const err of errorDetails) {
      console.log(`  ${err.videoId} | ${err.title}`);
      console.log(`    Error: ${err.error}`);
    }
  }

  if (success > 0) {
    console.log();
    console.log('Next step: Run batch-generate to create recipes for these videos:');
    console.log(`  npm run pipeline:batch-generate -- --channel ${args.channel} --skip-existing`);
  }
}

main().catch(console.error);
