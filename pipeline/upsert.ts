#!/usr/bin/env npx tsx

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { gunzipSync } from 'zlib';
import { createClient } from '@supabase/supabase-js';
import { config, getRunDir, getRecipesDir, getManifestPath, getCurrentRunPath } from './config';
import type { ExtractedVideo, RunManifest } from './types';

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL environment variable');
  }

  if (!supabaseServiceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function parseArgs(): { runId: string | null } {
  const args = process.argv.slice(2);
  let runId: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--run' && args[i + 1]) {
      runId = args[i + 1];
      break;
    }
    if (args[i].startsWith('--run=')) {
      runId = args[i].slice(6);
      break;
    }
  }

  return { runId };
}

async function main() {
  const { runId: specifiedRunId } = parseArgs();

  // Determine which run to use
  let runId = specifiedRunId;
  if (!runId) {
    const currentRunPath = getCurrentRunPath();
    if (fs.existsSync(currentRunPath)) {
      runId = fs.readFileSync(currentRunPath, 'utf-8').trim();
    }
  }

  if (!runId) {
    console.error('Error: No run specified and no current run set.');
    console.error('Usage: npm run pipeline:upsert -- --run=<run-id>');
    console.error('   or: npm run pipeline:upsert  (uses current run)');
    console.error('\nRun `npm run pipeline:extract` first to create a run.');
    process.exit(1);
  }

  const runDir = getRunDir(runId);
  const recipesDir = getRecipesDir(runId);
  const manifestPath = getManifestPath(runId);

  if (!fs.existsSync(runDir)) {
    console.error(`Error: Run not found: ${runId}`);
    process.exit(1);
  }

  console.log(`Upserting run: ${runId}`);
  console.log(`Recipes directory: ${recipesDir}\n`);

  const supabase = createSupabaseClient();

  // Load manifest
  const manifest: RunManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // Get all recipe files
  const files = fs.readdirSync(recipesDir).filter(f => f.endsWith('.json.gz'));
  console.log(`Found ${files.length} video files to upsert\n`);

  // Track unique channels to upsert first
  const channelsToUpsert = new Map<string, ExtractedVideo['channel'] & { id: string; slug: string }>();
  const videosToProcess: ExtractedVideo[] = [];

  // First pass: load all data and collect unique channels
  for (const file of files) {
    const filePath = path.join(recipesDir, file);
    const compressed = fs.readFileSync(filePath);
    const video: ExtractedVideo = JSON.parse(gunzipSync(compressed).toString('utf-8'));
    videosToProcess.push(video);

    if (!channelsToUpsert.has(video.channel_id)) {
      channelsToUpsert.set(video.channel_id, {
        id: video.channel_id,
        slug: video.channel_slug,
        ...video.channel,
      });
    }
  }

  // Upsert channels
  console.log(`Upserting ${channelsToUpsert.size} channels...`);
  for (const [channelId, channel] of channelsToUpsert) {
    const { error } = await supabase.from('channels').upsert({
      id: channelId,
      slug: channel.slug,
      name: channel.name,
      follower_count: channel.follower_count,
      description: channel.description,
      thumbnails: channel.thumbnails,
    }, { onConflict: 'id' });

    if (error) {
      console.error(`  Error upserting channel ${channelId}: ${error.message}`);
    }
  }
  console.log('  Done.\n');

  // Upsert videos, recipes, and transcripts
  console.log(`Upserting ${videosToProcess.length} videos...`);
  let successCount = 0;
  let errorCount = 0;

  for (const video of videosToProcess) {
    try {
      // Upsert video
      const { error: videoError } = await supabase.from('videos').upsert({
        id: video.video_id,
        channel_id: video.channel_id,
        title: video.video.title,
        description: video.video.description,
        duration: video.video.duration,
        view_count: video.video.view_count,
        upload_date: video.video.upload_date || null,
        thumbnails: video.video.thumbnails,
        has_recipe: video.recipes.length > 0,
      }, { onConflict: 'id' });

      if (videoError) {
        throw new Error(`Video: ${videoError.message}`);
      }

      // Upsert recipes
      for (let i = 0; i < video.recipes.length; i++) {
        const recipe = video.recipes[i];
        const { error: recipeError } = await supabase.from('recipes').upsert({
          video_id: video.video_id,
          recipe_index: i,
          title: recipe.title,
          description: recipe.description || null,
          prep_time_minutes: recipe.prep_time_minutes || null,
          cook_time_minutes: recipe.cook_time_minutes || null,
          servings: recipe.servings || null,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions,
          equipment: recipe.equipment || null,
          tags: recipe.tags || null,
          tips: recipe.tips || null,
          run_id: runId,
        }, { onConflict: 'video_id,recipe_index' });

        if (recipeError) {
          throw new Error(`Recipe: ${recipeError.message}`);
        }
      }

      // Upsert transcript
      if (video.transcript) {
        const { error: transcriptError } = await supabase.from('transcripts').upsert({
          video_id: video.video_id,
          segments: video.transcript.segments,
          raw_vtt: video.transcript.raw_vtt,
          run_id: runId,
        }, { onConflict: 'video_id' });

        if (transcriptError) {
          throw new Error(`Transcript: ${transcriptError.message}`);
        }
      }

      successCount++;
    } catch (error) {
      console.error(`  Error upserting ${video.video_id}: ${(error as Error).message}`);
      errorCount++;
    }
  }

  console.log(`  Success: ${successCount}, Errors: ${errorCount}\n`);

  // Update manifest
  manifest.upserted_to_supabase = true;
  manifest.upserted_at = new Date().toISOString();
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('='.repeat(50));
  console.log(`Run ${runId} upserted to Supabase`);
  console.log(`Videos: ${successCount} success, ${errorCount} errors`);
  console.log(`Manifest updated: ${manifestPath}`);
}

main().catch(console.error);
