import { typesenseClient, COLLECTION_NAME } from './typesense';
import { VideoWithChannel } from './types';

export interface SearchFilters {
  hasRecipeOnly?: boolean;
  tags?: string[]; // Unified tag system
  difficulty?: string[];
  total_time_max?: number;
}

/**
 * Build Typesense filter_by string from filter options
 */
function buildFilterString(filters: SearchFilters): string {
  const filterParts: string[] = [];

  // Always require hasRecipe for entry point searches
  if (filters.hasRecipeOnly !== false) {
    filterParts.push('hasRecipe:true');
  }

  // Tags filter (OR within the array)
  if (filters.tags && filters.tags.length > 0) {
    filterParts.push(`tags:[${filters.tags.join(',')}]`);
  }

  // Difficulty filter (OR within the array)
  if (filters.difficulty && filters.difficulty.length > 0) {
    filterParts.push(`difficulty:[${filters.difficulty.join(',')}]`);
  }

  // Total time filter (less than or equal)
  if (filters.total_time_max) {
    filterParts.push(`total_time_minutes:>0 && total_time_minutes:<=${filters.total_time_max}`);
  }

  return filterParts.join(' && ');
}

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
 * Browse videos with filters (no search query required)
 * Used for entry point cards and filtered browsing
 * @param filters - Filter options
 * @param limit - Maximum number of results to return (default: 24)
 * @param offset - Number of results to skip for pagination (default: 0)
 * @returns Array of videos sorted by view count
 */
export async function browseVideos(
  filters: SearchFilters,
  limit: number = 24,
  offset: number = 0
): Promise<VideoWithChannel[]> {
  try {
    const filterString = buildFilterString({ ...filters, hasRecipeOnly: true });

    // Calculate page number from offset (Typesense pages are 1-indexed)
    const page = Math.floor(offset / limit) + 1;

    const searchParameters: any = {
      q: '*', // Match all documents
      query_by: 'title',
      filter_by: filterString || 'hasRecipe:true',
      sort_by: 'view_count:desc,priorityBoost:desc', // Sort by popularity
      per_page: limit,
      page: page,
    };

    console.log('Typesense browse query:', {
      filterString,
      searchParameters,
      filters,
      limit,
      offset,
      page
    });

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
    console.error('❌ Typesense browse error:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      filters,
      filterString: buildFilterString({ ...filters, hasRecipeOnly: true }),
      limit,
      offset,
    });
    // Re-throw the error so the route handler can catch it and return proper error response
    throw error;
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

export interface PantryMatchResult extends VideoWithChannel {
  matchScore: number;
  matchedIngredients: string[];
  totalIngredients: number;
  missingIngredients: string[];
}

interface IngredientIndex {
  categories: {
    proteins: string[];
    vegetables: string[];
    pantryStaples: string[];
  };
}

/**
 * Search for recipes by ingredients (pantry mode)
 * Uses Typesense to find recipes matching user's available ingredients
 * @param userIngredients - Array of ingredient names the user has
 * @param ingredientIndex - Ingredient categorization for weighted scoring
 * @param limit - Maximum number of results to return (default: 24)
 * @returns Array of videos with match scores and ingredient details
 */
export async function searchByIngredients(
  userIngredients: string[],
  ingredientIndex: IngredientIndex,
  limit: number = 24
): Promise<PantryMatchResult[]> {
  if (!userIngredients || userIngredients.length === 0) {
    return [];
  }

  try {
    // Normalize user ingredients
    const normalizedUserIngredients = userIngredients.map(ing =>
      ing.toLowerCase().trim().replace(/\s+/g, ' ')
    );

    // Search for recipes containing any of the user's ingredients
    const searchQuery = normalizedUserIngredients.join(' ');

    const searchParameters: any = {
      q: searchQuery,
      query_by: 'ingredients',
      filter_by: 'hasRecipe:true',
      per_page: 100, // Get more results for scoring
      prefix: true,
      typo_tolerance: true,
      num_typos: 1,
    };

    const searchResult = await typesenseClient
      .collections(COLLECTION_NAME)
      .documents()
      .search(searchParameters);

    const { proteins, vegetables, pantryStaples } = ingredientIndex.categories;

    // Transform and score results
    const scoredResults: PantryMatchResult[] = (searchResult.hits || []).map((hit: any) => {
      const doc = hit.document;
      const recipeIngredients: string[] = doc.ingredients || [];

      // Filter out pantry staples from recipe ingredients for scoring
      const meaningfulIngredients = recipeIngredients.filter(
        (ing: string) => !pantryStaples.includes(ing.toLowerCase().trim())
      );

      // Calculate matches and score
      const matched: string[] = [];
      const missing: string[] = [];
      let weightedMatched = 0;
      let weightedTotal = 0;

      for (const recipeIng of meaningfulIngredients) {
        const normalized = recipeIng.toLowerCase().trim();

        // Determine weight for this ingredient
        let weight = 1;
        if (proteins.some(p => normalized.includes(p) || p.includes(normalized))) {
          weight = 3; // Proteins are 3x important
        } else if (vegetables.some(v => normalized.includes(v) || v.includes(normalized))) {
          weight = 2; // Vegetables are 2x important
        }

        weightedTotal += weight;

        // Check if user has this ingredient
        const isMatched = normalizedUserIngredients.some(userIng =>
          normalized.includes(userIng) || userIng.includes(normalized)
        );

        if (isMatched) {
          matched.push(recipeIng);
          weightedMatched += weight;
        } else {
          missing.push(recipeIng);
        }
      }

      const score = weightedTotal > 0 ? (weightedMatched / weightedTotal) * 100 : 0;

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
        matchScore: Math.round(score),
        matchedIngredients: matched,
        totalIngredients: recipeIngredients.length,
        missingIngredients: missing.slice(0, 5), // Limit missing to 5 for display
      } as PantryMatchResult;
    }).filter((result: PantryMatchResult) => result.matchedIngredients.length > 0);

    // Sort by combined score: prioritize recipes that match more of the user's ingredients
    scoredResults.sort((a, b) => {
      const aFinalScore = a.matchScore + (a.matchedIngredients.length * 15);
      const bFinalScore = b.matchScore + (b.matchedIngredients.length * 15);
      return bFinalScore - aFinalScore;
    });

    return scoredResults.slice(0, limit);
  } catch (error) {
    console.error('❌ Typesense pantry search error:', error);
    return [];
  }
}
