#!/usr/bin/env npx tsx
/**
 * Generate cleaned transcripts for videos using OpenAI.
 *
 * This script generates cleaned, readable transcript sections from raw VTT transcripts.
 * Cleaned transcripts can be used for the Dan Random page and other features.
 *
 * Usage:
 *   npm run pipeline:clean-transcript
 *   npm run pipeline:clean-transcript -- --title "What.*Eating.*Dan"
 *   npm run pipeline:clean-transcript -- --limit 10
 *   npm run pipeline:clean-transcript -- --skip-existing
 *   npm run pipeline:clean-transcript -- --dry-run
 */

import fs from 'fs';
import path from 'path';
import { gunzipSync } from 'zlib';
import { parseArgs } from 'util';
import dotenv from 'dotenv';
import { generateCleanTranscript } from '../lib/admin/openai/client';
import { parseVttToTimestampedText } from '../lib/admin/data/vtt-parser';
import type { CleanedTranscript, VideoRecipes, RecipeVersionInfo, VersionedRecipe } from '../lib/types/admin';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

// Directories
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname);
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, '..');
const CACHE_DIR = path.join(PROJECT_ROOT, 'data', 'youtube-cache');
const RECIPES_DIR = path.join(CACHE_DIR, 'recipes');

interface VideoFile {
  videoId: string;
  filePath: string;
  title: string;
  channelName?: string;
}

interface CachedVideoData {
  metadata?: {
    id: string;
    fulltitle?: string;
    title?: string;
    description?: string;
    webpage_url?: string;
    upload_date?: string;
    duration?: number;
    channel?: string;
  };
  transcript?: {
    plainText?: string;
    segments?: Array<{ startTime: number; endTime: number; text: string }>;
  };
}

/**
 * Parse command line arguments
 */
function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      limit: { type: 'string', short: 'l' },
      'skip-existing': { type: 'boolean', short: 's' },
      title: { type: 'string', short: 't' },
      channel: { type: 'string', short: 'c' },
      'dry-run': { type: 'boolean', short: 'd' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    console.log(`
Usage: npm run pipeline:clean-transcript -- [options]

Options:
  -l, --limit N         Process only first N videos
  -s, --skip-existing   Skip videos that already have cleaned transcripts
  -t, --title PATTERN   Only process videos with titles matching regex PATTERN
  -c, --channel FILTER  Only process videos from channels matching FILTER
  -d, --dry-run         Show what would be processed without calling OpenAI
  -h, --help            Show this help message

Examples:
  npm run pipeline:clean-transcript -- --title "What.*Eating.*Dan"
  npm run pipeline:clean-transcript -- --channel "America" --limit 5
  npm run pipeline:clean-transcript -- --skip-existing --dry-run
`);
    process.exit(0);
  }

  return {
    limit: values.limit ? parseInt(values.limit, 10) : undefined,
    skipExisting: values['skip-existing'] ?? false,
    titlePattern: values.title,
    channelFilter: values.channel?.toLowerCase(),
    dryRun: values['dry-run'] ?? false,
  };
}

/**
 * Get list of video files with transcripts from cache directory
 */
function getVideoFiles(): VideoFile[] {
  const files = fs.readdirSync(CACHE_DIR);
  const videoFiles: VideoFile[] = [];

  for (const filename of files) {
    // Skip channel files and non-json.gz files
    if (!filename.endsWith('.json.gz') || filename.startsWith('channel_')) {
      continue;
    }

    const videoId = filename.replace('.json.gz', '');

    // YouTube video IDs are 11 characters
    if (videoId.length !== 11) {
      continue;
    }

    const filePath = path.join(CACHE_DIR, filename);

    try {
      const compressed = fs.readFileSync(filePath);
      const data: CachedVideoData = JSON.parse(gunzipSync(compressed).toString('utf-8'));

      // Check if it has a transcript
      if (data.transcript?.plainText || data.transcript?.segments) {
        const title = data.metadata?.fulltitle || data.metadata?.title || 'Unknown';
        videoFiles.push({
          videoId,
          filePath,
          title,
          channelName: data.metadata?.channel,
        });
      }
    } catch {
      // Skip files that can't be parsed
    }
  }

  return videoFiles.sort((a, b) => a.videoId.localeCompare(b.videoId));
}

