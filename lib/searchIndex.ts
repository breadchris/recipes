import MiniSearch from 'minisearch';
import * as fs from 'fs';
import * as path from 'path';
import { VideoWithChannel } from './types';

interface SerializedSearchIndex {
  index: any;
  priorityChannels: Record<string, number>;
  buildTime: string;
  videoCount: number;
}

let searchIndex: MiniSearch<VideoWithChannel> | null = null;
let priorityChannels: Record<string, number> = {};

/**
 * Loads the pre-built search index from disk
 * This only happens once per serverless function instance (cached in memory)
 */
export function getSearchIndex(): MiniSearch<VideoWithChannel> {
  if (searchIndex) {
    return searchIndex;
  }

  try {
    const indexPath = path.join(process.cwd(), 'data/search-index.json');
    const indexData: SerializedSearchIndex = JSON.parse(
      fs.readFileSync(indexPath, 'utf-8')
    );

    // Restore MiniSearch instance from serialized data
    searchIndex = MiniSearch.loadJSON<VideoWithChannel>(
      JSON.stringify(indexData.index),
      {
        fields: ['title', 'description', 'channelName'],
        storeFields: [
          'id',
          'title',
          'description',
          'duration',
          'view_count',
          'upload_date',
          'thumbnails',
          'channel',
          'channel_id',
          'channelSlug',
          'channelName',
          'channelFollowers',
          'hasRecipe',
        ],
        searchOptions: {
          boost: {
            title: 3,
            description: 1,
            channelName: 0.5,
          },
          fuzzy: 0.2,
          prefix: true,
        },
      }
    );

    // Load priority channels config
    priorityChannels = indexData.priorityChannels || {};

    console.log(`✅ Search index loaded (${indexData.videoCount} videos, built: ${indexData.buildTime})`);

    return searchIndex;
  } catch (error) {
    console.error('❌ Failed to load search index:', error);
    throw new Error('Search index not found. Run `npm run build:search` to generate it.');
  }
}

/**
 * Search videos with field boosting and channel prioritization
 * @param query - The search query
 * @param limit - Maximum number of results to return (default: 100)
 * @param hasRecipeOnly - If true, only return videos with recipes
 * @returns Array of videos sorted by relevance
 */
export function searchVideos(query: string, limit: number = 100, hasRecipeOnly: boolean = false): VideoWithChannel[] {
  const index = getSearchIndex();

  if (!query || query.trim().length === 0) {
    return [];
  }

  // Perform search
  const results = index.search(query, {
    boost: {
      title: 3,
      description: 1,
      channelName: 0.5,
    },
    fuzzy: 0.2,
    prefix: true,
  });

  // Apply channel priority multipliers and sort
  let rankedResults = results
    .map((result) => {
      const channelBoost = priorityChannels[result.channelSlug] || 1.0;
      return {
        ...result,
        score: result.score * channelBoost,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Filter by hasRecipe if requested
  if (hasRecipeOnly) {
    rankedResults = rankedResults.filter((result: any) => result.hasRecipe);
  }

  rankedResults = rankedResults.slice(0, limit);

  // Return video objects without search metadata
  return rankedResults.map((result) => {
    const { score, ...video } = result as any;
    return video as VideoWithChannel;
  });
}

/**
 * Get priority channels configuration
 */
export function getPriorityChannels(): Record<string, number> {
  return priorityChannels;
}
