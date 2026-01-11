#!/usr/bin/env npx tsx

import fs from 'fs';
import path from 'path';
import { gunzipSync, gzipSync } from 'zlib';
import { config, generateRunId, getRunDir, getRecipesDir, getManifestPath, getCurrentRunPath } from './config';
import type { ExtractedVideo, RunManifest, TranscriptSegment, Transcript } from './types';
import type { Recipe, Thumbnail } from '../../lib/types';

// VTT parsing functions (adapted from other-data/viewer/src/lib/vtt-parser.ts)
function parseTimestamp(timestamp: string): number {
  const parts = timestamp.trim().split(':');
  if (parts.length === 3) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    return minutes * 60 + seconds;
  }
  return 0;
}

function cleanVttText(text: string): string {
  return text
    .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
    .replace(/<\/?c>/g, '')
    .replace(/align:\w+/g, '')
    .replace(/position:\d+%/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseVtt(vttContent: string): TranscriptSegment[] {
  const lines = vttContent.split('\n');
  const segments: TranscriptSegment[] = [];
  const seenTexts = new Set<string>();
  let accumulatedText = '';
  let i = 0;

  while (i < lines.length && !lines[i].includes('-->')) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.includes('-->')) {
      const timestampMatch = line.match(
        /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/
      );

      if (timestampMatch) {
        const startTime = parseTimestamp(timestampMatch[1]);
        const endTime = parseTimestamp(timestampMatch[2]);

        const textLines: string[] = [];
        i++;
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i]);
          i++;
        }

        const rawText = textLines.join(' ');
        const cleanedText = cleanVttText(rawText);

        if (cleanedText && !seenTexts.has(cleanedText)) {
          if (!accumulatedText.includes(cleanedText)) {
            if (cleanedText.startsWith(accumulatedText) && accumulatedText.length > 0) {
              const newPart = cleanedText.slice(accumulatedText.length).trim();
              if (newPart) {
                segments.push({ startTime, endTime, text: newPart });
                seenTexts.add(newPart);
              }
              accumulatedText = cleanedText;
            } else {
              segments.push({ startTime, endTime, text: cleanedText });
              accumulatedText = cleanedText;
            }
            seenTexts.add(cleanedText);
          }
        }
      }
    }
    i++;
  }

  return segments;
}

function loadRecipe(videoId: string): Recipe[] | null {
  const recipeFile = path.join(config.recipesDir, `${videoId}_recipe.json`);

  try {
    if (!fs.existsSync(recipeFile)) {
      return null;
    }

    const recipeData = fs.readFileSync(recipeFile, 'utf-8');
    const recipe = JSON.parse(recipeData);

    if (!recipe.has_recipe) {
      return null;
    }

    const { has_recipe, video_id, video_url, upload_date, ...recipeContent } = recipe;
    return [recipeContent as Recipe];
  } catch (error) {
    console.error(`  Warning: Failed to load recipe for ${videoId}: ${(error as Error).message}`);
    return null;
  }
}

function loadTranscript(videoId: string): Transcript | null {
  const vttFile = path.join(config.cacheDir, `${videoId}.vtt.gz`);

  try {
    if (!fs.existsSync(vttFile)) {
      return null;
    }

    const compressed = fs.readFileSync(vttFile);
    const vttContent = gunzipSync(compressed).toString('utf-8');
    const segments = parseVtt(vttContent);

    return {
      segments,
      raw_vtt: vttContent,
    };
  } catch (error) {
    console.error(`  Warning: Failed to load transcript for ${videoId}: ${(error as Error).message}`);
    return null;
  }
}

function getBestThumbnails(thumbnails: Thumbnail[]): Thumbnail[] {
  if (!thumbnails || thumbnails.length === 0) return [];

  const ytThumbnails = thumbnails.filter(t => t.url && t.url.includes('i.ytimg.com/vi'));
  if (ytThumbnails.length === 0) return thumbnails.slice(0, 3);

  const sorted = ytThumbnails.sort((a, b) => {
    const aRes = (a.width || 0) * (a.height || 0);
    const bRes = (b.width || 0) * (b.height || 0);
    return bRes - aRes;
  });

  const sizes: Thumbnail[] = [];
  const addedResolutions = new Set<number>();

  for (const thumb of sorted) {
    const res = (thumb.width || 0) * (thumb.height || 0);
    if (!addedResolutions.has(res) && sizes.length < 3) {
      sizes.push(thumb);
      addedResolutions.add(res);
    }
  }

  return sizes;
}

