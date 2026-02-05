import { NextRequest, NextResponse } from 'next/server';
import { browseVideos, SearchFilters } from '@/lib/searchIndex';
import { getVideosByIds } from '@/lib/dataLoader';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Build filters from query params
    const filters: SearchFilters = {
      hasRecipeOnly: true,
    };

    // tags can be comma-separated (unified tag system)
    const tags = searchParams.get('tags');
    if (tags) {
      filters.tags = tags.split(',');
    }

    // difficulty can be comma-separated
    const difficulty = searchParams.get('difficulty');
    if (difficulty) {
      filters.difficulty = difficulty.split(',');
    }

    // total_time_max is a number
    const totalTimeMax = searchParams.get('total_time_max');
    if (totalTimeMax) {
      filters.total_time_max = parseInt(totalTimeMax, 10);
    }

    // Limit (default 24)
    const limit = parseInt(searchParams.get('limit') || '24', 10);

    // Offset for pagination (default 0)
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const results = await browseVideos(filters, limit, offset);

    // Bulk enrich results with recipe titles from source data
    const videoIds = results.map(video => video.id);
    const videoMap = await getVideosByIds(videoIds);

    const enrichedResults = results.map(video => {
      const fullVideo = videoMap.get(video.id);
      const recipeTitle = fullVideo?.recipes?.[0]?.title || '';
      return { ...video, recipeTitle };
    });

    return NextResponse.json(enrichedResults);
  } catch (error) {
    console.error('Browse API error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: 'Failed to browse videos',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        endpoint: '/api/browse'
      },
      { status: 500 }
    );
  }
}
