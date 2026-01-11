import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import Typesense from 'typesense';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(__dirname, '../.env.local') });

const COLLECTION_NAME = 'recipes';

interface Video {
  id: string;
  title: string;
  description: string;
  duration: number;
  view_count: number;
  upload_date: string;
  thumbnails: any[];
  channel: string;
  channel_id: string;
  channelSlug: string;
  recipes?: any[];
}

interface VideoWithChannel extends Video {
  channelName: string;
  channelFollowers: number;
  hasRecipe: boolean;
}

interface Channel {
  channel: string;
  channelSlug: string;
  channel_id: string;
  channel_follower_count: number;
}

interface RecipesData {
  videos: Video[];
  channels: Channel[];
}

interface PriorityConfig {
  channels: Record<string, number>;
}

// Typesense document schema
interface TypesenseDocument {
  id: string;
  title: string;
  description: string;
  channelName: string;
  channelSlug: string;
  channel: string;
  channel_id: string;
  channelFollowers: number;
  duration: number;
  view_count: number;
  upload_date: string;
  thumbnails: string; // JSON stringified
  hasRecipe: boolean;
  priorityBoost: number;
  // Recipe metadata for discovery
  difficulty: string;
  total_time_minutes: number;
  ingredients: string[];
  tags: string[]; // Unified tag system
}

interface TagIndex {
  videoTags: Record<string, string[]>;
  tagStats: Record<string, number>;
  meta: {
    buildTime: string;
    totalVideos: number;
    taggedVideos: number;
    coveragePercent: number;
  };
}

