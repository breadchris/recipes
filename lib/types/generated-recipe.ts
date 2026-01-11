import type { Recipe } from '../types';

/**
 * Metadata stored with generated recipes in Supabase
 */
export interface GeneratedRecipeMetadata {
  /** Client-side generated ID for progress tracking */
  generated_id: string;
  /** Full recipe object */
  recipe: Recipe;
  /** ISO timestamp of creation */
  created_at: string;
  /** Model used for generation */
  model: string;
  /** Original prompt from user */
  prompt?: string;
}

/**
 * Generated recipe record as stored in Supabase content table
 */
export interface GeneratedRecipeRecord {
  id: string;
  created_at: string;
  updated_at: string;
  type: 'generated-recipe';
  data: string; // Recipe title for quick search
  group_id: string;
  user_id: string | null;
  parent_content_id: null;
  metadata: GeneratedRecipeMetadata;
}

/**
 * Response from autocomplete API
 */
export interface AutocompleteSuggestion {
  suggestions: string[];
}

/**
 * Request body for save-generated-recipe API
 */
export interface SaveGeneratedRecipeRequest {
  recipe: Recipe;
  generatedId: string;
  prompt?: string;
}

/**
 * Response from save-generated-recipe API
 */
export interface SaveGeneratedRecipeResponse {
  success: boolean;
  id?: string;
  error?: string;
}
