#!/usr/bin/env npx tsx

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { gunzipSync } from 'zlib';
import { createClient } from '@supabase/supabase-js';

// Load .env.local from project root
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const RECIPES_GROUP_ID = '52f7d41b-490e-40d1-b5da-eb1d74ec2eae';
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

interface VideoWithRecipe {
  id: string;
  title: string;
  description: string;
  duration: number;
  view_count: number;
  upload_date: string;
  thumbnail: string;
  thumbnails: Array<{ url: string; width: number; height: number }>;
  channel: string;
  channel_id: string;
  channelSlug: string;
  recipes?: Array<Record<string, unknown>>;
  cleaned_transcript?: Record<string, unknown>;
}

interface RecipesData {
  videos: VideoWithRecipe[];
  metadata: {
    totalVideos: number;
    videosWithRecipes: number;
  };
}

interface ExistingRecord {
  id: string;
  metadata: Record<string, unknown> | null;
}

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

function loadRecipesData(): RecipesData {
  const dataPath = path.join(__dirname, '..', 'data', 'recipes-data.json.gz');

  if (!fs.existsSync(dataPath)) {
    throw new Error(`Recipes data file not found: ${dataPath}`);
  }

  console.log(`Loading recipes data from: ${dataPath}`);
  const compressed = fs.readFileSync(dataPath);
  const decompressed = gunzipSync(compressed);
  return JSON.parse(decompressed.toString('utf-8'));
}

function buildMetadata(video: VideoWithRecipe): Record<string, unknown> {
  return {
    type: 'youtube_video',
    youtube_video_id: video.id,
    youtube_title: video.title,
    youtube_url: `https://youtube.com/watch?v=${video.id}`,
    youtube_channel: video.channel,
    youtube_channel_id: video.channel_id,
    youtube_channel_handle: video.channelSlug,
    youtube_duration: video.duration,
    youtube_views: video.view_count,
    youtube_upload_date: video.upload_date,
    youtube_thumbnail: video.thumbnail,
    youtube_thumbnails: video.thumbnails,
    youtube_description: video.description,
    // Recipe data
    recipes: video.recipes || null,
    cleaned_transcript: video.cleaned_transcript || null,
  };
}

async function fetchExistingRecords(supabase: ReturnType<typeof createClient>): Promise<Map<string, ExistingRecord>> {
  console.log('Fetching existing content records...');

  const allRecords: ExistingRecord[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('content')
      .select('id, metadata')
      .eq('group_id', RECIPES_GROUP_ID)
      .eq('type', 'text')
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch existing records: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    allRecords.push(...data);
    console.log(`  Fetched ${allRecords.length} records...`);

    if (data.length < limit) {
      break;
    }

    offset += limit;
  }

  console.log(`Total existing records: ${allRecords.length}`);

  // Build lookup map: youtube_video_id -> { id, metadata }
  const map = new Map<string, ExistingRecord>();
  for (const record of allRecords) {
    const videoId = (record.metadata as Record<string, unknown>)?.youtube_video_id as string;
    if (videoId) {
      map.set(videoId, record);
    }
  }

  return map;
}

async function main() {
  console.log('='.repeat(50));
  console.log('Upsert Recipes to Supabase Content Table');
  console.log('='.repeat(50));
  console.log();

  const supabase = createSupabaseClient();

  // Load recipes data
  const recipesData = loadRecipesData();
  console.log(`Loaded ${recipesData.videos.length} videos`);
  console.log(`Videos with recipes: ${recipesData.metadata.videosWithRecipes}`);
  console.log();

  // Fetch existing records
  const existingMap = await fetchExistingRecords(supabase);
  console.log(`Found ${existingMap.size} existing records with video IDs`);
  console.log();

  // Process each video
  let updateCount = 0;
  let insertCount = 0;
  let errorCount = 0;
  let skipCount = 0;
  const total = recipesData.videos.length;

  console.log('Processing videos...');
  console.log();

  for (let i = 0; i < recipesData.videos.length; i++) {
    const video = recipesData.videos[i];
    const existing = existingMap.get(video.id);

    try {
      if (existing) {
        // Only update if there's recipe data to add
        if (video.recipes || video.cleaned_transcript) {
          const { error } = await supabase
            .from('content')
            .update({
              metadata: {
                ...(existing.metadata || {}),
                recipes: video.recipes || null,
                cleaned_transcript: video.cleaned_transcript || null,
              },
            })
            .eq('id', existing.id);

          if (error) {
            throw new Error(error.message);
          }
          updateCount++;
        } else {
          skipCount++;
        }
      } else {
        // Insert new record
        const { error } = await supabase.from('content').insert({
          type: 'text',
          data: video.title,
          group_id: RECIPES_GROUP_ID,
          user_id: SYSTEM_USER_ID,
          metadata: buildMetadata(video),
        });

        if (error) {
          throw new Error(error.message);
        }
        insertCount++;
      }

      // Progress logging every 100 videos
      if ((i + 1) % 100 === 0 || i === total - 1) {
        console.log(`Progress: ${i + 1}/${total} (${updateCount} updated, ${insertCount} inserted, ${skipCount} skipped, ${errorCount} errors)`);
      }
    } catch (error) {
      console.error(`  Error processing ${video.id}: ${(error as Error).message}`);
      errorCount++;
    }
  }

  console.log();
  console.log('='.repeat(50));
  console.log('Summary');
  console.log('='.repeat(50));
  console.log(`Total videos processed: ${total}`);
  console.log(`Updated: ${updateCount}`);
  console.log(`Inserted: ${insertCount}`);
  console.log(`Skipped (no recipe data): ${skipCount}`);
  console.log(`Errors: ${errorCount}`);
}

main().catch(console.error);
