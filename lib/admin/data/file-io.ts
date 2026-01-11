/**
 * File I/O utilities for reading/writing gzip-compressed cache files
 * for the admin panel.
 */
import { readFile, writeFile, readdir } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { gunzipSync } from 'zlib';

// Cache directory paths relative to project root
// Data is in /data/youtube-cache
const getCacheDir = () => join(process.cwd(), 'data', 'youtube-cache');
const getRecipesDir = () => join(getCacheDir(), 'recipes');
const getPipelineDir = () => join(process.cwd(), 'data', 'pipeline');

/**
 * Get the cache directory path
 */
export function cacheDir(): string {
  return getCacheDir();
}

/**
 * Get the recipes directory path
 */
export function recipesDir(): string {
  return getRecipesDir();
}

/**
 * Ensure recipes directory exists
 */
export function ensureRecipesDir(): void {
  const dir = getRecipesDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Video metadata structure (from cached .json.gz files)
 */
export interface VideoMetadata {
  id: string;
  fulltitle: string;
  title?: string;
  description: string;
  webpage_url: string;
  upload_date: string;
  duration: number;
  channel?: string;
  channel_id?: string;
  thumbnails?: { url: string; width?: number; height?: number }[];
}

/**
 * Get list of all transcript VTT files (video IDs)
 */
export async function getTranscriptFiles(): Promise<string[]> {
  const cacheDirectory = getCacheDir();

  if (!existsSync(cacheDirectory)) {
    return [];
  }

  const files = await readdir(cacheDirectory);
  const videoIds: string[] = [];

  for (const filename of files) {
    if (filename.endsWith('.vtt.gz')) {
      const videoId = filename.replace('.vtt.gz', '');
      videoIds.push(videoId);
    }
  }

  return videoIds.sort();
}

/**
 * Load video metadata from cache
 * Handles both old format (metadata at root) and new Lambda format (metadata nested under .metadata)
 */
export async function loadVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
  const metadataFile = join(getCacheDir(), `${videoId}.json.gz`);

  if (!existsSync(metadataFile)) {
    return null;
  }

  try {
    const compressed = await readFile(metadataFile);
    const decompressed = gunzipSync(compressed);
    const data = JSON.parse(decompressed.toString('utf-8'));

    // Handle new Lambda format: { metadata: {...}, transcript: {...} }
    if (data.metadata && typeof data.metadata === 'object') {
      return data.metadata as VideoMetadata;
    }

    // Old format: metadata fields directly at root
    return data as VideoMetadata;
  } catch (error) {
    console.error(`Error loading metadata for ${videoId}:`, error);
    return null;
  }
}

/**
 * Format seconds to [MM:SS] or [H:MM:SS] timestamp format
 */
function formatTimestampForAI(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `[${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
  }
  return `[${mins}:${secs.toString().padStart(2, '0')}]`;
}

/**
 * Load raw VTT content from cache
 * Handles both .vtt.gz files and Lambda format with embedded transcript
 */
export async function loadRawVtt(videoId: string): Promise<string | null> {
  const vttFile = join(getCacheDir(), `${videoId}.vtt.gz`);

  // Try loading from .vtt.gz file first
  if (existsSync(vttFile)) {
    try {
      const compressed = await readFile(vttFile);
      const decompressed = gunzipSync(compressed);
      return decompressed.toString('utf-8');
    } catch (error) {
      console.error(`Error loading VTT for ${videoId}:`, error);
    }
  }

  // Try loading from Lambda format (embedded in .json.gz)
  const jsonFile = join(getCacheDir(), `${videoId}.json.gz`);
  if (existsSync(jsonFile)) {
    try {
      const compressed = await readFile(jsonFile);
      const decompressed = gunzipSync(compressed);
      const data = JSON.parse(decompressed.toString('utf-8'));

      // If we have segments, construct timestamped text directly
      // This is needed because plainText has no timestamps, but parseVttToTimestampedText
      // expects VTT format with timestamps
      if (data.transcript?.segments && Array.isArray(data.transcript.segments)) {
        const parts: string[] = [];
        for (const segment of data.transcript.segments) {
          const timestamp = formatTimestampForAI(segment.startTime);
          parts.push(`${timestamp} ${segment.text}`);
        }
        // Return in a format that parseVttToTimestampedText will pass through
        // We use a special marker to indicate this is already formatted
        return `TIMESTAMPED_TEXT:${parts.join(' ')}`;
      }

      if (data.transcript?.plainText) {
        return data.transcript.plainText;
      }
    } catch (error) {
      console.error(`Error loading transcript from JSON for ${videoId}:`, error);
    }
  }

  return null;
}

/**
 * Load transcript segments from Lambda format
 */
export async function loadTranscriptSegments(videoId: string): Promise<{ startTime: number; endTime: number; text: string }[] | null> {
  const jsonFile = join(getCacheDir(), `${videoId}.json.gz`);

  if (!existsSync(jsonFile)) {
    return null;
  }

  try {
    const compressed = await readFile(jsonFile);
    const decompressed = gunzipSync(compressed);
    const data = JSON.parse(decompressed.toString('utf-8'));
    if (data.transcript?.segments) {
      return data.transcript.segments;
    }
  } catch (error) {
    console.error(`Error loading transcript segments for ${videoId}:`, error);
  }

  return null;
}

/**
 * Check if recipe file exists (legacy flat file or versioned directory)
 */
export function recipeExists(videoId: string): boolean {
  // Check legacy flat file format
  const recipeFile = join(getRecipesDir(), `${videoId}_recipe.json`);
  if (existsSync(recipeFile)) {
    return true;
  }
  // Check versioned directory format
  const versionedDir = join(getRecipesDir(), videoId, 'versions');
  return existsSync(versionedDir);
}

/**
 * Save recipe JSON to file
 */
export async function saveRecipe(videoId: string, recipe: object): Promise<boolean> {
  ensureRecipesDir();
  const recipeFile = join(getRecipesDir(), `${videoId}_recipe.json`);

  try {
    await writeFile(recipeFile, JSON.stringify(recipe, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error(`Error saving recipe for ${videoId}:`, error);
    return false;
  }
}

/**
 * Load existing recipe from file
 */
export async function loadRecipe(videoId: string): Promise<object | null> {
  const recipeFile = join(getRecipesDir(), `${videoId}_recipe.json`);

  if (!existsSync(recipeFile)) {
    return null;
  }

  try {
    const content = await readFile(recipeFile, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading recipe for ${videoId}:`, error);
    return null;
  }
}

