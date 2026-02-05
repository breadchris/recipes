import * as fs from 'fs';
import * as path from 'path';
import Typesense from 'typesense';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(__dirname, '../.env.local') });

import type { Playlist } from '../lib/types';

const COLLECTION_NAME = 'playlists';

interface PlaylistIndex {
  playlists: Playlist[];
  meta: {
    buildTime: string;
    totalPlaylists: number;
  };
}

// Typesense document schema
interface TypesensePlaylistDocument {
  id: string;
  title: string;
  description: string;
  channelName: string;
  channelSlug: string;
  channel_id: string;
  url: string;
  video_count: number;
  video_ids: string[];
  thumbnails: string; // JSON stringified
}

function loadPlaylistIndex(): PlaylistIndex {
  const indexPath = path.join(__dirname, '../data/playlist-index.json');
  if (!fs.existsSync(indexPath)) {
    console.error('❌ Playlist index not found. Run: npx tsx scripts/build-playlist-index.ts');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
}

async function indexPlaylistsToTypesense() {
  console.log('🔍 Indexing playlists to Typesense...');

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

  // Load playlist index
  console.log('📊 Loading playlist index...');
  const playlistIndex = loadPlaylistIndex();
  console.log(`   Found ${playlistIndex.playlists.length} playlists`);

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
      { name: 'channel_id', type: 'string' as const },
      { name: 'url', type: 'string' as const },
      { name: 'video_count', type: 'int32' as const },
      { name: 'video_ids', type: 'string[]' as const },
      { name: 'thumbnails', type: 'string' as const }, // JSON stringified
    ],
  };

  await client.collections().create(schema);
  console.log('✅ Created collection schema');

  // Prepare documents for indexing
  const documents: TypesensePlaylistDocument[] = playlistIndex.playlists.map((playlist) => ({
    id: playlist.id,
    title: playlist.title || '',
    description: playlist.description || '',
    channelName: playlist.channelName || '',
    channelSlug: playlist.channelSlug || '',
    channel_id: playlist.channel_id || '',
    url: playlist.url || '',
    video_count: playlist.video_count || 0,
    video_ids: playlist.video_ids || [],
    thumbnails: JSON.stringify(playlist.thumbnails || []),
  }));

  // Batch import documents
  console.log('📇 Indexing playlists...');
  const BATCH_SIZE = 100;
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
      errors.forEach((e: any) => console.warn(`   - ${e.document?.id}: ${e.error}`));
    }

    console.log(`   Indexed ${indexed}/${documents.length} playlists...`);
  }

  console.log(`\n✅ Typesense playlist indexing complete!`);
  console.log(`📦 Collection: ${COLLECTION_NAME}`);
  console.log(`🎯 Indexed ${indexed} playlists with field boosting:`);
  console.log(`   - Title: 3x (via query_by_weights)`);
  console.log(`   - Description: 2x`);
  console.log(`   - Channel Name: 1x`);
}

// Run the indexing
indexPlaylistsToTypesense().catch((error) => {
  console.error('❌ Error indexing playlists to Typesense:', error);
  process.exit(1);
});
