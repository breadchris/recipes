import { NextRequest, NextResponse } from 'next/server';
import { searchVideos } from '@/lib/searchIndex';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const hasRecipeOnly = searchParams.get('hasRecipe') === 'true';

  if (!query || query.trim().length === 0) {
    return NextResponse.json([]);
  }

  // Use MiniSearch with field boosting and channel prioritization
  // Title (3x) > Description (1x) > Channel Name (0.5x)
  // Plus channel priority multipliers from priority-channels.json
  const results = searchVideos(query, 100, hasRecipeOnly);

  return NextResponse.json(results);
}
