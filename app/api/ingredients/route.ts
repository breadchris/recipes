import { NextResponse } from 'next/server';
import { typesenseClient, INGREDIENTS_COLLECTION_NAME } from '@/lib/typesense';

interface IngredientDocument {
  id: string;
  name: string;
  category: string;
  count: number;
}

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
    totalIngredients: number;
  };
}

// Cache the ingredient index in memory
let cachedIndex: IngredientIndex | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 3600000; // 1 hour in milliseconds

async function fetchIngredientIndex(): Promise<IngredientIndex> {
  // Check if cache is still valid
  if (cachedIndex && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedIndex;
  }

  try {
    // Fetch all ingredients from Typesense
    const allIngredients: IngredientDocument[] = [];
    let page = 1;
    const perPage = 250;
    let hasMore = true;

    while (hasMore) {
      const searchResult = await typesenseClient
        .collections(INGREDIENTS_COLLECTION_NAME)
        .documents()
        .search({
          q: '*',
          query_by: 'name',
          per_page: perPage,
          page: page,
          sort_by: 'count:desc',
        });

      const docs = (searchResult.hits || []).map((hit: any) => hit.document as IngredientDocument);
      allIngredients.push(...docs);

      hasMore = docs.length === perPage;
      page++;
    }

    // Build the ingredient index structure
    const ingredients: string[] = [];
    const counts: Record<string, number> = {};
    const categories: IngredientIndex['categories'] = {
      proteins: [],
      vegetables: [],
      pantryStaples: [],
      other: [],
    };

    for (const doc of allIngredients) {
      ingredients.push(doc.name);
      counts[doc.name] = doc.count;

      // Add to appropriate category array
      if (doc.category === 'proteins') {
        categories.proteins.push(doc.name);
      } else if (doc.category === 'vegetables') {
        categories.vegetables.push(doc.name);
      } else if (doc.category === 'pantryStaples') {
        categories.pantryStaples.push(doc.name);
      } else {
        categories.other.push(doc.name);
      }
    }

    const index: IngredientIndex = {
      ingredients,
      counts,
      categories,
      meta: {
        totalIngredients: ingredients.length,
      },
    };

    // Update cache
    cachedIndex = index;
    cacheTimestamp = Date.now();

    return index;
  } catch (error) {
    console.error('Error fetching ingredients from Typesense:', error);
    throw error;
  }
}

export async function GET() {
  try {
    const index = await fetchIngredientIndex();
    return NextResponse.json(index);
  } catch (error) {
    console.error('Failed to load ingredient index:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: 'Failed to load ingredient index',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        endpoint: '/api/ingredients'
      },
      { status: 500 }
    );
  }
}
