import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import OpenAI from 'openai';
import pLimit from 'p-limit';
import type {
  DishExtraction,
  DishExtractionIndex,
  RecipeTypeIndex,
  RecipeTypeGroup,
  RecipeVariation,
  RecipeBatchInput,
  ExtractionBatchResponse,
  GroupingResponse,
} from '../lib/recipe-grouping/types';
import {
  EXTRACTION_SYSTEM_PROMPT,
  GROUPING_SYSTEM_PROMPT,
  formatExtractionPrompt,
  formatGroupingPrompt,
} from '../lib/recipe-grouping/prompts';
import {
  CATEGORY_MAPPINGS,
  PARENT_CATEGORY_NAMES,
} from '../lib/recipe-grouping/category-mappings';

// Configuration
const BATCH_SIZE = 50;
const CONCURRENCY = 5;
const MODEL = 'gpt-4o';
const TEMPERATURE = 0.3;

interface Recipe {
  title: string;
}

interface Video {
  id: string;
  title: string;
  recipes?: Recipe[];
}

interface Entry {
  id: string;
  title: string;
  recipes?: Recipe[];
}

interface Channel {
  channel: string;
  entries: Entry[];
}

interface RecipesData {
  channels: Channel[];
}

/**
 * Load recipes data from the compressed JSON file
 */
function loadRecipesData(): RecipesData {
  const dataPath = path.join(__dirname, '../data/recipes-data.json.gz');
  const compressedData = fs.readFileSync(dataPath);
  const decompressedData = zlib.gunzipSync(compressedData);
  return JSON.parse(decompressedData.toString());
}

/**
 * Extract all recipe titles with their video IDs
 */
function extractRecipeTitles(data: RecipesData): RecipeBatchInput[] {
  const recipes: RecipeBatchInput[] = [];

  for (const channel of data.channels) {
    for (const entry of channel.entries) {
      if (entry.recipes && entry.recipes.length > 0) {
        for (const recipe of entry.recipes) {
          if (recipe.title) {
            recipes.push({
              video_id: entry.id,
              title: recipe.title,
            });
          }
        }
      }
    }
  }

  return recipes;
}

/**
 * Split array into batches
 */
function chunk<T>(array: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    batches.push(array.slice(i, i + size));
  }
  return batches;
}

/**
 * Process a single batch through the extraction API
 */
async function extractBatch(
  client: OpenAI,
  batch: RecipeBatchInput[],
  batchNum: number,
  totalBatches: number
): Promise<DishExtraction[]> {
  const prompt = formatExtractionPrompt(batch);

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: TEMPERATURE,
      response_format: { type: 'json_object' },
      max_tokens: 8192,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    const parsed = JSON.parse(content) as ExtractionBatchResponse;
    console.log(`  Batch ${batchNum}/${totalBatches}: extracted ${parsed.extractions.length} dishes`);

    return parsed.extractions;
  } catch (error) {
    console.error(`  Batch ${batchNum}/${totalBatches}: ERROR`, error);
    throw error;
  }
}

/**
 * Pass 1: Extract dish names from all recipe titles
 */
async function runExtractionPass(
  client: OpenAI,
  recipes: RecipeBatchInput[]
): Promise<DishExtractionIndex> {
  console.log(`\n📝 Pass 1: Extracting dish names from ${recipes.length} recipes...`);

  const batches = chunk(recipes, BATCH_SIZE);
  console.log(`  Created ${batches.length} batches of ${BATCH_SIZE} recipes`);

  const limit = pLimit(CONCURRENCY);
  const startTime = Date.now();

  const results = await Promise.all(
    batches.map((batch, index) =>
      limit(() => extractBatch(client, batch, index + 1, batches.length))
    )
  );

  const extractions = results.flat();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`\n  Extraction complete in ${elapsed}s`);
  console.log(`  Total extractions: ${extractions.length}`);

  return {
    extractions,
    metadata: {
      build_time: new Date().toISOString(),
      total_processed: recipes.length,
      model_used: MODEL,
      total_batches: batches.length,
    },
  };
}

/**
 * Aggregate extractions by dish name
 */
function aggregateByDishName(
  extractions: DishExtraction[]
): Map<string, { dish_name: string; video_ids: string[]; category: string }> {
  const aggregated = new Map<
    string,
    { dish_name: string; video_ids: string[]; category: string }
  >();

  for (const extraction of extractions) {
    const key = extraction.dish_name.toLowerCase();
    const existing = aggregated.get(key);

    if (existing) {
      existing.video_ids.push(extraction.video_id);
    } else {
      aggregated.set(key, {
        dish_name: extraction.dish_name,
        video_ids: [extraction.video_id],
        category: extraction.dish_category,
      });
    }
  }

  return aggregated;
}

/**
 * Apply category mappings to consolidate specific categories into broader parent groups
 */
