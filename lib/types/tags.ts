export interface Tag {
  id: string;
  name: string;
  aliases: string[];
}

export interface TagCategory {
  displayName: string;
  tags: Tag[];
}

export interface LegacyMappings {
  recipeType: Record<string, string | null>;
  foodType: Record<string, string | null>;
  mealType: Record<string, string | null>;
  cuisineType: Record<string, string | null>;
  dietaryTags: Record<string, string | null>;
}

export interface TagTaxonomy {
  version: string;
  categories: Record<string, TagCategory>;
  legacyMappings: LegacyMappings;
}

export interface TagIndex {
  videoTags: Record<string, string[]>;
  tagStats: Record<string, number>;
  meta: {
    buildTime: string;
    totalVideos: number;
    taggedVideos: number;
    coveragePercent: number;
  };
}

export type TagCategoryId = 'meal' | 'protein' | 'carb' | 'cuisine' | 'side' | 'technique' | 'practical';
