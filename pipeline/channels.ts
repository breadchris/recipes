#!/usr/bin/env npx tsx

/**
 * Fetch and display YouTube channel metadata and videos.
 *
 * Usage:
 *   npm run pipeline:channels -- @JKenjiLopezAlt @EthanChlebowski
 *   npm run pipeline:channels -- https://www.youtube.com/@JKenjiLopezAlt
 *   npm run pipeline:channels -- @JKenjiLopezAlt --force  # bypass cache
 */

import fs from 'fs';
import path from 'path';
import { gunzipSync } from 'zlib';
import { spawn } from 'child_process';
import { config } from './config';
import type { Thumbnail } from '../lib/types';

// Types for channel cache data (matches Python script output)
interface VideoEntry {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  view_count?: number;
  upload_date?: string; // YYYYMMDD format
  thumbnails?: Thumbnail[];
}

interface ChannelData {
  channel: string;
  channel_id: string;
  channel_follower_count?: number;
  description?: string;
  thumbnails?: Thumbnail[];
  entries?: VideoEntry[];
}

// Parse CLI arguments
function parseArgs(): { handles: string[]; force: boolean } {
  const args = process.argv.slice(2);
  const handles: string[] = [];
  let force = false;

  for (const arg of args) {
    if (arg === '--force' || arg === '-f') {
      force = true;
    } else if (!arg.startsWith('-')) {
      handles.push(arg);
    }
  }

  return { handles, force };
}

// Normalize channel input to just the handle (without @ or URL)
function normalizeChannelHandle(input: string): string {
  // Handle full URL: https://www.youtube.com/@ChannelName
  const urlMatch = input.match(/@([\w-]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }

  // Handle @ChannelName format
  if (input.startsWith('@')) {
    return input.slice(1);
  }

  // Assume it's already just the handle
  return input;
}

// Get the cache file path for a channel
function getChannelCachePath(handle: string): string {
  return path.join(config.youtubeCacheDir, `channel_${handle}.json.gz`);
}

// Check if channel is cached
function isChannelCached(handle: string): boolean {
  return fs.existsSync(getChannelCachePath(handle));
}

// Load channel data from cache
function loadChannelCache(handle: string): ChannelData | null {
  const cachePath = getChannelCachePath(handle);

  if (!fs.existsSync(cachePath)) {
    return null;
  }

  try {
    const compressed = fs.readFileSync(cachePath);
    const data = JSON.parse(gunzipSync(compressed).toString('utf-8'));
    return data as ChannelData;
  } catch (error) {
    console.error(`  Error loading cache for ${handle}: ${(error as Error).message}`);
    return null;
  }
}

// Fetch channel data using the Python script
async function fetchChannelData(handle: string): Promise<boolean> {
  const channelUrl = `https://www.youtube.com/@${handle}`;
  const pythonScript = path.join(__dirname, '..', 'youtube', 'fetch_youtube_metadata.py');

  return new Promise((resolve) => {
    console.log(`  Fetching from YouTube...`);

    const proc = spawn('python3', [pythonScript, 'transcript', '--channel-url', channelUrl], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
      // Print progress lines that contain useful info
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.includes('✓') || line.includes('→') || line.includes('Found')) {
          console.log(`  ${line.trim()}`);
        }
      }
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        console.error(`  Failed to fetch channel (exit code ${code})`);
        if (stderr && !stderr.includes('✓')) {
          console.error(`  ${stderr.split('\n').slice(-3).join('\n  ')}`);
        }
        resolve(false);
      }
    });

    proc.on('error', (err) => {
      console.error(`  Failed to spawn Python script: ${err.message}`);
      resolve(false);
    });
  });
}

// Check if a video has a recipe in the cache
function hasRecipe(videoId: string): boolean {
  const recipeFile = path.join(config.recipesDir, `${videoId}_recipe.json`);
  if (!fs.existsSync(recipeFile)) {
    return false;
  }

  try {
    const data = JSON.parse(fs.readFileSync(recipeFile, 'utf-8'));
    return data.has_recipe === true;
  } catch {
    return false;
  }
}

// Check if a video has a transcript in the cache
function hasTranscript(videoId: string): boolean {
  const vttFile = path.join(config.cacheDir, `${videoId}.vtt.gz`);
  const transcriptFile = path.join(config.youtubeCacheDir, `${videoId}.json.gz`);
  return fs.existsSync(vttFile) || fs.existsSync(transcriptFile);
}