function applyMapping(category: string): string {
  return CATEGORY_MAPPINGS[category] || category;
}

/**
 * Build hierarchical groups directly from extraction data
 * Uses dish_category as the parent group and regional_style/dish_name for variations
 */
function buildGroupsFromExtractions(
  extractions: DishExtraction[]
): RecipeTypeIndex {
  console.log(`\n🗂️  Building hierarchical groupings from extraction data...`);

  // Group extractions by dish_category (with mappings applied)
  const categoryMap = new Map<
    string,
    {
      dishes: Map<string, { name: string; regional_style: string | null; video_ids: string[]; originalCategory: string }>;
    }
  >();

  for (const extraction of extractions) {
    // Apply mapping to consolidate specific categories into broader groups
    const category = applyMapping(extraction.dish_category);

    if (!categoryMap.has(category)) {
      categoryMap.set(category, { dishes: new Map() });
    }

    const categoryData = categoryMap.get(category)!;
    const dishKey = extraction.dish_name.toLowerCase();

    if (!categoryData.dishes.has(dishKey)) {
      categoryData.dishes.set(dishKey, {
        name: extraction.dish_name,
        regional_style: extraction.regional_style,
        video_ids: [],
        originalCategory: extraction.dish_category,
      });
    }

    categoryData.dishes.get(dishKey)!.video_ids.push(extraction.video_id);
  }

  // Convert to final structure
  const groups: Record<string, RecipeTypeGroup> = {};
  let totalGrouped = 0;
  let totalVariations = 0;
  const ungroupedVideoIds: string[] = [];

  for (const [categorySlug, categoryData] of categoryMap) {
    // Count total videos in this category
    let totalVideosInCategory = 0;
    for (const dish of categoryData.dishes.values()) {
      totalVideosInCategory += dish.video_ids.length;
    }

    // Skip categories with only 1 video total (will be ungrouped)
    if (totalVideosInCategory < 2) {
      for (const dish of categoryData.dishes.values()) {
        ungroupedVideoIds.push(...dish.video_ids);
      }
      continue;
    }

    // Build variations within this category
    const variations: Record<string, RecipeVariation> = {};
    let groupTotal = 0;

    // Group by regional style or use dish name directly
    const styleMap = new Map<string, { name: string; video_ids: string[] }>();

    for (const dish of categoryData.dishes.values()) {
      const styleKey = dish.regional_style
        ? `${dish.regional_style.toLowerCase()}-${categorySlug}`
        : 'generic';
      const styleName = dish.regional_style
        ? `${dish.regional_style} ${toTitleCase(categorySlug.replace(/-/g, ' '))}`
        : toTitleCase(categorySlug.replace(/-/g, ' '));

      if (!styleMap.has(styleKey)) {
        styleMap.set(styleKey, { name: styleName, video_ids: [] });
      }

      styleMap.get(styleKey)!.video_ids.push(...dish.video_ids);
    }

    // Only create variations with 1+ videos
    for (const [styleSlug, styleData] of styleMap) {
      const uniqueVideoIds = [...new Set(styleData.video_ids)];
      if (uniqueVideoIds.length > 0) {
        variations[styleSlug] = {
          name: styleData.name,
          slug: styleSlug,
          video_ids: uniqueVideoIds,
          count: uniqueVideoIds.length,
        };
        groupTotal += uniqueVideoIds.length;
        totalVariations++;
      }
    }

    if (Object.keys(variations).length > 0) {
      // Use parent category name if available, otherwise convert slug to title case
      const canonicalName = PARENT_CATEGORY_NAMES[categorySlug] || toTitleCase(categorySlug.replace(/-/g, ' '));
      groups[categorySlug] = {
        canonical_name: canonicalName,
        slug: categorySlug,
        variations,
        total_count: groupTotal,
      };
      totalGrouped += groupTotal;
    }
  }

  const uniqueUngrouped = [...new Set(ungroupedVideoIds)];

  console.log(`  Created ${Object.keys(groups).length} groups`);
  console.log(`  Total variations: ${totalVariations}`);
  console.log(`  Ungrouped: ${uniqueUngrouped.length} videos`);

  return {
    groups,
    ungrouped: {
      video_ids: uniqueUngrouped,
      count: uniqueUngrouped.length,
    },
    metadata: {
      build_time: new Date().toISOString(),
      total_recipes: extractions.length,
      grouped_recipes: totalGrouped,
      ungrouped_recipes: uniqueUngrouped.length,
      unique_groups: Object.keys(groups).length,
      unique_variations: totalVariations,
      model_used: MODEL,
    },
  };
}

/**
 * Convert slug to title case
 */