/**
 * Check if cleaned transcript already exists for a video
 */
function cleanedTranscriptExists(videoId: string): boolean {
  const versionsDir = path.join(RECIPES_DIR, videoId, 'versions');
  if (!fs.existsSync(versionsDir)) {
    return false;
  }

  // Check if v1.json exists and has cleaned_transcript
  const v1Path = path.join(versionsDir, 'v1.json');
  if (!fs.existsSync(v1Path)) {
    return false;
  }

  try {
    const content = fs.readFileSync(v1Path, 'utf-8');
    const versionedRecipe: VersionedRecipe = JSON.parse(content);
    return versionedRecipe.recipe.cleaned_transcript !== undefined;
  } catch {
    return false;
  }
}

/**
 * Load video data from cache file
 */
function loadVideoData(filePath: string): CachedVideoData | null {
  try {
    const compressed = fs.readFileSync(filePath);
    return JSON.parse(gunzipSync(compressed).toString('utf-8'));
  } catch (error) {
    console.error(`  Error loading video data: ${(error as Error).message}`);
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
 * Load raw VTT content from file (for videos with separate .vtt.gz files)
 */
function loadRawVtt(videoId: string): string | null {
  const vttPath = path.join(CACHE_DIR, `${videoId}.vtt.gz`);

  if (fs.existsSync(vttPath)) {
    try {
      const compressed = fs.readFileSync(vttPath);
      return gunzipSync(compressed).toString('utf-8');
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Get transcript text with timestamps for AI consumption
 */
function getTimestampedTranscript(data: CachedVideoData, videoId: string): string | null {
  // First try to load from separate VTT file
  const rawVtt = loadRawVtt(videoId);
  if (rawVtt) {
    return parseVttToTimestampedText(rawVtt);
  }

  // Fall back to embedded segments
  if (data.transcript?.segments && data.transcript.segments.length > 0) {
    const parts: string[] = [];
    for (const segment of data.transcript.segments) {
      const timestamp = formatTimestampForAI(segment.startTime);
      parts.push(`${timestamp} ${segment.text}`);
    }
    return parts.join(' ');
  }

  // Last resort: plain text without timestamps
  if (data.transcript?.plainText) {
    return data.transcript.plainText;
  }

  return null;
}

/**
 * Save cleaned transcript to versioned recipe structure
 */
function saveCleanedTranscript(videoId: string, cleanedTranscript: CleanedTranscript, metadata: CachedVideoData['metadata']): void {
  const videoDir = path.join(RECIPES_DIR, videoId);
  const versionsDir = path.join(videoDir, 'versions');

  // Create directories
  if (!fs.existsSync(versionsDir)) {
    fs.mkdirSync(versionsDir, { recursive: true });
  }

  // Check if v1.json already exists (update it), otherwise create new
  const v1Path = path.join(versionsDir, 'v1.json');
  let versionedRecipe: VersionedRecipe;

  if (fs.existsSync(v1Path)) {
    // Load existing and update with cleaned transcript
    const content = fs.readFileSync(v1Path, 'utf-8');
    versionedRecipe = JSON.parse(content);
    versionedRecipe.recipe.cleaned_transcript = cleanedTranscript;
  } else {
    // Create minimal recipe structure with cleaned transcript
    const recipe: VideoRecipes = {
      has_recipe: false, // We're only generating transcripts, not recipes
      video_id: videoId,
      video_url: metadata?.webpage_url || `https://www.youtube.com/watch?v=${videoId}`,
      upload_date: metadata?.upload_date || '',
      recipes: [],
      cleaned_transcript: cleanedTranscript,
    };

    const versionInfo: RecipeVersionInfo = {
      version: 1,
      created_at: new Date().toISOString(),
      prompt_used: 'clean-transcript-only',
      model: cleanedTranscript.model,
      temperature: 0.3,
      generation_type: 'original',
    };

    versionedRecipe = {
      version_info: versionInfo,
      recipe,
    };
  }

  // Write v1.json
  fs.writeFileSync(v1Path, JSON.stringify(versionedRecipe, null, 2));

  // Write current_version.txt
  const currentVersionPath = path.join(videoDir, 'current_version.txt');
  fs.writeFileSync(currentVersionPath, '1');
}

/**
 * Main function
 */
async function main() {
  const args = parseCliArgs();

  console.log('Cleaned Transcript Generation Pipeline');
  console.log('='.repeat(50));
  console.log(`Cache directory: ${CACHE_DIR}`);
  console.log(`Recipes directory: ${RECIPES_DIR}`);
  if (args.limit) console.log(`Limit: ${args.limit} videos`);
  if (args.skipExisting) console.log('Skip existing: enabled');
  if (args.titlePattern) console.log(`Title pattern: "${args.titlePattern}"`);
  if (args.channelFilter) console.log(`Channel filter: "${args.channelFilter}"`);
  if (args.dryRun) console.log('DRY RUN - no transcripts will be generated');
  console.log();

  // Get all video files
  let videos = getVideoFiles();
  console.log(`Found ${videos.length} videos with transcripts`);

  // Apply title pattern filter
  if (args.titlePattern) {
    const regex = new RegExp(args.titlePattern, 'i');
    videos = videos.filter((v) => regex.test(v.title));
    console.log(`After title filter: ${videos.length} videos`);
  }

  // Apply channel filter
  if (args.channelFilter) {
    videos = videos.filter(
      (v) => v.channelName && v.channelName.toLowerCase().includes(args.channelFilter!)
    );
    console.log(`After channel filter: ${videos.length} videos`);
  }

  // Apply skip existing
  if (args.skipExisting) {
    const before = videos.length;
    videos = videos.filter((v) => !cleanedTranscriptExists(v.videoId));
    console.log(`After skip existing: ${videos.length} videos (skipped ${before - videos.length})`);
  }

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
      console.log(`  ${video.videoId} | ${video.title} (${video.channelName || 'unknown channel'})`);
    }
    return;
  }

  // Process videos
  let processed = 0;
  let success = 0;
  let errors = 0;

  for (const video of videos) {
    const index = processed + 1;
    console.log(`[${index}/${videos.length}] Processing ${video.videoId}...`);
    console.log(`  Title: ${video.title}`);

    const data = loadVideoData(video.filePath);
    if (!data) {
      console.log('  Skipped: Could not load video data');
      errors++;
      processed++;
      continue;
    }

    const transcript = getTimestampedTranscript(data, video.videoId);
    if (!transcript) {
      console.log('  Skipped: No transcript available');
      errors++;
      processed++;
      continue;
    }

    try {
      const cleanedTranscript = await generateCleanTranscript(transcript, {
        description: data.metadata?.description,
      });

      if (!cleanedTranscript) {
        console.log('  Error: Failed to generate cleaned transcript');
        errors++;
        processed++;
        continue;
      }

      saveCleanedTranscript(video.videoId, cleanedTranscript, data.metadata);
      console.log(`  Success: ${cleanedTranscript.sections.length} sections`);
      success++;
    } catch (error) {
      console.error(`  Error: ${(error as Error).message}`);
      errors++;
    }

    processed++;

    // Rate limiting: 1 second between requests
    if (index < videos.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  console.log();
  console.log('='.repeat(50));
  console.log(`Processed: ${processed}`);
  console.log(`Success: ${success}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
