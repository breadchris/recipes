import type { Recipe, Thumbnail } from '../lib/types';

// Lambda response types
export interface LambdaTranscriptMetadata {
  title: string;
  description: string;
  duration: number;
  view_count: number;
  upload_date: string;
  channel: string;
  thumbnails: Array<{ url: string; width: number; height: number }>;
}

export interface LambdaTranscriptData {
  type: 'auto-generated' | 'manual';
  language: string;
  plainText: string;
  segments: TranscriptSegment[];
}

export interface LambdaTranscriptResponse {
  success: boolean;
  videoId: string;
  cached: boolean;
  s3Key?: string;
  message?: string;
  data?: {
    metadata: LambdaTranscriptMetadata;
    transcript: LambdaTranscriptData;
  };
}

export interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
}

export interface Transcript {
  segments: TranscriptSegment[];
  raw_vtt: string;
}

export interface ExtractedVideo {
  video_id: string;
  channel_id: string;
  channel_slug: string;
  video: {
    title: string;
    description: string;
    duration: number;
    view_count: number;
    upload_date: string;
    thumbnails: Thumbnail[];
  };
  channel: {
    name: string;
    follower_count: number;
    description: string;
    thumbnails: Thumbnail[];
  };
  recipes: Recipe[];
  transcript: Transcript | null;
}

export interface RunManifest {
  run_id: string;
  created_at: string;
  videos_processed: number;
  videos_with_recipes: number;
  videos_with_transcripts: number;
  source: string;
  upserted_to_supabase: boolean;
  upserted_at: string | null;
}

export interface PipelineConfig {
  cacheDir: string;
  recipesDir: string;
  pipelineDir: string;
  runsDir: string;
  youtubeCacheDir: string;
}
