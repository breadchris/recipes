import * as fs from 'fs';
import * as path from 'path';
import Typesense from 'typesense';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(__dirname, '../.env.local') });

const COLLECTION_NAME = 'tag-stats';

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

// Typesense document schema
interface TypesenseTagDocument {
  id: string;
  tag: string;
  count: number;
}

function loadTagIndex(): TagIndex {
  const indexPath = path.join(__dirname, '../data/tag-index.json');
  if (!fs.existsSync(indexPath)) {
    console.error('❌ Tag index not found. Run: npx tsx scripts/build-tag-index.ts');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
}

async function indexTagsToTypesense() {
  console.log('🔍 Indexing tag statistics to Typesense...');

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

  // Load tag index
  console.log('📊 Loading tag index...');
  const tagIndex = loadTagIndex();
  const tagEntries = Object.entries(tagIndex.tagStats);
  console.log(`   Found ${tagEntries.length} tags`);

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
      { name: 'tag', type: 'string' as const },
      { name: 'count', type: 'int32' as const },
    ],
  };

  await client.collections().create(schema);
  console.log('✅ Created collection schema');

  // Prepare documents for indexing
  const documents: TypesenseTagDocument[] = tagEntries.map(([tag, count]) => ({
    id: tag,
    tag: tag,
    count: count,
  }));

  // Batch import documents
  console.log('📇 Indexing tags...');
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

    console.log(`   Indexed ${indexed}/${documents.length} tags...`);
  }

  console.log(`\n✅ Typesense tag indexing complete!`);
  console.log(`📦 Collection: ${COLLECTION_NAME}`);
  console.log(`🎯 Indexed ${indexed} tags`);
  console.log(`📈 Meta: ${tagIndex.meta.taggedVideos} tagged videos (${tagIndex.meta.coveragePercent}% coverage)`);
}

// Run the indexing
indexTagsToTypesense().catch((error) => {
  console.error('❌ Error indexing tags to Typesense:', error);
  process.exit(1);
});
