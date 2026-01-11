/**
 * Types for recipe type grouping and dish extraction
 */

/**
 * Individual dish extraction result from Pass 1
 */
export interface DishExtraction {
  video_id: string;
  original_title: string;
  dish_name: string;
  dish_category: string; // Normalized category like "fried-chicken", "tacos"
  regional_style: string | null; // "Korean", "Southern", "Japanese", etc.
  is_technique_focused: boolean;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Intermediate output from Pass 1 - all extracted dishes
 */
export interface DishExtractionIndex {
  extractions: DishExtraction[];
  metadata: {
    build_time: string;
    total_processed: number;
    model_used: string;
    total_batches: number;
  };
}

/**
 * A variation within a recipe type group
 */
export interface RecipeVariation {
  name: string;
  slug: string;
  video_ids: string[];
  count: number;
}

/**
 * A recipe type group with variations
 */
export interface RecipeTypeGroup {
  canonical_name: string;
  slug: string;
  description?: string;
  variations: Record<string, RecipeVariation>;
  total_count: number;
}

/**
 * Final output - the complete recipe type index
 */
export interface RecipeTypeIndex {
  groups: Record<string, RecipeTypeGroup>;
  ungrouped: {
    video_ids: string[];
    count: number;
  };
  metadata: {
    build_time: string;
    total_recipes: number;
    grouped_recipes: number;
    ungrouped_recipes: number;
    unique_groups: number;
    unique_variations: number;
    model_used: string;
  };
}

/**
 * Input format for LLM batch processing
 */
export interface RecipeBatchInput {
  video_id: string;
  title: string;
}

/**
 * LLM response for Pass 1 extraction
 */
export interface ExtractionBatchResponse {
  extractions: Array<{
    video_id: string;
    original_title: string;
    dish_name: string;
    dish_category: string;
    regional_style: string | null;
    is_technique_focused: boolean;
    confidence: 'high' | 'medium' | 'low';
  }>;
}

/**
 * LLM response for Pass 2 grouping
 */
export interface GroupingResponse {
  groups: Array<{
    slug: string;
    canonical_name: string;
    description?: string;
    variations: Array<{
      slug: string;
      name: string;
      dish_names: string[]; // Original dish names that map to this variation
    }>;
  }>;
  ungrouped_dishes: string[]; // Dish names that couldn't be grouped
}