interface ChannelData {
  channel: string;
  channel_id: string;
  channel_follower_count?: number;
  description?: string;
  thumbnails?: Thumbnail[];
  entries?: VideoEntry[];
}

interface VideoEntry {
  id: string;
  title: string;
  description?: string;
  duration?: number;
  view_count?: number;
  upload_date?: string;
  thumbnails?: Thumbnail[];
}

function extractVideosFromChannel(channelFile: string, channelSlug: string): ExtractedVideo[] {
  const compressed = fs.readFileSync(channelFile);
  const channelData: ChannelData = JSON.parse(gunzipSync(compressed).toString('utf-8'));

  const videos: ExtractedVideo[] = [];

  if (!channelData.entries || !Array.isArray(channelData.entries)) {
    return videos;
  }

  for (const video of channelData.entries) {
    const recipes = loadRecipe(video.id);
    const transcript = loadTranscript(video.id);

    const extracted: ExtractedVideo = {
      video_id: video.id,
      channel_id: channelData.channel_id,
      channel_slug: channelSlug,
      video: {
        title: video.title,
        description: video.description || '',
        duration: video.duration || 0,
        view_count: video.view_count || 0,
        upload_date: video.upload_date || '',
        thumbnails: getBestThumbnails(video.thumbnails || []),
      },
      channel: {
        name: channelData.channel,
        follower_count: channelData.channel_follower_count || 0,
        description: channelData.description || '',
        thumbnails: (channelData.thumbnails || []).slice(0, 2),
      },
      recipes: recipes || [],
      transcript,
    };

    videos.push(extracted);
  }

  return videos;
}

async function main() {
  const runId = generateRunId();
  const runDir = getRunDir(runId);
  const recipesOutputDir = getRecipesDir(runId);

  console.log(`Starting extraction run: ${runId}`);
  console.log(`Cache directory: ${config.cacheDir}`);
  console.log(`Recipes directory: ${config.recipesDir}`);
  console.log(`Output directory: ${runDir}\n`);

  // Create directories
  fs.mkdirSync(config.pipelineDir, { recursive: true });
  fs.mkdirSync(recipesOutputDir, { recursive: true });

  // Find all channel files
  const files = fs.readdirSync(config.cacheDir);
  const channelFiles = files.filter(f => f.startsWith('channel_') && f.endsWith('.json.gz'));

  console.log(`Found ${channelFiles.length} channel files\n`);

  let totalVideos = 0;
  let videosWithRecipes = 0;
  let videosWithTranscripts = 0;

  for (const file of channelFiles) {
    const channelSlug = file.replace('channel_', '').replace('.json.gz', '');
    const channelPath = path.join(config.cacheDir, file);

    console.log(`Processing: ${file}`);

    try {
      const videos = extractVideosFromChannel(channelPath, channelSlug);

      for (const video of videos) {
        // Write each video to its own file
        const outputPath = path.join(recipesOutputDir, `${video.video_id}.json.gz`);
        const jsonData = JSON.stringify(video);
        const compressed = gzipSync(jsonData);
        fs.writeFileSync(outputPath, compressed);

        totalVideos++;
        if (video.recipes.length > 0) videosWithRecipes++;
        if (video.transcript) videosWithTranscripts++;
      }

      console.log(`  Videos: ${videos.length}, with recipes: ${videos.filter(v => v.recipes.length > 0).length}`);
    } catch (error) {
      console.error(`  Error processing ${file}: ${(error as Error).message}`);
    }
  }

  // Write manifest
  const manifest: RunManifest = {
    run_id: runId,
    created_at: new Date().toISOString(),
    videos_processed: totalVideos,
    videos_with_recipes: videosWithRecipes,
    videos_with_transcripts: videosWithTranscripts,
    source: config.cacheDir,
    upserted_to_supabase: false,
    upserted_at: null,
  };

  fs.writeFileSync(getManifestPath(runId), JSON.stringify(manifest, null, 2));

  // Update current.txt
  fs.writeFileSync(getCurrentRunPath(), runId);

  console.log('\n' + '='.repeat(50));
  console.log(`Run ID: ${runId}`);
  console.log(`Total videos: ${totalVideos}`);
  console.log(`Videos with recipes: ${videosWithRecipes}`);
  console.log(`Videos with transcripts: ${videosWithTranscripts}`);
  console.log(`\nOutput: ${runDir}`);
  console.log(`Current run updated: ${getCurrentRunPath()}`);
}

main().catch(console.error);
