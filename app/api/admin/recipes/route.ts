import { NextResponse } from 'next/server';
import { getVideosForListingPaginated } from '@/lib/admin/data/supabase-io';
import type { PaginatedRecipeListResponse } from '@/lib/types/admin';

/**
 * GET /api/admin/recipes
 * List videos with pagination and filtering
 * Query params:
 *   - page: number (default: 1) - current page
 *   - limit: number (default: 50) - items per page
 *   - search: string - text search (title, video_id, channel)
 *   - channel: channel_id - filter by channel
 *   - has_recipe: 'true' | 'false' - filter by recipe existence
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Pagination params
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    // Filter params
    const search = searchParams.get('search') || undefined;
    const channelId = searchParams.get('channel') || undefined;
    const hasRecipeParam = searchParams.get('has_recipe');
    const hasRecipe = hasRecipeParam === 'true' ? true :
                      hasRecipeParam === 'false' ? false : undefined;

    // Fetch paginated results
    const result = await getVideosForListingPaginated({
      page,
      limit,
      search,
      channelId,
      hasRecipe,
    });

    // Map to response format
    const response: PaginatedRecipeListResponse = {
      items: result.items.map(video => ({
        video_id: video.video_id,
        title: video.title,
        has_recipe: video.has_recipe,
        has_transcript: video.has_transcript,
        channel_name: video.channel_name,
        channel_id: video.channel_id,
      })),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error listing recipes:', error);
    return NextResponse.json(
      { error: 'Failed to list recipes' },
      { status: 500 }
    );
  }
}
