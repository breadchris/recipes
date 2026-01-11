#!/usr/bin/env npx tsx
/**
 * Generate recipes from video transcripts using OpenAI.
 *
 * This script replaces youtube/generate_recipes.py with a TypeScript implementation
 * that uses the same AI prompt as the admin viewer.
 *
 * Usage:
 *   npm run pipeline:generate
 *   npm run pipeline:generate -- --limit 10
 *   npm run pipeline:generate -- --skip-existing
 *   npm run pipeline:generate -- --channel "ethan"
 *   npm run pipeline:generate -- --dry-run
 */

import fs from 'fs';
import path from 'path';
import { gunzipSync } from 'zlib';
import { parseArgs } from 'util';
import dotenv from 'dotenv';
import { extractAllRecipes, type VideoMetadata } from '../lib/admin/openai/client';
import { DEFAULT_RECIPE_PROMPT } from '../lib/admin/openai/default-prompt';
import { parseVttToTimestampedText } from '../lib/admin/data/vtt-parser';

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
  channelName?: string;
  title?: string;
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
      channel: { type: 'string', short: 'c' },
      title: { type: 'string', short: 't' },
      'dry-run': { type: 'boolean', short: 'd' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    console.log(`
Usage: npm run pipeline:generate -- [options]

Options:
  -l, --limit N        Process only first N videos
  -s, --skip-existing  Skip videos that already have recipe files
  -c, --channel FILTER Only process videos from channels matching FILTER
  -t, --title PATTERN  Only process videos with titles matching PATTERN (regex)
  -d, --dry-run        Show what would be processed without calling OpenAI
  -h, --help           Show this help message
`);
    process.exit(0);
  }

  return {
    limit: values.limit ? parseInt(values.limit, 10) : undefined,
    skipExisting: values['skip-existing'] ?? false,
    channelFilter: values.channel?.toLowerCase(),
    titleFilter: values.title,
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
        videoFiles.push({
          videoId,
          filePath,
          channelName: data.metadata?.channel,
          title: data.metadata?.fulltitle || data.metadata?.title,
        });
      }
    } catch {
      // Skip files that can't be parsed
    }
  }

  return videoFiles.sort((a, b) => a.videoId.localeCompare(b.videoId));
}

/**
 * Check if recipe file already exists for a video
 */
function recipeExists(videoId: string): boolean {
  const recipePath = path.join(RECIPES_DIR, `${videoId}_recipe.json`);
  return fs.existsSync(recipePath);
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
 * Load raw VTT content from file (for videos with separate .vtt.gz files)
 */
function loadRawVtt(videoId: string): string | null {
  const vttPath = path.join(CACHE_DIR, `${videoId}.vtt.gz`);

  if (!fs.existsSync(vttPath)) {
    return null;
  }

  try {
    const compressed = fs.readFileSync(vttPath);
    return gunzipSync(compressed).toString('utf-8');
  } catch {
    return null;
  }
}

/**
 * Convert segments to VTT format for timestamp extraction
 */
function segmentsToVtt(segments: Array<{ startTime: number; endTime: number; text: string }>): string {
  const lines = ['WEBVTT', ''];

  for (const seg of segments) {
    const startTs = formatVttTimestamp(seg.startTime);
    const endTs = formatVttTimestamp(seg.endTime);
    lines.push(`${startTs} --> ${endTs}`);
    lines.push(seg.text);
    lines.push('');
  }

  return lines.join('\n');
}

function formatVttTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`;
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
    const vtt = segmentsToVtt(data.transcript.segments);
    return parseVttToTimestampedText(vtt);
  }

  // Last resort: plain text without timestamps
  if (data.transcript?.plainText) {
    return data.transcript.plainText;
  }

  return null;
}

/**
 * Save recipe to file
 */
function saveRecipe(videoId: string, recipe: unknown): void {
  // Ensure recipes directory exists
  if (!fs.existsSync(RECIPES_DIR)) {
    fs.mkdirSync(RECIPES_DIR, { recursive: true });
  }

  const recipePath = path.join(RECIPES_DIR, `${videoId}_recipe.json`);
  fs.writeFileSync(recipePath, JSON.stringify(recipe, null, 2));
}

/**
 * Main function
 */
async function main() {
  const args = parseCliArgs();

  console.log('Recipe Generation Pipeline');
  console.log('='.repeat(50));
  console.log(`Cache directory: ${CACHE_DIR}`);
  console.log(`Recipes directory: ${RECIPES_DIR}`);
  if (args.limit) console.log(`Limit: ${args.limit} videos`);
  if (args.skipExisting) console.log('Skip existing: enabled');
  if (args.channelFilter) console.log(`Channel filter: "${args.channelFilter}"`);
  if (args.titleFilter) console.log(`Title filter: "${args.titleFilter}"`);
  if (args.dryRun) console.log('DRY RUN - no recipes will be generated');
  console.log();

  // Get all video files
  let videos = getVideoFiles();
  console.log(`Found ${videos.length} videos with transcripts`);

  // Apply channel filter
  if (args.channelFilter) {
    videos = videos.filter(
      (v) => v.channelName && v.channelName.toLowerCase().includes(args.channelFilter!)
    );
    console.log(`After channel filter: ${videos.length} videos`);
  }

  // Apply title filter (regex)
  if (args.titleFilter) {
    const titleRegex = new RegExp(args.titleFilter, 'i');
    videos = videos.filter((v) => v.title && titleRegex.test(v.title));
    console.log(`After title filter: ${videos.length} videos`);
  }

  // Apply skip existing
  if (args.skipExisting) {
    const before = videos.length;
    videos = videos.filter((v) => !recipeExists(v.videoId));
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
      console.log(`  ${video.videoId} (${video.channelName || 'unknown channel'})`);
    }
    return;
  }

  // Process videos
  let processed = 0;
  let withRecipes = 0;
  let errors = 0;

  for (const video of videos) {
    const index = processed + 1;
    console.log(`[${index}/${videos.length}] Processing ${video.videoId}...`);

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

    // Build metadata for AI
    const metadata: VideoMetadata = {
      id: video.videoId,
      fulltitle: data.metadata?.fulltitle || data.metadata?.title || 'Unknown',
      description: data.metadata?.description || '',
      webpage_url: data.metadata?.webpage_url || `https://www.youtube.com/watch?v=${video.videoId}`,
      upload_date: data.metadata?.upload_date || '',
      duration: data.metadata?.duration || 0,
    };

    try {
      const { recipes: allRecipes, iterations } = await extractAllRecipes(
        metadata,
        transcript,
        DEFAULT_RECIPE_PROMPT,
        [] // no existing recipes
      );

      if (allRecipes && allRecipes.has_recipe) {
        saveRecipe(video.videoId, allRecipes);
        console.log(`  Saved: ${allRecipes.recipes.length} recipe(s) in ${iterations} iteration(s)`);
        withRecipes++;
      } else {
        // Save "no recipe" marker
        saveRecipe(video.videoId, { has_recipe: false, video_id: video.videoId, recipes: [] });
        console.log('  No recipe detected');
      }
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
  console.log(`With recipes: ${withRecipes}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