/**
 * Get the pipeline directory path
 */
export function pipelineDir(): string {
  return getPipelineDir();
}

/**
 * Pipeline run manifest structure
 */
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

/**
 * Get list of all pipeline runs
 */
export async function getPipelineRuns(): Promise<RunManifest[]> {
  const runsDir = join(getPipelineDir(), 'runs');

  if (!existsSync(runsDir)) {
    return [];
  }

  const entries = await readdir(runsDir, { withFileTypes: true });
  const runs: RunManifest[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const manifestPath = join(runsDir, entry.name, 'manifest.json');
      if (existsSync(manifestPath)) {
        try {
          const content = await readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(content) as RunManifest;
          runs.push(manifest);
        } catch (error) {
          console.error(`Error loading manifest for run ${entry.name}:`, error);
        }
      }
    }
  }

  // Sort by created_at descending (most recent first)
  return runs.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Get list of video IDs in a pipeline run
 */
export async function getPipelineRunVideoIds(runId: string): Promise<string[]> {
  const recipesDir = join(getPipelineDir(), 'runs', runId, 'recipes');

  if (!existsSync(recipesDir)) {
    return [];
  }

  const files = await readdir(recipesDir);
  return files
    .filter(f => f.endsWith('.json.gz'))
    .map(f => f.replace('.json.gz', ''));
}

/**
 * Load a video from a pipeline run
 */
export async function loadPipelineVideo(runId: string, videoId: string): Promise<object | null> {
  const videoFile = join(getPipelineDir(), 'runs', runId, 'recipes', `${videoId}.json.gz`);

  if (!existsSync(videoFile)) {
    return null;
  }

  try {
    const compressed = await readFile(videoFile);
    const decompressed = gunzipSync(compressed);
    return JSON.parse(decompressed.toString('utf-8'));
  } catch (error) {
    console.error(`Error loading pipeline video ${videoId} from run ${runId}:`, error);
    return null;
  }
}

/**
 * Get all video IDs from youtube-cache (from .json.gz metadata files)
 */
export async function getAllVideoIds(): Promise<string[]> {
  const cacheDirectory = getCacheDir();

  if (!existsSync(cacheDirectory)) {
    return [];
  }

  const files = await readdir(cacheDirectory);
  const videoIds: string[] = [];

  for (const filename of files) {
    // Match video metadata files (11 char video ID + .json.gz)
    // Exclude channel files (channel_*.json.gz)
    if (filename.endsWith('.json.gz') && !filename.startsWith('channel_')) {
      const videoId = filename.replace('.json.gz', '');
      // YouTube video IDs are 11 characters
      if (videoId.length === 11) {
        videoIds.push(videoId);
      }
    }
  }

  return videoIds.sort();
}

/**
 * Check if a video has a transcript
 * Checks for .vtt.gz file OR embedded transcript in Lambda format
 */
export function hasTranscript(videoId: string): boolean {
  const vttFile = join(getCacheDir(), `${videoId}.vtt.gz`);
  if (existsSync(vttFile)) {
    return true;
  }

  // Check for Lambda format with embedded transcript
  const jsonFile = join(getCacheDir(), `${videoId}.json.gz`);
  if (existsSync(jsonFile)) {
    try {
      const compressed = require('fs').readFileSync(jsonFile);
      const decompressed = gunzipSync(compressed);
      const data = JSON.parse(decompressed.toString('utf-8'));
      return data.transcript != null;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Get list of all channel slugs from youtube-cache
 */
export async function getChannelSlugs(): Promise<string[]> {
  const cacheDirectory = getCacheDir();

  if (!existsSync(cacheDirectory)) {
    return [];
  }

  const files = await readdir(cacheDirectory);
  const slugs: string[] = [];

  for (const filename of files) {
    if (filename.startsWith('channel_') && filename.endsWith('.json.gz')) {
      const slug = filename.replace('channel_', '').replace('.json.gz', '');
      slugs.push(slug);
    }
  }

  return slugs.sort();
}

/**
 * Load channel metadata from cache
 */
export async function loadChannelMetadata(channelSlug: string): Promise<object | null> {
  const channelFile = join(getCacheDir(), `channel_${channelSlug}.json.gz`);

  if (!existsSync(channelFile)) {
    return null;
  }

  try {
    const compressed = await readFile(channelFile);
    const decompressed = gunzipSync(compressed);
    return JSON.parse(decompressed.toString('utf-8'));
  } catch (error) {
    console.error(`Error loading channel ${channelSlug}:`, error);
    return null;
  }
}
