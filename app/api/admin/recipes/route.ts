import { NextResponse } from 'next/server';
import { getAllVideoIds, loadVideoMetadata, recipeExists, hasTranscript } from '@/lib/admin/data/file-io';
import { isLegacyFormat, loadCurrentVersion } from '@/lib/admin/data/recipe-versions';
import type { RecipeListItem } from '@/lib/types/admin';

/**
 * GET /api/admin/recipes
 * List all videos in the youtube-cache
 * Query params:
 *   - has_recipe: 'true' | 'false' - filter by recipe existence
 *   - has_transcript: 'true' | 'false' - filter by transcript existence
 *   - has_keywords: 'true' - only show recipes with keyword support (legacy behavior)
 *   - channel: channel_id - filter by channel
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filterHasRecipe = searchParams.get('has_recipe');
    const filterHasTranscript = searchParams.get('has_transcript');
    const filterHasKeywords = searchParams.get('has_keywords') === 'true';
    const filterChannel = searchParams.get('channel');

    const videoIds = await getAllVideoIds();
    const recipes: RecipeListItem[] = [];

    for (const videoId of videoIds) {
      // Load metadata to get the title and channel info
      const metadata = await loadVideoMetadata(videoId);
      const title = metadata?.fulltitle || metadata?.title || videoId;
      const channelName = metadata?.channel;
      const channelId = metadata?.channel_id;

      // Check if recipe exists
      const hasRecipeFlag = recipeExists(videoId);
      const hasTranscriptFlag = hasTranscript(videoId);

      // Apply filters
      if (filterHasRecipe === 'true' && !hasRecipeFlag) continue;
      if (filterHasRecipe === 'false' && hasRecipeFlag) continue;
      if (filterHasTranscript === 'true' && !hasTranscriptFlag) continue;
      if (filterHasTranscript === 'false' && hasTranscriptFlag) continue;
      if (filterChannel && channelId !== filterChannel) continue;

      // Legacy behavior: filter for keyword support
      if (filterHasKeywords && hasRecipeFlag) {
        const isLegacy = await isLegacyFormat(videoId);
        if (isLegacy) continue;

        const versioned = await loadCurrentVersion(videoId);
        if (!versioned?.recipe?.recipes?.[0]?.instructions?.[0]?.keywords) {
          continue;
        }
      }

      recipes.push({
        video_id: videoId,
        title,
        has_recipe: hasRecipeFlag,
        channel_name: channelName,
        channel_id: channelId,
      });
    }

    return NextResponse.json(recipes);
  } catch (error) {
    console.error('Error listing recipes:', error);
    return NextResponse.json(
      { error: 'Failed to list recipes' },
      { status: 500 }
    );
  }
}