async function indexToTypesense() {
  console.log('🔍 Indexing recipes to Typesense...');

  // Validate environment variables
  const host = process.env.TYPESENSE_HOST;
  const apiKey = process.env.TYPESENSE_ADMIN_API_KEY;

  if (!host || !apiKey) {
    console.error('❌ Missing TYPESENSE_HOST or TYPESENSE_ADMIN_API_KEY environment variables');
    process.exit(1);
  }

  // Initialize Typesense client
  const client = new Typesense.Client({
    nodes: [
      {
        host,
        port: parseInt(process.env.TYPESENSE_PORT || '443'),
        protocol: process.env.TYPESENSE_PROTOCOL || 'https',
      },
    ],
    apiKey,
    connectionTimeoutSeconds: 10,
  });

  // Load recipes data
  const dataPath = path.join(__dirname, '../data/recipes-data.json.gz');
  const compressedData = fs.readFileSync(dataPath);
  const decompressedData = zlib.gunzipSync(compressedData);
  const recipesData: RecipesData = JSON.parse(decompressedData.toString());

  console.log(`📊 Loaded ${recipesData.videos.length} videos and ${recipesData.channels.length} channels`);

  // Load priority channels config
  const priorityConfigPath = path.join(__dirname, '../data/priority-channels.json');
  let priorityConfig: PriorityConfig = { channels: {} };

  if (fs.existsSync(priorityConfigPath)) {
    priorityConfig = JSON.parse(fs.readFileSync(priorityConfigPath, 'utf-8'));
    console.log(`⭐ Loaded priority config for ${Object.keys(priorityConfig.channels).length} channels`);
  }

  // Load tag index
  const tagIndexPath = path.join(__dirname, '../data/tag-index.json');
  let tagIndex: TagIndex = { videoTags: {}, tagStats: {}, meta: { buildTime: '', totalVideos: 0, taggedVideos: 0, coveragePercent: 0 } };

  if (fs.existsSync(tagIndexPath)) {
    tagIndex = JSON.parse(fs.readFileSync(tagIndexPath, 'utf-8'));
    console.log(`🏷️  Loaded tag index for ${tagIndex.meta.taggedVideos} videos (${tagIndex.meta.coveragePercent}% coverage)`);
  } else {
    console.warn('⚠️  Tag index not found. Run: npx tsx scripts/build-tag-index.ts');
  }

  // Create channel lookup map
  const channelMap = new Map<string, Channel>();
  recipesData.channels.forEach((channel) => {
    channelMap.set(channel.channel_id, channel);
  });

  // Delete existing collection if it exists
  try {
    await client.collections(COLLECTION_NAME).delete();
    console.log('🗑️  Deleted existing collection');
  } catch (error: any) {
    if (error.httpStatus !== 404) {
      throw error;
    }
  }

  // Create collection schema
  const schema = {
    name: COLLECTION_NAME,
    fields: [
      { name: 'id', type: 'string' as const },
      { name: 'title', type: 'string' as const },
      { name: 'description', type: 'string' as const },
      { name: 'channelName', type: 'string' as const, facet: true },
      { name: 'channelSlug', type: 'string' as const },
      { name: 'channel', type: 'string' as const },
      { name: 'channel_id', type: 'string' as const },
      { name: 'channelFollowers', type: 'int32' as const },
      { name: 'duration', type: 'int32' as const },
      { name: 'view_count', type: 'int64' as const },
      { name: 'upload_date', type: 'string' as const },
      { name: 'thumbnails', type: 'string' as const }, // JSON stringified
      { name: 'hasRecipe', type: 'bool' as const, facet: true },
      { name: 'priorityBoost', type: 'int32' as const },
      // Recipe metadata for discovery features
      { name: 'difficulty', type: 'string' as const, facet: true },
      { name: 'total_time_minutes', type: 'int32' as const, facet: true },
      { name: 'ingredients', type: 'string[]' as const }, // For pantry matching
      { name: 'tags', type: 'string[]' as const, facet: true }, // Unified tag system
    ],
  };

  await client.collections().create(schema);
  console.log('✅ Created collection schema');

  // Extract ingredient names (just the item, normalized)
  const extractIngredients = (recipes: any[] | undefined): string[] => {
    if (!recipes) return [];
    const ingredients = new Set<string>();
    recipes.forEach((recipe) => {
      if (recipe.ingredients && Array.isArray(recipe.ingredients)) {
        recipe.ingredients.forEach((ing: any) => {
          if (ing.item) {
            // Normalize: lowercase, trim
            ingredients.add(ing.item.toLowerCase().trim());
          }
        });
      }
    });
    return Array.from(ingredients);
  };

  // Get the best difficulty from recipes (prefer the first recipe's difficulty)
  const getDifficulty = (recipes: any[] | undefined): string => {
    if (!recipes || recipes.length === 0) return '';
    for (const recipe of recipes) {
      if (recipe.difficulty) return recipe.difficulty;
    }
    return '';
  };

  // Get total time (use the first recipe with a total_time, or compute max)
  const getTotalTime = (recipes: any[] | undefined): number => {
    if (!recipes || recipes.length === 0) return 0;
    for (const recipe of recipes) {
      if (recipe.total_time_minutes) return recipe.total_time_minutes;
    }
    return 0;
  };

  // Prepare documents for indexing
  const documents: TypesenseDocument[] = recipesData.videos.map((video) => {
    const channel = channelMap.get(video.channel_id);
    const channelSlug = video.channelSlug || channel?.channelSlug || '';
    const priorityBoost = priorityConfig.channels[channelSlug] ? 2 : 1;

    return {
      id: video.id,
      title: video.title || '',
      description: video.description || '',
      channelName: channel?.channel || '',
      channelSlug,
      channel: video.channel || '',
      channel_id: video.channel_id || '',
      channelFollowers: channel?.channel_follower_count || 0,
      duration: video.duration || 0,
      view_count: video.view_count || 0,
      upload_date: video.upload_date || '',
      thumbnails: JSON.stringify(video.thumbnails || []),
      hasRecipe: !!(video.recipes && video.recipes.length > 0),
      priorityBoost,
      // Recipe metadata for discovery
      difficulty: getDifficulty(video.recipes),
      total_time_minutes: getTotalTime(video.recipes),
      ingredients: extractIngredients(video.recipes),
      tags: tagIndex.videoTags[video.id] || [],
    };
  });

  // Batch import documents
  console.log('📇 Indexing videos...');
  const BATCH_SIZE = 1000;
  let indexed = 0;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const results = await client.collections(COLLECTION_NAME).documents().import(batch, { action: 'create' });

    // Count successful imports
    const successful = results.filter((r: any) => r.success).length;
    indexed += successful;

    // Log any errors
    const errors = results.filter((r: any) => !r.success);
    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} documents failed in batch ${Math.floor(i / BATCH_SIZE) + 1}`);
    }

    console.log(`   Indexed ${indexed}/${documents.length} videos...`);
  }

  console.log(`\n✅ Typesense indexing complete!`);
  console.log(`📦 Collection: ${COLLECTION_NAME}`);
  console.log(`🎯 Indexed ${indexed} videos with field boosting:`);
  console.log(`   - Title: 3x (via query_by_weights)`);
  console.log(`   - Description: 1x`);
  console.log(`   - Channel Name: 1x`);

  if (Object.keys(priorityConfig.channels).length > 0) {
    console.log(`⭐ Priority channels configured (priorityBoost=2):`);
    Object.keys(priorityConfig.channels).forEach((slug) => {
      console.log(`   - ${slug}`);
    });
  }
}

// Run the indexing
indexToTypesense().catch((error) => {
  console.error('❌ Error indexing to Typesense:', error);
  process.exit(1);
});
