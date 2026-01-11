/**
 * Admin-specific types for the recipe viewer/editor.
 * These extend the base types with additional fields for editing,
 * version control, and AI regeneration.
 */

// Video reference linking keywords to timestamps
export interface VideoReference {
  keyword: string;
  timestamp_seconds: number;
  context: string;
}

// Extended instruction with admin-specific fields
export interface AdminInstruction {
  step: number;
  text: string;
  section_id?: string; // References CleanedTranscriptSection.id
  timing_confidence: 'high' | 'medium' | 'low' | 'none';
  timestamp_seconds?: number;
  end_time_seconds?: number;
  keywords: {
    ingredients: AdminIngredient[];
    techniques: string[];
    equipment: string[];
  } | null;
  measurements?: {
    temperatures?: string[];
    amounts?: string[];
    times?: string[];
  };
  video_references: VideoReference[];
  notes?: string; // Human notes for AI regeneration guidance
}

// Extended ingredient (same as base but required fields)
export interface AdminIngredient {
  item: string;
  quantity: string;
  unit: string;
  notes: string;
}

// Recipe content (one dish) with admin fields
export interface AdminRecipeContent {
  title: string;
  description: string;
  prep_time_minutes: number;
  cook_time_minutes: number;
  total_time_minutes: number;
  servings: number;
  yield: string;
  difficulty: string;
  cuisine_type: string[];
  meal_type: string[];
  dietary_tags: string[];
  ingredients: AdminIngredient[];
  instructions: AdminInstruction[];
  equipment: string[];
  tags: string[];
  tips: string[];
}

// Video-level wrapper containing one or more recipes
export interface VideoRecipes {
  has_recipe: boolean;
  has_more_recipes?: boolean; // True if there are additional unextracted recipes in the video
  video_id: string;
  video_url: string;
  upload_date: string;
  recipes: AdminRecipeContent[];
  cleaned_transcript?: CleanedTranscript;
}

// For listing recipes in the admin panel
export interface RecipeListItem {
  video_id: string;
  title: string;
  has_recipe: boolean;
  channel_name?: string;
  channel_id?: string;
}

// Channel info for filtering
export interface ChannelInfo {
  channel_id: string;
  channel_name: string;
  video_count: number;
}

// Keyword type for color coding in timeline
export type KeywordType = 'ingredient' | 'technique' | 'equipment';

// Timeline annotation with keyword type info
export interface TimelineAnnotation {
  id: string;
  keyword: string;
  timestamp: number;
  context: string;
  type: KeywordType;
  stepNumber: number;
}

// Step section for timeline visualization
export interface StepSection {
  id: string;
  stepNumber: number;
  title: string;
  startTime: number;
  endTime: number;
}

// Transcript segment with timing
export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

// Cleaned transcript section with timing
export interface CleanedTranscriptSection {
  id: string;
  startTime: number;      // seconds
  endTime: number;        // seconds
  heading?: string;       // optional section title
  text: string;
}

// Full cleaned transcript with metadata
export interface CleanedTranscript {
  sections: CleanedTranscriptSection[];
  generated_at: string;   // ISO timestamp
  model: string;
  prompt_used: string;
}

// Version metadata for recipe regeneration
export interface RecipeVersionInfo {
  version: number;
  created_at: string; // ISO 8601 timestamp
  prompt_used: string;
  model: string;
  temperature: number;
  generation_type: 'original' | 'regenerated' | 'regenerated-2stage' | 'continuation';
}

// Versioned recipe wrapper
export interface VersionedRecipe {
  version_info: RecipeVersionInfo;
  recipe: VideoRecipes;
}

// Summary for version list
export interface RecipeVersionSummary {
  version: number;
  created_at: string;
  generation_type: 'original' | 'regenerated' | 'regenerated-2stage' | 'continuation';
}

// API response with version info
export interface VersionedRecipeResponse {
  version_info: RecipeVersionInfo;
  recipe: VideoRecipes;
  available_versions: number[];
}

// Regeneration request payload
export interface RegenerateRequest {
  prompt: string;
  model?: string;
  temperature?: number;
}

// Regeneration response
export interface RegenerateResponse {
  success: boolean;
  version: number;
  version_info: RecipeVersionInfo;
  recipe: VideoRecipes;
  error?: string;
}

// Step change for saving edits
export interface StepChange {
  step: number;
  notes?: string;
  timing_confidence?: 'high' | 'low' | 'none';
  timestamp_seconds?: number;
  end_time_seconds?: number;
}

// Save changes request
export interface SaveChangesRequest {
  recipeIndex: number;
  changes: StepChange[];
}

// Video metadata from cache
export interface VideoMetadata {
  id: string;
  title: string;
  description: string;
  duration: number;
  upload_date: string;
  channel: string;
  channel_id: string;
  thumbnails: {
    url: string;
    width?: number;
    height?: number;
  }[];
}

// Batch processing types
export interface BatchVideoSample {
  video_id: string;
  title: string;
  channel_name?: string;
  channel_id?: string;
}

export interface BatchSampleResponse {
  videos: BatchVideoSample[];
}

// 2-stage regeneration response
export interface TwoStageRegenerateResponse {
  success: boolean;
  version: number;
  version_info: RecipeVersionInfo;
  recipe: VideoRecipes;
  cleaned_transcript: CleanedTranscript;
  error?: string;
}

// Continue extraction request
export interface ContinueExtractionRequest {
  maxIterations?: number; // Default: 10
  prompt?: string;
  model?: string;
  temperature?: number;
}

// Continue extraction response
export interface ContinueExtractionResponse {
  success: boolean;
  version: number;
  version_info: RecipeVersionInfo;
  recipe: VideoRecipes;
  iterations: number; // Number of API calls made
  recipesExtracted: number; // Total recipes in final result
  error?: string;
}
