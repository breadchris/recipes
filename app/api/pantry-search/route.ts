import { NextRequest, NextResponse } from 'next/server';
import { searchByIngredients } from '@/lib/searchIndex';
import { getVideosByIds } from '@/lib/dataLoader';
import { typesenseClient, INGREDIENTS_COLLECTION_NAME } from '@/lib/typesense';

interface IngredientCategories {
  proteins: string[];
  vegetables: string[];
  pantryStaples: string[];
}

// Cache ingredient categories in memory
let cachedCategories: IngredientCategories | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 3600000; // 1 hour in milliseconds

async function loadIngredientCategories(): Promise<IngredientCategories> {
  // Check if cache is still valid
  if (cachedCategories && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedCategories;
  }

  try {
    // Fetch categories from Typesense using facet search
    const categories: IngredientCategories = {
      proteins: [],
      vegetables: [],
      pantryStaples: [],
    };

    // Fetch each category separately for efficiency
    const categoryTypes = ['proteins', 'vegetables', 'pantryStaples'] as const;

    for (const category of categoryTypes) {
      const searchResult = await typesenseClient
        .collections(INGREDIENTS_COLLECTION_NAME)
        .documents()
        .search({
          q: '*',
          query_by: 'name',
          filter_by: `category:${category}`,
          per_page: 250,
        });

      categories[category] = (searchResult.hits || []).map(
        (hit: any) => hit.document.name as string
      );
    }

    // Update cache
    cachedCategories = categories;
    cacheTimestamp = Date.now();

    return categories;
  } catch (error) {
    console.error('Error loading ingredient categories from Typesense:', error);
    // Return empty categories on error
    return {
      proteins: [],
      vegetables: [],
      pantryStaples: [],
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ingredientsParam = searchParams.get('ingredients');

    if (!ingredientsParam) {
      return NextResponse.json({ results: [], error: 'No ingredients provided' });
    }

    const userIngredients = ingredientsParam
      .split(',')
      .map((ing) => ing.trim().toLowerCase())
      .filter((ing) => ing.length > 0);

    if (userIngredients.length === 0) {
      return NextResponse.json({ results: [], error: 'No valid ingredients provided' });
    }

    const ingredientCategories = await loadIngredientCategories();

    // Use Typesense-based search
    const results = await searchByIngredients(
      userIngredients,
      { categories: ingredientCategories },
      24
    );

    // Bulk enrich results with recipe titles from source data
    const videoIds = results.map(video => video.id);
    const videoMap = await getVideosByIds(videoIds);

    const enrichedResults = results.map(video => {
      const fullVideo = videoMap.get(video.id);
      const recipeTitle = fullVideo?.recipes?.[0]?.title || '';
      return { ...video, recipeTitle };
    });

    return NextResponse.json({ results: enrichedResults });
  } catch (error) {
    console.error('Pantry search failed:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        results: [],
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        endpoint: '/api/pantry-search'
      },
      { status: 500 }
    );
  }
}
