#!/usr/bin/env npx tsx
/**
 * Batch generate cleaned transcripts and recipes for videos from Supabase.
 *
 * This script processes videos directly from Supabase using the two-stage generation:
 * 1. Generate cleaned transcript with sections
 * 2. Generate recipe using the cleaned transcript for context
 *
 * Usage:
 *   npm run pipeline:batch-generate -- --channel LifeByMikeG
 *   npm run pipeline:batch-generate -- --channel LifeByMikeG --skip-existing
 *   npm run pipeline:batch-generate -- --channel LifeByMikeG --limit 10
 *   npm run pipeline:batch-generate -- --channel LifeByMikeG --dry-run
 */

import { parseArgs } from 'util';
import dotenv from 'dotenv';
import {
  getAllVideosForListing,
  loadVideoMetadata,
  loadRawVtt,
  loadCleanedTranscript,
  saveNewVersion,
  type VideoListItem,
} from '../lib/admin/data/supabase-io';
import { parseVttToTimestampedText } from '../lib/admin/data/vtt-parser';
import {
  generateCleanTranscript,
  generateRecipeFromCleanedTranscript,
} from '../lib/admin/openai/client';
import { DEFAULT_RECIPE_PROMPT } from '../lib/admin/openai/default-prompt';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

/**
 * Parse command line arguments
 */
function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      channel: { type: 'string', short: 'c' },
      limit: { type: 'string', short: 'l' },
      'skip-existing': { type: 'boolean', short: 's' },
      'dry-run': { type: 'boolean', short: 'd' },
      help: { type: 'boolean', short: 'h' },
    },
    strict: true,
    allowPositionals: false,
  });

  if (values.help) {
    console.log(`
Usage: npm run pipeline:batch-generate -- [options]

Options:
  -c, --channel SLUG    Channel handle to process (required)
  -l, --limit N         Process only first N videos
  -s, --skip-existing   Skip videos that already have recipes
  -d, --dry-run         Show what would be processed without calling OpenAI
  -h, --help            Show this help message

Examples:
  npm run pipeline:batch-generate -- --channel LifeByMikeG
  npm run pipeline:batch-generate -- --channel LifeByMikeG --skip-existing
  npm run pipeline:batch-generate -- --channel LifeByMikeG --limit 5 --dry-run
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
    skipExisting: values['skip-existing'] ?? false,
    dryRun: values['dry-run'] ?? false,
  };
}

/**
 * Process a single video with two-stage generation
 */
async function processVideo(
  video: VideoListItem,
  model: string = 'gpt-4.1-nano',
  temperature: number = 0.3
): Promise<{ success: boolean; error?: string; recipeCount?: number; usedExistingTranscript?: boolean }> {
  // Load video metadata
  const metadata = await loadVideoMetadata(video.video_id);
  if (!metadata) {
    return { success: false, error: 'Video metadata not found' };
  }

  // First, check for existing cleaned transcript
  let cleanedTranscript = await loadCleanedTranscript(video.video_id);
  let transcriptText: string | null = null;
  let usedExistingTranscript = false;

  if (cleanedTranscript) {
    // Use existing cleaned transcript - construct transcript text from sections
    usedExistingTranscript = true;
    transcriptText = cleanedTranscript.sections
      .map(s => `[${Math.floor(s.startTime / 60)}:${(s.startTime % 60).toString().padStart(2, '0')}] ${s.text}`)
      .join(' ');
  } else {
    // No cleaned transcript - try to load raw transcript
    const rawVtt = await loadRawVtt(video.video_id);
    if (!rawVtt) {
      return { success: false, error: 'No transcript available (raw or cleaned)' };
    }

    // Parse transcript to timestamped text
    transcriptText = parseVttToTimestampedText(rawVtt);

    // Stage 1: Generate cleaned transcript with section IDs
    cleanedTranscript = await generateCleanTranscript(transcriptText, {
      model,
      temperature,
      description: metadata.description,
    });

    if (!cleanedTranscript) {
      return { success: false, error: 'Failed to generate cleaned transcript' };
    }
  }

  // Stage 2: Generate recipe from cleaned transcript with section_id references
  const videoMetadata = {
    id: metadata.id,
    fulltitle: metadata.fulltitle || metadata.title || video.video_id,
    description: metadata.description || '',
    webpage_url: metadata.webpage_url || `https://www.youtube.com/watch?v=${video.video_id}`,
    upload_date: metadata.upload_date || '',
    duration: metadata.duration || 0,
  };

  const recipe = await generateRecipeFromCleanedTranscript(
    videoMetadata,
    cleanedTranscript,
    transcriptText,
    DEFAULT_RECIPE_PROMPT,
    { model, temperature }
  );

  if (!recipe) {
    return { success: false, error: 'No recipe could be extracted' };
  }

  // Attach the cleaned transcript to the recipe
  recipe.cleaned_transcript = cleanedTranscript;

  // Save as new version
  await saveNewVersion(video.video_id, recipe, {
    created_at: new Date().toISOString(),
    prompt_used: DEFAULT_RECIPE_PROMPT,
    model,
    temperature,
    generation_type: 'regenerated-2stage',
  });

  return {
    success: true,
    recipeCount: recipe.recipes?.length || 0,
    usedExistingTranscript,
  };
}

