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
  recipe?: any;
}

interface VideoWithChannel extends Video {
  channelName: string;
  channelFollowers: number;
  hasRecipe: boolean;
}

interface Channel {
  name: string;
  slug: string;
  id: string;
  followers: number;
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

  // Create channel lookup map
  const channelMap = new Map<string, Channel>();
  recipesData.channels.forEach((channel) => {
    channelMap.set(channel.id, channel);
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
    ],
  };

  await client.collections().create(schema);
  console.log('✅ Created collection schema');

  // Prepare documents for indexing
  const documents: TypesenseDocument[] = recipesData.videos.map((video) => {
    const channel = channelMap.get(video.channel_id);
    const channelSlug = video.channelSlug || channel?.slug || '';
    const priorityBoost = priorityConfig.channels[channelSlug] ? 2 : 1;

    return {
      id: video.id,
      title: video.title || '',
      description: video.description || '',
      channelName: channel?.name || '',
      channelSlug,
      channel: video.channel || '',
      channel_id: video.channel_id || '',
      channelFollowers: channel?.followers || 0,
      duration: video.duration || 0,
      view_count: video.view_count || 0,
      upload_date: video.upload_date || '',
      thumbnails: JSON.stringify(video.thumbnails || []),
      hasRecipe: !!video.recipe,
      priorityBoost,
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
