import { typesenseClient, COLLECTION_NAME } from './typesense';
import { VideoWithChannel } from './types';

/**
 * Search videos using Typesense with field boosting and channel prioritization
 * @param query - The search query
 * @param limit - Maximum number of results to return (default: 100)
 * @param hasRecipeOnly - If true, only return videos with recipes
 * @returns Array of videos sorted by relevance
 */
export async function searchVideos(
  query: string,
  limit: number = 100,
  hasRecipeOnly: boolean = false
): Promise<VideoWithChannel[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  try {
    const searchParameters: any = {
      q: query,
      query_by: 'title,description,channelName',
      query_by_weights: '3,1,1', // Title: 3x, Description: 1x, Channel: 1x
      sort_by: '_text_match:desc,priorityBoost:desc',
      per_page: limit,
      prefix: true,
      typo_tolerance: true,
      num_typos: 2,
    };

    // Add filter for hasRecipe if requested
    if (hasRecipeOnly) {
      searchParameters.filter_by = 'hasRecipe:true';
    }

    const searchResult = await typesenseClient
      .collections(COLLECTION_NAME)
      .documents()
      .search(searchParameters);

    // Transform Typesense results to VideoWithChannel format
    const videos: VideoWithChannel[] = (searchResult.hits || []).map((hit: any) => {
      const doc = hit.document;
      return {
        id: doc.id,
        title: doc.title,
        description: doc.description,
        duration: doc.duration,
        view_count: doc.view_count,
        upload_date: doc.upload_date,
        thumbnails: JSON.parse(doc.thumbnails || '[]'),
        channel: doc.channel,
        channel_id: doc.channel_id,
        channelSlug: doc.channelSlug,
        channelName: doc.channelName,
        channelFollowers: doc.channelFollowers,
        hasRecipe: doc.hasRecipe,
      } as VideoWithChannel;
    });

    return videos;
  } catch (error) {
    console.error('❌ Typesense search error:', error);
    return [];
  }
}

/**
 * Get priority channels configuration
 * Note: Priority channels are now baked into the priorityBoost field in Typesense
 */
export function getPriorityChannels(): Record<string, number> {
  // Return empty object since priority is now handled via priorityBoost field
  return {};
}