function toTitleCase(str: string): string {
  return str
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Build the final recipe type index from grouping results
 */
function buildFinalIndex(
  groupingResult: GroupingResponse,
  extractions: DishExtraction[]
): RecipeTypeIndex {
  // Create a map from dish name to video IDs
  const dishToVideos = aggregateByDishName(extractions);

  const groups: Record<string, RecipeTypeGroup> = {};
  let totalGrouped = 0;
  let totalVariations = 0;

  for (const group of groupingResult.groups) {
    const variations: Record<string, RecipeVariation> = {};
    let groupTotal = 0;

    for (const variation of group.variations) {
      const videoIds: string[] = [];

      // Collect video IDs for all dish names in this variation
      for (const dishName of variation.dish_names) {
        const key = dishName.toLowerCase();
        const entry = dishToVideos.get(key);
        if (entry) {
          videoIds.push(...entry.video_ids);
        }
      }

      // Deduplicate video IDs
      const uniqueVideoIds = [...new Set(videoIds)];

      if (uniqueVideoIds.length > 0) {
        variations[variation.slug] = {
          name: variation.name,
          slug: variation.slug,
          video_ids: uniqueVideoIds,
          count: uniqueVideoIds.length,
        };
        groupTotal += uniqueVideoIds.length;
        totalVariations++;
      }
    }

    if (Object.keys(variations).length > 0) {
      groups[group.slug] = {
        canonical_name: group.canonical_name,
        slug: group.slug,
        description: group.description,
        variations,
        total_count: groupTotal,
      };
      totalGrouped += groupTotal;
    }
  }

  // Handle ungrouped dishes
  const ungroupedVideoIds: string[] = [];
  for (const dishName of groupingResult.ungrouped_dishes) {
    const key = dishName.toLowerCase();
    const entry = dishToVideos.get(key);
    if (entry) {
      ungroupedVideoIds.push(...entry.video_ids);
    }
  }
  const uniqueUngrouped = [...new Set(ungroupedVideoIds)];

  return {
    groups,
    ungrouped: {
      video_ids: uniqueUngrouped,
      count: uniqueUngrouped.length,
    },
    metadata: {
      build_time: new Date().toISOString(),
      total_recipes: extractions.length,
      grouped_recipes: totalGrouped,
      ungrouped_recipes: uniqueUngrouped.length,
      unique_groups: Object.keys(groups).length,
      unique_variations: totalVariations,
      model_used: MODEL,
    },
  };
}

/**
 * Main function
 */
async function main() {
  console.log('🍳 Recipe Type Grouping Analysis');
  console.log('================================\n');

  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY environment variable is not set');
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  // Load data
  console.log('📂 Loading recipe data...');
  const data = loadRecipesData();
  const recipes = extractRecipeTitles(data);
  console.log(`  Found ${recipes.length} recipes with titles`);

  // Check for existing extraction (to allow resuming)
  const extractionPath = path.join(__dirname, '../data/recipe-dish-extraction.json');
  let extractionIndex: DishExtractionIndex;

  if (fs.existsSync(extractionPath) && process.argv.includes('--skip-extraction')) {
    console.log('\n📄 Loading existing extraction from file...');
    extractionIndex = JSON.parse(fs.readFileSync(extractionPath, 'utf-8'));
    console.log(`  Loaded ${extractionIndex.extractions.length} extractions`);
  } else {
    // Pass 1: Extract dish names
    extractionIndex = await runExtractionPass(client, recipes);

    // Save intermediate results
    fs.writeFileSync(extractionPath, JSON.stringify(extractionIndex, null, 2));
    console.log(`\n💾 Saved extraction to ${extractionPath}`);
  }

  // Build hierarchical groups directly from extraction data
  const finalIndex = buildGroupsFromExtractions(extractionIndex.extractions);

  // Save final output
  const outputPath = path.join(__dirname, '../data/recipe-type-groups.json');
  fs.writeFileSync(outputPath, JSON.stringify(finalIndex, null, 2));

  // Print summary
  console.log('\n✅ Recipe type grouping complete!');
  console.log('================================');
  console.log(`📁 Output: ${outputPath}`);
  console.log(`\n📊 Statistics:`);
  console.log(`   Total recipes: ${finalIndex.metadata.total_recipes}`);
  console.log(`   Grouped recipes: ${finalIndex.metadata.grouped_recipes}`);
  console.log(`   Ungrouped recipes: ${finalIndex.metadata.ungrouped_recipes}`);
  console.log(`   Unique groups: ${finalIndex.metadata.unique_groups}`);
  console.log(`   Unique variations: ${finalIndex.metadata.unique_variations}`);

  // Print top groups
  const topGroups = Object.values(finalIndex.groups)
    .sort((a, b) => b.total_count - a.total_count)
    .slice(0, 20);

  console.log(`\n🏆 Top 20 Recipe Groups:`);
  for (const group of topGroups) {
    const variationCount = Object.keys(group.variations).length;
    console.log(`   ${group.canonical_name}: ${group.total_count} recipes (${variationCount} variations)`);
  }
}

// Run
main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
