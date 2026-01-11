import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import type { TagTaxonomy, TagIndex } from '../lib/types/tags';

interface Recipe {
  title: string;
  meal_type?: string[];
  cuisine_type?: string[];
  dietary_tags?: string[];
  total_time_minutes?: number;
  difficulty?: string;
}

interface Video {
  id: string;
  title: string;
  description: string;
  recipes?: Recipe[];
}

interface Channel {
  channel: string;
  entries: Video[];
}

interface RecipesData {
  channels: Channel[];
}

interface FoodTypeIndex {
  videoFoodTypes: Record<string, string[]>;
}

interface RecipeTypeVideoIndex {
  videoRecipeTypes: Record<string, string[]>;
}

interface RecipeTypeGroup {
  canonical_name: string;
  slug: string;
  variations: Record<string, { video_ids: string[] }>;
}

interface RecipeTypeGroups {
  groups: Record<string, RecipeTypeGroup>;
}

function loadTaxonomy(): TagTaxonomy {
  const taxonomyPath = path.join(__dirname, '../data/tag-taxonomy.json');
  return JSON.parse(fs.readFileSync(taxonomyPath, 'utf-8'));
}

function loadRecipesData(): RecipesData {
  const dataPath = path.join(__dirname, '../data/recipes-data.json.gz');
  const compressedData = fs.readFileSync(dataPath);
  const decompressedData = zlib.gunzipSync(compressedData);
  return JSON.parse(decompressedData.toString());
}

function loadFoodTypeIndex(): FoodTypeIndex {
  const indexPath = path.join(__dirname, '../data/food-type-index.json');
  if (fs.existsSync(indexPath)) {
    return JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
  }
  return { videoFoodTypes: {} };
}

function loadRecipeTypeIndex(): RecipeTypeVideoIndex {
  // Load from recipe-type-groups.json (LLM-based classification)
  const groupsPath = path.join(__dirname, '../data/recipe-type-groups.json');
  if (!fs.existsSync(groupsPath)) {
    return { videoRecipeTypes: {} };
  }

  const data: RecipeTypeGroups = JSON.parse(fs.readFileSync(groupsPath, 'utf-8'));
  const videoRecipeTypes: Record<string, string[]> = {};

  // Build video → recipe types mapping from the groups
  for (const group of Object.values(data.groups)) {
    for (const variation of Object.values(group.variations)) {
      for (const videoId of variation.video_ids) {
        if (!videoRecipeTypes[videoId]) {
          videoRecipeTypes[videoId] = [];
        }
        // Use canonical_name which maps to recipeType in taxonomy
        if (!videoRecipeTypes[videoId].includes(group.canonical_name)) {
          videoRecipeTypes[videoId].push(group.canonical_name);
        }
      }
    }
  }

  return { videoRecipeTypes };
}

function normalizeString(str: string): string {
  return str.toLowerCase().trim();
}

function mapLegacyValue(
  value: string,
  mappings: Record<string, string | null>
): string | null {
  const normalized = normalizeString(value);

  // First try exact match
  if (mappings[value] !== undefined) {
    return mappings[value];
  }

  // Then try normalized match
  for (const [key, tagId] of Object.entries(mappings)) {
    if (normalizeString(key) === normalized) {
      return tagId;
    }
  }

  return null;
}

function buildVideoTags(
  videoId: string,
  recipes: Recipe[] | undefined,
  foodTypes: string[],
  recipeTypes: string[],
  taxonomy: TagTaxonomy
): string[] {
  const tags = new Set<string>();

  // Map food types
  for (const foodType of foodTypes) {
    const tagId = mapLegacyValue(foodType, taxonomy.legacyMappings.foodType);
    if (tagId) {
      tags.add(tagId);
    }
  }

  // Map recipe types
  for (const recipeType of recipeTypes) {
    const tagId = mapLegacyValue(recipeType, taxonomy.legacyMappings.recipeType);
    if (tagId) {
      tags.add(tagId);
    }
  }

  // Map recipe-level tags
  if (recipes && recipes.length > 0) {
    for (const recipe of recipes) {
      // Map meal types
      if (recipe.meal_type) {
        for (const mealType of recipe.meal_type) {
          const tagId = mapLegacyValue(mealType, taxonomy.legacyMappings.mealType);
          if (tagId) {
            tags.add(tagId);
          }
        }
      }

      // Map cuisine types
      if (recipe.cuisine_type) {
        for (const cuisineType of recipe.cuisine_type) {
          const tagId = mapLegacyValue(cuisineType, taxonomy.legacyMappings.cuisineType);
          if (tagId) {
            tags.add(tagId);
          }
        }
      }

      // Map dietary tags
      if (recipe.dietary_tags) {
        for (const dietaryTag of recipe.dietary_tags) {
          const tagId = mapLegacyValue(dietaryTag, taxonomy.legacyMappings.dietaryTags);
          if (tagId) {
            tags.add(tagId);
          }
        }
      }

      // Add practical tags based on recipe attributes
      if (recipe.total_time_minutes) {
        if (recipe.total_time_minutes <= 30 && recipe.difficulty === 'easy') {
          tags.add('quick-easy');
        }
        if (recipe.total_time_minutes <= 45) {
          tags.add('weeknight');
        }
      }
    }
  }

  return Array.from(tags).sort();
}