/**
 * Main function
 */
async function main() {
  const args = parseCliArgs();

  console.log('Batch Recipe Generation Pipeline (Supabase)');
  console.log('='.repeat(50));
  console.log(`Channel: ${args.channel}`);
  if (args.limit) console.log(`Limit: ${args.limit} videos`);
  if (args.skipExisting) console.log('Skip existing: enabled');
  if (args.dryRun) console.log('DRY RUN - no recipes will be generated');
  console.log();

  // Fetch all videos
  console.log('Fetching videos from Supabase...');
  const allVideos = await getAllVideosForListing();
  console.log(`Total videos in database: ${allVideos.length}`);

  // Filter by channel (case-insensitive match on channel name or handle)
  let videos = allVideos.filter((v) => {
    const channelName = v.channel_name?.toLowerCase() || '';
    const channelMatch = args.channel.toLowerCase();
    return channelName.includes(channelMatch);
  });
  console.log(`Videos from channel "${args.channel}": ${videos.length}`);

  // Filter to videos with transcripts
  const beforeTranscriptFilter = videos.length;
  videos = videos.filter((v) => v.has_transcript);
  if (videos.length !== beforeTranscriptFilter) {
    console.log(`After transcript filter: ${videos.length} videos (${beforeTranscriptFilter - videos.length} have no transcript)`);
  }

  // Apply skip existing
  if (args.skipExisting) {
    const before = videos.length;
    videos = videos.filter((v) => !v.has_recipe);
    console.log(`After skip existing: ${videos.length} videos (skipped ${before - videos.length} with recipes)`);
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
      const status = video.has_recipe ? '(has recipe)' : '(no recipe)';
      console.log(`  ${video.video_id} | ${video.title} ${status}`);
    }
    console.log();
    console.log(`Total: ${videos.length} videos would be processed`);
    return;
  }

  // Process videos
  let processed = 0;
  let success = 0;
  let errors = 0;
  const errorDetails: { videoId: string; title: string; error: string }[] = [];

  for (const video of videos) {
    const index = processed + 1;
    console.log(`[${index}/${videos.length}] Processing ${video.video_id}...`);
    console.log(`  Title: ${video.title}`);

    try {
      const result = await processVideo(video);

      if (result.success) {
        const transcriptNote = result.usedExistingTranscript ? ' (used existing transcript)' : '';
        console.log(`  Success: ${result.recipeCount} recipe(s) extracted${transcriptNote}`);
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

  if (errorDetails.length > 0) {
    console.log();
    console.log('Error details:');
    for (const err of errorDetails) {
      console.log(`  ${err.videoId} | ${err.title}`);
      console.log(`    Error: ${err.error}`);
    }
  }
}

main().catch(console.error);
