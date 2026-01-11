import * as fs from 'fs';
import * as path from 'path';
import Typesense from 'typesense';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(__dirname, '../.env.local') });

const COLLECTION_NAME = 'scraped-recipes';

interface IngredientGroup {
  name: string | null;
  ingredients: string[];
}

interface ExtractionMetadata {
  recipe_id: string;
  yield?: string;
  time?: number | null;
  nutrients?: Record<string, unknown>;
}

interface ScrapedRecipe {
  name: string;
  source: string;
  image: string | null;
  recipe_directions: string[];
  recipe_ingredient_groups: IngredientGroup[];
  recipe_tags?: string[];
  video?: string;
  extraction_metadata: ExtractionMetadata;
}

// Lightweight document for Typesense search index (only searchable fields)
interface TypesenseScrapedDocument {
  id: string;
  name: string;
  source_domain: string;
  time_minutes: number;
}

// Full recipe data for separate lookup file
interface ScrapedRecipeLookup {
  id: string;
  name: string;
  source: string;
  source_domain: string;
  image: string;
  directions: string[];
  ingredients: string[];
  tags: string[];
  video: string;
  yield: string;
  time_minutes: number;
}

const SOURCE_CONFIGS: Record<string, { name: string; domain: string }> = {
  atk: { name: "America's Test Kitchen", domain: 'americastestkitchen.com' },
  nyt: { name: 'New York Times Cooking', domain: 'cooking.nytimes.com' },
  epicurious: { name: 'Epicurious', domain: 'epicurious.com' },
  joshuaweissman: { name: 'Joshua Weissman', domain: 'joshuaweissman.com' },
};

function extractIngredients(groups: IngredientGroup[]): string[] {
  const ingredients: string[] = [];
  for (const group of groups) {
    for (const ing of group.ingredients) {
      ingredients.push(ing.toLowerCase().trim());
    }
  }
  return ingredients;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

async function indexScrapedRecipes() {
  console.log('🔍 Indexing scraped recipes to Typesense...');

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

  // Delete existing collection if it exists
  try {
    await client.collections(COLLECTION_NAME).delete();
    console.log('🗑️  Deleted existing collection');
  } catch (error: unknown) {
    const typesenseError = error as { httpStatus?: number };
    if (typesenseError.httpStatus !== 404) {
      throw error;
    }
  }

  // Create collection schema - lightweight, only fields needed for search
  const schema = {
    name: COLLECTION_NAME,
    fields: [
      { name: 'id', type: 'string' as const },
      { name: 'name', type: 'string' as const },
      { name: 'source_domain', type: 'string' as const, facet: true },
      { name: 'time_minutes', type: 'int32' as const, facet: true },
    ],
  };

  await client.collections().create(schema);
  console.log('✅ Created collection schema');

  // Load and process all scraped recipes
  const scrapeDir = path.join(__dirname, '../data/scrape');
  const sources = fs.readdirSync(scrapeDir).filter((dir) => {
    const fullPath = path.join(scrapeDir, dir);
    return fs.statSync(fullPath).isDirectory();
  });

  console.log(`📂 Found sources: ${sources.join(', ')}`);

  const documents: TypesenseScrapedDocument[] = [];
  const lookupData: Record<string, ScrapedRecipeLookup> = {};
  let totalProcessed = 0;

  for (const source of sources) {
    const sourceDir = path.join(scrapeDir, source);
    const files = fs.readdirSync(sourceDir).filter((f) => f.endsWith('.json'));
    const sourceConfig = SOURCE_CONFIGS[source] || { name: source, domain: source };

    console.log(`📖 Processing ${source}: ${files.length} recipes`);

    for (const file of files) {
      try {
        const filePath = path.join(sourceDir, file);
        const data: ScrapedRecipe = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        const id = `${source}_${data.extraction_metadata?.recipe_id || file.replace('.json', '')}`;
        const ingredients = extractIngredients(data.recipe_ingredient_groups || []);
        const directions = (data.recipe_directions || []).map(stripHtml);
        const sourceDomain = extractDomain(data.source) || sourceConfig.domain;
        const timeMinutes = data.extraction_metadata?.time || 0;

        // Lightweight document for Typesense (search only)
        const doc: TypesenseScrapedDocument = {
          id,
          name: data.name || '',
          source_domain: sourceDomain,
          time_minutes: timeMinutes,
        };

        // Full recipe data for lookup file
        const fullRecipe: ScrapedRecipeLookup = {
          id,
          name: data.name || '',
          source: data.source || '',
          source_domain: sourceDomain,
          image: data.image || '',
          directions,
          ingredients,
          tags: data.recipe_tags || [],
          video: data.video || '',
          yield: data.extraction_metadata?.yield || '',
          time_minutes: timeMinutes,
        };

        documents.push(doc);
        lookupData[id] = fullRecipe;
        totalProcessed++;

        if (totalProcessed % 5000 === 0) {
          console.log(`   Processed ${totalProcessed} recipes...`);
        }
      } catch (err) {
        console.warn(`⚠️  Failed to parse ${source}/${file}:`, err);
      }
    }
  }

  // Write lookup data to file
  const lookupPath = path.join(__dirname, '../data/scraped-recipes-lookup.json');
  fs.writeFileSync(lookupPath, JSON.stringify(lookupData));
  console.log(`💾 Wrote lookup data to ${lookupPath}`);

  // Also create gzipped version for production
  const { execSync } = require('child_process');
  execSync(`gzip -kf "${lookupPath}"`);
  console.log(`💾 Created gzipped lookup: ${lookupPath}.gz`);

  console.log(`\n📊 Total recipes to index: ${documents.length}`);

  // Batch import documents
  console.log('📇 Indexing recipes...');
  const BATCH_SIZE = 1000;
  let indexed = 0;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);

    try {
      const results = await client.collections(COLLECTION_NAME).documents().import(batch, { action: 'create', dirty_values: 'coerce_or_reject' }) as { success: boolean; error?: string }[];

      // Count successful imports
      const successful = results.filter((r) => r.success).length;
      indexed += successful;

      // Log any errors
      const errors = results.filter((r) => !r.success);
      if (errors.length > 0) {
        console.warn(`⚠️  ${errors.length} documents failed in batch ${Math.floor(i / BATCH_SIZE) + 1}`);
        errors.slice(0, 3).forEach((e) => console.warn(`   ${e.error}`));
      }
    } catch (err: unknown) {
      // Handle ImportError which contains partial success info
      const importErr = err as { importResults?: { success: boolean }[]; message?: string };
      if (importErr.importResults) {
        const successful = importErr.importResults.filter((r) => r.success).length;
        indexed += successful;
        console.warn(`⚠️  Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${successful}/${batch.length} succeeded`);
      } else {
        console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, importErr.message);
      }
    }

    console.log(`   Indexed ${indexed}/${documents.length} recipes...`);
  }

  console.log(`\n✅ Typesense indexing complete!`);
  console.log(`📦 Collection: ${COLLECTION_NAME}`);
  console.log(`🎯 Indexed ${indexed} scraped recipes`);

  // Print breakdown by source
  console.log('\n📊 Breakdown by source:');
  for (const source of sources) {
    const count = documents.filter((d) => d.id.startsWith(`${source}_`)).length;
    const config = SOURCE_CONFIGS[source];
    console.log(`   - ${config?.name || source}: ${count}`);
  }
}

// Run the indexing
indexScrapedRecipes().catch((error) => {
  console.error('❌ Error indexing to Typesense:', error);
  process.exit(1);
});