async function buildTagIndex() {
  console.log('Building tag index from existing data...\n');

  // Load all data sources
  console.log('Loading taxonomy...');
  const taxonomy = loadTaxonomy();
  console.log('  Categories:', Object.keys(taxonomy.categories).length);

  console.log('Loading recipes data...');
  const recipesData = loadRecipesData();
  let totalVideos = 0;
  const videoRecipes = new Map<string, Recipe[]>();

  for (const channel of recipesData.channels) {
    for (const video of channel.entries) {
      totalVideos++;
      if (video.recipes && video.recipes.length > 0) {
        videoRecipes.set(video.id, video.recipes);
      }
    }
  }
  console.log('  Total videos:', totalVideos);
  console.log('  Videos with recipes:', videoRecipes.size);

  console.log('Loading food type index...');
  const foodTypeIndex = loadFoodTypeIndex();
  console.log('  Videos with food types:', Object.keys(foodTypeIndex.videoFoodTypes).length);

  console.log('Loading recipe type index...');
  const recipeTypeIndex = loadRecipeTypeIndex();
  console.log('  Videos with recipe types:', Object.keys(recipeTypeIndex.videoRecipeTypes).length);

  // Build video tags
  console.log('\nBuilding video tags...');
  const videoTags: Record<string, string[]> = {};
  const tagStats: Record<string, number> = {};

  // Initialize tag stats
  for (const category of Object.values(taxonomy.categories)) {
    for (const tag of category.tags) {
      tagStats[tag.id] = 0;
    }
  }

  // Process each channel's videos
  for (const channel of recipesData.channels) {
    for (const video of channel.entries) {
      const foodTypes = foodTypeIndex.videoFoodTypes[video.id] || [];
      const recipeTypes = recipeTypeIndex.videoRecipeTypes[video.id] || [];
      const recipes = videoRecipes.get(video.id);

      const tags = buildVideoTags(
        video.id,
        recipes,
        foodTypes,
        recipeTypes,
        taxonomy
      );

      if (tags.length > 0) {
        videoTags[video.id] = tags;

        // Update tag stats
        for (const tagId of tags) {
          if (tagStats[tagId] !== undefined) {
            tagStats[tagId]++;
          }
        }
      }
    }
  }

  const taggedVideos = Object.keys(videoTags).length;
  const coveragePercent = Math.round((taggedVideos / totalVideos) * 100);

  const index: TagIndex = {
    videoTags,
    tagStats,
    meta: {
      buildTime: new Date().toISOString(),
      totalVideos,
      taggedVideos,
      coveragePercent,
    },
  };

  // Write output
  const outputPath = path.join(__dirname, '../data/tag-index.json');
  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2));

  console.log('\nTag index built successfully!');
  console.log('  Output:', outputPath);
  console.log('  Total videos:', totalVideos);
  console.log('  Tagged videos:', taggedVideos);
  console.log('  Coverage:', coveragePercent + '%');

  // Show top 15 tags
  console.log('\nTop 15 tags:');
  const sortedTags = Object.entries(tagStats)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  for (const [tagId, count] of sortedTags) {
    // Find tag name
    let tagName = tagId;
    for (const category of Object.values(taxonomy.categories)) {
      const tag = category.tags.find(t => t.id === tagId);
      if (tag) {
        tagName = tag.name;
        break;
      }
    }
    console.log('  ' + tagName + ': ' + count);
  }

  // Show coverage by category
  console.log('\nTags by category:');
  for (const [categoryId, category] of Object.entries(taxonomy.categories)) {
    const categoryTags = category.tags
      .map(t => ({ name: t.name, count: tagStats[t.id] || 0 }))
      .filter(t => t.count > 0)
      .sort((a, b) => b.count - a.count);

    const totalInCategory = categoryTags.reduce((sum, t) => sum + t.count, 0);
    console.log('  ' + category.displayName + ' (' + totalInCategory + ' total):');
    for (const tag of categoryTags.slice(0, 5)) {
      console.log('    - ' + tag.name + ': ' + tag.count);
    }
  }
}

buildTagIndex().catch((error) => {
  console.error('Error building tag index:', error);
  process.exit(1);
});
