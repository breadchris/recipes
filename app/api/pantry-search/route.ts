import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { searchByIngredients } from '@/lib/searchIndex';
import { getVideoById } from '@/lib/dataLoader';

interface IngredientIndex {
  categories: {
    proteins: string[];
    vegetables: string[];
    pantryStaples: string[];
  };
}

// Cache ingredient index in memory (only 228KB)
let cachedIngredientIndex: IngredientIndex | null = null;

function loadIngredientIndex(): IngredientIndex {
  if (cachedIngredientIndex) return cachedIngredientIndex;

  const indexPath = path.join(process.cwd(), 'data', 'ingredient-index.json');
  const indexData = fs.readFileSync(indexPath, 'utf-8');
  cachedIngredientIndex = JSON.parse(indexData);
  return cachedIngredientIndex!;
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

    const ingredientIndex = loadIngredientIndex();

    // Use Typesense-based search instead of loading 32MB data file
    const results = await searchByIngredients(userIngredients, ingredientIndex, 24);

    // Enrich results with recipe titles from source data
    const enrichedResults = await Promise.all(
      results.map(async (video) => {
        try {
          const fullVideo = await getVideoById(video.id);
          const recipeTitle = fullVideo?.recipes?.[0]?.title || '';
          return { ...video, recipeTitle };
        } catch (error) {
          console.error(`Failed to enrich video ${video.id}:`, error);
          return { ...video, recipeTitle: '' };
        }
      })
    );

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