// Format duration in MM:SS or HH:MM:SS
function formatDuration(seconds?: number): string {
  if (!seconds) return '--:--';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Format view count (e.g., 1.2M, 890K)
function formatViews(count?: number): string {
  if (!count) return '--';

  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(0)}K`;
  }
  return count.toString();
}

// Format upload date from YYYYMMDD to YYYY-MM-DD
function formatDate(dateStr?: string): string {
  if (!dateStr || dateStr.length !== 8) return '--';

  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

// Format subscriber count
function formatSubscribers(count?: number): string {
  if (!count) return '';

  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M subscribers`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(0)}K subscribers`;
  }
  return `${count} subscribers`;
}

// Truncate string to max length
function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

// Display videos for a channel
function displayVideos(channelData: ChannelData, handle: string): void {
  const videos = channelData.entries || [];

  // Sort by upload date (newest first)
  const sortedVideos = [...videos].sort((a, b) => {
    const dateA = a.upload_date || '0';
    const dateB = b.upload_date || '0';
    return dateB.localeCompare(dateA);
  });

  // Header
  const subscriberStr = formatSubscribers(channelData.channel_follower_count);
  console.log(`\n@${handle} - ${channelData.channel}${subscriberStr ? ` (${subscriberStr})` : ''}`);
  console.log('─'.repeat(100));
  console.log(
    'ID'.padEnd(12) +
      '│ ' +
      'Title'.padEnd(45) +
      '│ ' +
      'Date'.padEnd(12) +
      '│ ' +
      'Duration'.padEnd(10) +
      '│ ' +
      'Views'.padEnd(10) +
      '│ Status'
  );
  console.log('─'.repeat(100));

  // Stats
  let withRecipe = 0;
  let withTranscript = 0;
  let newVideos = 0;

  for (const video of sortedVideos) {
    const hasR = hasRecipe(video.id);
    const hasT = hasTranscript(video.id);

    let status: string;
    if (hasR) {
      status = '✓ recipe';
      withRecipe++;
    } else if (hasT) {
      status = '✓ transcript';
      withTranscript++;
    } else {
      status = '○ new';
      newVideos++;
    }

    console.log(
      video.id.padEnd(12) +
        '│ ' +
        truncate(video.title, 44).padEnd(45) +
        '│ ' +
        formatDate(video.upload_date).padEnd(12) +
        '│ ' +
        formatDuration(video.duration).padEnd(10) +
        '│ ' +
        formatViews(video.view_count).padEnd(10) +
        '│ ' +
        status
    );
  }

  console.log('─'.repeat(100));
  console.log(
    `Summary: ${videos.length} videos, ${withRecipe} with recipes, ${withTranscript} with transcripts only, ${newVideos} new`
  );
}

async function processChannel(handle: string, force: boolean): Promise<void> {
  console.log(`\nProcessing channel: @${handle}`);

  // Check cache unless force refresh
  const isCached = isChannelCached(handle);

  if (!isCached || force) {
    if (force && isCached) {
      console.log(`  Forcing refresh (bypassing cache)...`);
    }

    const success = await fetchChannelData(handle);
    if (!success && !isCached) {
      console.error(`  Failed to fetch and no cached data available`);
      return;
    }
  } else {
    console.log(`  Using cached data`);
  }

  // Load and display
  const channelData = loadChannelCache(handle);
  if (!channelData) {
    console.error(`  Failed to load channel data`);
    return;
  }

  displayVideos(channelData, handle);
}

async function main(): Promise<void> {
  const { handles, force } = parseArgs();

  if (handles.length === 0) {
    console.log('Usage: npm run pipeline:channels -- @Channel1 @Channel2 [--force]');
    console.log('');
    console.log('Options:');
    console.log('  --force, -f  Bypass cache and fetch fresh data from YouTube');
    console.log('');
    console.log('Examples:');
    console.log('  npm run pipeline:channels -- @JKenjiLopezAlt');
    console.log('  npm run pipeline:channels -- @JKenjiLopezAlt @EthanChlebowski');
    console.log('  npm run pipeline:channels -- https://www.youtube.com/@JKenjiLopezAlt');
    console.log('  npm run pipeline:channels -- @JKenjiLopezAlt --force');
    process.exit(1);
  }

  console.log('YouTube Channel Pipeline');
  console.log('========================');

  for (const input of handles) {
    const handle = normalizeChannelHandle(input);
    await processChannel(handle, force);
  }

  console.log('\nDone.');
}

main().catch(console.error);
