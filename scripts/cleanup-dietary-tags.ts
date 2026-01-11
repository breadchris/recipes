import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

/**
 * Cleanup script to remove incorrect dietary tags from recipes containing meat.
 *
 * Problem: AI was incorrectly tagging meat-containing recipes as "vegetarian",
 * "can be vegetarian", "healthy", or "light".
 *
 * Solution: Scan all recipes for meat ingredients and remove invalid dietary tags.
 */

// Meat/animal product keywords to check in ingredients
const MEAT_KEYWORDS = [
  // Beef
  'beef', 'steak', 'ground beef', 'ground chuck', 'sirloin', 'ribeye', 'brisket', 'chuck', 'flank',
  // Pork
  'pork', 'bacon', 'ham', 'prosciutto', 'pancetta', 'sausage', 'chorizo', 'pepperoni', 'salami',
  'pork belly', 'pork chop', 'pork loin', 'ribs', 'spare ribs',
  // Poultry
  'chicken', 'turkey', 'duck', 'goose', 'poultry', 'chicken breast', 'chicken thigh', 'chicken wing',
  'ground turkey', 'ground chicken',
  // Lamb/Game
  'lamb', 'veal', 'venison', 'rabbit', 'goat',
  // Seafood (not vegetarian)
  'fish', 'salmon', 'tuna', 'cod', 'tilapia', 'halibut', 'trout', 'bass', 'snapper', 'mahi',
  'shrimp', 'prawn', 'crab', 'lobster', 'scallop', 'clam', 'mussel', 'oyster', 'squid', 'calamari',
  'octopus', 'anchovy', 'anchovies', 'sardine', 'mackerel',
  // Other
  'meat', 'meatball', 'hot dog', 'bratwurst', 'kielbasa', 'andouille',
  // Broths (often not vegetarian)
  'chicken stock', 'chicken broth', 'beef stock', 'beef broth', 'fish stock', 'bone broth',
];

// Tags to remove when meat is found
const TAGS_TO_REMOVE = [
  'vegetarian',
  'vegan',
  'can be vegetarian',
  'can be vegan',
  'healthy',
  'light',
  'plant-based',
];

interface Ingredient {
  item: string;
  quantity?: string;
  unit?: string;
  notes?: string;
}

interface Recipe {
  title: string;
  dietary_tags?: string[];
  ingredients: Ingredient[];
}

interface Video {
  id: string;
  title: string;
  recipes?: Recipe[];
}

interface Channel {
  name: string;
  slug: string;
  id: string;
  followers: number;
}

interface RecipesData {
  videos: Video[];
  channels: Channel[];
}

function containsMeat(ingredients: Ingredient[]): boolean {
  for (const ingredient of ingredients) {
    const itemLower = ingredient.item.toLowerCase();
    const notesLower = (ingredient.notes || '').toLowerCase();
    const combined = `${itemLower} ${notesLower}`;

    for (const keyword of MEAT_KEYWORDS) {
      // Check for whole word match to avoid false positives
      // e.g., "chickpea" shouldn't match "chicken"
      const regex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (regex.test(combined)) {
        return true;
      }
    }
  }
  return false;
}

function cleanDietaryTags(tags: string[]): string[] {
  return tags.filter(tag => {
    const tagLower = tag.toLowerCase();
    return !TAGS_TO_REMOVE.some(t => tagLower.includes(t.toLowerCase()));
  });
}

async function main() {
  console.log('🧹 Cleaning dietary tags from recipes with meat...\n');

  // Load recipes data
  const dataPath = path.join(__dirname, '../data/recipes-data.json.gz');
  const compressedData = fs.readFileSync(dataPath);
  const decompressedData = zlib.gunzipSync(compressedData);
  const recipesData: RecipesData = JSON.parse(decompressedData.toString());

  console.log(`📊 Loaded ${recipesData.videos.length} videos\n`);

  let videosWithRecipes = 0;
  let recipesFixed = 0;
  let tagsRemoved = 0;
  const fixedRecipes: { videoId: string; videoTitle: string; recipeTitle: string; removedTags: string[] }[] = [];

  for (const video of recipesData.videos) {
    if (!video.recipes || video.recipes.length === 0) continue;
    videosWithRecipes++;

    for (const recipe of video.recipes) {
      if (!recipe.ingredients || recipe.ingredients.length === 0) continue;
      if (!recipe.dietary_tags || recipe.dietary_tags.length === 0) continue;

      // Check if recipe contains meat
      if (containsMeat(recipe.ingredients)) {
        const originalTags = [...recipe.dietary_tags];
        const cleanedTags = cleanDietaryTags(recipe.dietary_tags);

        const removedTags = originalTags.filter(t => !cleanedTags.includes(t));

        if (removedTags.length > 0) {
          recipe.dietary_tags = cleanedTags;
          recipesFixed++;
          tagsRemoved += removedTags.length;

          fixedRecipes.push({
            videoId: video.id,
            videoTitle: video.title,
            recipeTitle: recipe.title,
            removedTags,
          });
        }
      }
    }
  }

  console.log('📝 Summary:');
  console.log(`   Videos with recipes: ${videosWithRecipes}`);
  console.log(`   Recipes fixed: ${recipesFixed}`);
  console.log(`   Tags removed: ${tagsRemoved}`);
  console.log('');

  if (fixedRecipes.length > 0) {
    console.log('🔧 Fixed recipes (first 20):');
    fixedRecipes.slice(0, 20).forEach(({ videoTitle, recipeTitle, removedTags }) => {
      console.log(`   - "${recipeTitle}" (${videoTitle})`);
      console.log(`     Removed: ${removedTags.join(', ')}`);
    });

    if (fixedRecipes.length > 20) {
      console.log(`   ... and ${fixedRecipes.length - 20} more`);
    }
    console.log('');

    // Save updated data
    const outputPath = path.join(__dirname, '../data/recipes-data.json.gz');
    const jsonData = JSON.stringify(recipesData);
    const compressedOutput = zlib.gzipSync(jsonData);
    fs.writeFileSync(outputPath, compressedOutput);

    console.log(`✅ Saved updated data to ${outputPath}`);
    console.log('');
    console.log('📌 Next step: Run "npm run index:typesense" to re-index the data');
  } else {
    console.log('✅ No recipes needed fixing!');
  }
}

main().catch(console.error);
