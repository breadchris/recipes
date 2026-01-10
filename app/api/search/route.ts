import { NextRequest, NextResponse } from 'next/server';
import { searchVideos } from '@/lib/searchIndex';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const hasRecipeOnly = searchParams.get('hasRecipe') === 'true';

    if (!query || query.trim().length === 0) {
      return NextResponse.json([]);
    }

    // Use Typesense with field boosting and channel prioritization
    // Title (3x) > Description (1x) > Channel Name (1x)
    // Plus channel priority boost via priorityBoost field
    const results = await searchVideos(query, 100, hasRecipeOnly);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Search API error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: 'Failed to search videos',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        endpoint: '/api/search'
      },
      { status: 500 }
    );
  }
}
