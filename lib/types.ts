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
  timestamp_seconds?: number;
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
  recipe?: Recipe;
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
}
