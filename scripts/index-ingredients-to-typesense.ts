import * as fs from 'fs';
import * as path from 'path';
import Typesense from 'typesense';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(__dirname, '../.env.local') });

const COLLECTION_NAME = 'ingredients';

interface IngredientIndex {
  ingredients: string[];
  counts: Record<string, number>;
  categories: {
    proteins: string[];
    vegetables: string[];
    pantryStaples: string[];
    other: string[];
  };
  meta: {
    buildTime: string;
    totalIngredients: number;
  };
}

// Typesense document schema
interface TypesenseIngredientDocument {
  id: string;
  name: string;
  category: string; // proteins, vegetables, pantryStaples, other
  count: number;
}

function loadIngredientIndex(): IngredientIndex {
  const indexPath = path.join(__dirname, '../data/ingredient-index.json');
  if (!fs.existsSync(indexPath)) {
    console.error('❌ Ingredient index not found. Run: npx tsx scripts/build-ingredient-index.ts');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
}

function determineCategory(
  ingredient: string,
  categories: IngredientIndex['categories']
): string {
  const normalized = ingredient.toLowerCase().trim();

  if (categories.proteins.some(p => p.toLowerCase() === normalized)) {
    return 'proteins';
  }
  if (categories.vegetables.some(v => v.toLowerCase() === normalized)) {
    return 'vegetables';
  }
  if (categories.pantryStaples.some(s => s.toLowerCase() === normalized)) {
    return 'pantryStaples';
  }
  if (categories.other?.some(o => o.toLowerCase() === normalized)) {
    return 'other';
  }

  // Default to other if not in any category
  return 'other';
}

async function indexIngredientsToTypesense() {
  console.log('🔍 Indexing ingredients to Typesense...');

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

  // Load ingredient index
  console.log('📊 Loading ingredient index...');
  const ingredientIndex = loadIngredientIndex();
  console.log(`   Found ${ingredientIndex.ingredients.length} ingredients`);

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
      { name: 'name', type: 'string' as const },
      { name: 'category', type: 'string' as const, facet: true },
      { name: 'count', type: 'int32' as const },
    ],
  };

  await client.collections().create(schema);
  console.log('✅ Created collection schema');

  // Prepare documents for indexing (handle duplicate IDs)
  const seenIds = new Set<string>();
  const documents: TypesenseIngredientDocument[] = ingredientIndex.ingredients.map((ingredient) => {
    // Create a URL-safe ID from the ingredient name
    let id = ingredient
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!id) {
      id = `ing-${Math.random().toString(36).substr(2, 9)}`;
    }

    // Handle duplicate IDs by appending a counter
    let uniqueId = id;
    let counter = 1;
    while (seenIds.has(uniqueId)) {
      uniqueId = `${id}-${counter}`;
      counter++;
    }
    seenIds.add(uniqueId);

    return {
      id: uniqueId,
      name: ingredient,
      category: determineCategory(ingredient, ingredientIndex.categories),
      count: ingredientIndex.counts[ingredient] || 0,
    };
  });

  // Batch import documents
  console.log('📇 Indexing ingredients...');
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

    console.log(`   Indexed ${indexed}/${documents.length} ingredients...`);
  }

  // Log category distribution
  const categoryCount = documents.reduce((acc, doc) => {
    acc[doc.category] = (acc[doc.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log(`\n✅ Typesense ingredient indexing complete!`);
  console.log(`📦 Collection: ${COLLECTION_NAME}`);
  console.log(`🎯 Indexed ${indexed} ingredients:`);
  console.log(`   - Proteins: ${categoryCount.proteins || 0}`);
  console.log(`   - Vegetables: ${categoryCount.vegetables || 0}`);
  console.log(`   - Pantry Staples: ${categoryCount.pantryStaples || 0}`);
  console.log(`   - Other: ${categoryCount.other || 0}`);
}

// Run the indexing
indexIngredientsToTypesense().catch((error) => {
  console.error('❌ Error indexing ingredients to Typesense:', error);
  process.exit(1);
});
