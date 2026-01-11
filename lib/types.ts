export interface Thumbnail {
  url: string;
  height?: number;
  width?: number;
  preference?: number;
  id: string;
  resolution?: string;
}

export interface Ingredient {
  item: string;
  quantity: string;
  unit: string;
  notes?: string;
  timestamp_seconds?: number;
}

export interface Instruction {
  step: number;
  text: string;
  section_id?: string; // References CleanedTranscriptSection.id
  timing_confidence?: 'high' | 'medium' | 'low' | 'none';
  timestamp_seconds?: number;
  end_time_seconds?: number;
  measurements?: {
    temperatures?: string[];
    amounts?: string[];
    times?: string[];
  };
  keywords?: {
    ingredients?: Ingredient[];
    techniques?: string[];
    equipment?: string[];
  };
}

export interface Recipe {
  title: string;
  description: string;
  prep_time_minutes?: number;
  cook_time_minutes?: number;
  total_time_minutes?: number;
  servings?: number;
  yield?: string;
  difficulty?: string;
  cuisine_type?: string[];
  meal_type?: string[];
  dietary_tags?: string[];
  ingredients: Ingredient[];
  instructions: Instruction[];
  equipment?: string[];
  tags?: string[];
  tips?: string[];
}

export interface CleanedTranscriptSection {
  id: string;
  startTime: number;
  endTime: number;
  heading?: string;
  text: string;
}

export interface CleanedTranscript {
  sections: CleanedTranscriptSection[];
  generated_at: string;
  model: string;
  prompt_used: string;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  duration: number;
  view_count: number;
  upload_date: string;
  thumbnails: Thumbnail[];
  channel: string;
  channel_id: string;
  channelSlug: string;
  hasRecipe?: boolean;
  recipes?: Recipe[];
  cleaned_transcript?: CleanedTranscript;
}

export interface Channel {
  id?: string;
  channel: string;
  channel_id: string;
  channelSlug: string;
  title?: string;
  channel_follower_count: number;
  description: string;
  thumbnails: Thumbnail[];
  uploader_id?: string;
  uploader_url?: string;
  channel_url?: string;
  entries: Video[];
}

export interface VideoWithChannel extends Video {
  channelName: string;
  channelFollowers: number;
  recipeTitle?: string;
}
