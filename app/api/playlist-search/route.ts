import { NextRequest, NextResponse } from 'next/server';
import { searchPlaylists } from '@/lib/searchIndex';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query || query.trim().length === 0) {
      return NextResponse.json([]);
    }

    // Use Typesense with field boosting
    // Title (3x) > Description (2x) > Channel Name (1x)
    const results = await searchPlaylists(query, 50);

    return NextResponse.json(results);
  } catch (error) {
    console.error('Playlist search API error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: 'Failed to search playlists',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        endpoint: '/api/playlist-search'
      },
      { status: 500 }
    );
  }
}
