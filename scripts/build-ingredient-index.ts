import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

/**
 * Build an ingredient index from all recipes for:
 * 1. Autocomplete suggestions in Pantry Mode
 * 2. Categorization for weighted matching
 */

// Common pantry staples that should be excluded from matching
const PANTRY_STAPLES = new Set([
  'salt',
  'pepper',
  'black pepper',
  'kosher salt',
  'sea salt',
  'table salt',
  'olive oil',
  'vegetable oil',
  'canola oil',
  'cooking oil',
  'oil',
  'water',
  'ice',
  'butter',
  'unsalted butter',
  'salted butter',
  'sugar',
  'granulated sugar',
  'brown sugar',
  'flour',
  'all-purpose flour',
  'ap flour',
]);

// Common proteins (weighted 3x in matching)
const PROTEINS = new Set([
  'chicken',
  'chicken breast',
  'chicken thigh',
  'chicken thighs',
  'chicken wings',
  'beef',
  'ground beef',
  'steak',
  'ribeye',
  'sirloin',
  'pork',
  'pork chop',
  'pork chops',
  'bacon',
  'pancetta',
  'ham',
  'sausage',
  'italian sausage',
  'salmon',
  'shrimp',
  'fish',
  'cod',
  'tilapia',
  'tuna',
  'tofu',
  'tempeh',
  'eggs',
  'egg',
  'lamb',
  'ground lamb',
  'turkey',
  'ground turkey',
  'duck',
  'crab',
  'lobster',
  'scallops',
  'mussels',
  'clams',
  'anchovies',
]);

// Key vegetables/aromatics (weighted 2x in matching)
const KEY_VEGETABLES = new Set([
  'onion',
  'onions',
  'garlic',
  'ginger',
  'carrot',
  'carrots',
  'celery',
  'potato',
  'potatoes',
  'tomato',
  'tomatoes',
  'bell pepper',
  'bell peppers',
  'jalapeño',
  'jalapeño pepper',
  'broccoli',
  'cauliflower',
  'spinach',
  'kale',
  'mushroom',
  'mushrooms',
  'zucchini',
  'squash',
  'eggplant',
  'cabbage',
  'lettuce',
  'corn',
  'peas',
  'green beans',
  'asparagus',
  'leek',
  'leeks',
  'shallot',
  'shallots',
  'scallion',
  'scallions',
  'green onion',
  'green onions',
]);

interface IngredientIndex {
  // All unique ingredients (for autocomplete)
  ingredients: string[];
  // Count of recipes using each ingredient (for sorting by popularity)
  counts: Record<string, number>;
  // Categorization for weighted matching
  categories: {
    proteins: string[];
    vegetables: string[];
    pantryStaples: string[];
    other: string[];
  };
  // Build metadata
  meta: {
    buildTime: string;
    totalRecipes: number;
    totalIngredients: number;
  };
}

interface Recipe {
  ingredients?: Array<{
    item: string;
    quantity?: string;
    unit?: string;
    notes?: string;
  }>;
}

interface Video {
  recipes?: Recipe[];
}

interface RecipesData {
  videos: Video[];
}

async function buildIngredientIndex() {
  console.log('🥕 Building ingredient index...');

  // Load recipes data
  const dataPath = path.join(__dirname, '../data/recipes-data.json.gz');
  const compressedData = fs.readFileSync(dataPath);
  const decompressedData = zlib.gunzipSync(compressedData);
  const recipesData: RecipesData = JSON.parse(decompressedData.toString());

  console.log(`📊 Processing ${recipesData.videos.length} videos...`);

  // Count occurrences of each ingredient
  const ingredientCounts = new Map<string, number>();
  let totalRecipes = 0;

  recipesData.videos.forEach((video) => {
    if (!video.recipes) return;

    video.recipes.forEach((recipe) => {
      totalRecipes++;
      if (!recipe.ingredients) return;

      recipe.ingredients.forEach((ingredient) => {
        if (!ingredient.item) return;

        // Normalize: lowercase, trim, remove extra spaces
        const normalized = ingredient.item.toLowerCase().trim().replace(/\s+/g, ' ');
        if (normalized.length === 0) return;

        const count = ingredientCounts.get(normalized) || 0;
        ingredientCounts.set(normalized, count + 1);
      });
    });
  });

  console.log(`📦 Found ${ingredientCounts.size} unique ingredients across ${totalRecipes} recipes`);

  // Sort ingredients by frequency (most common first) for autocomplete
  const sortedIngredients = Array.from(ingredientCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([ingredient]) => ingredient);

  // Categorize ingredients
  const categorized = {
    proteins: [] as string[],
    vegetables: [] as string[],
    pantryStaples: [] as string[],
    other: [] as string[],
  };

  sortedIngredients.forEach((ingredient) => {
    if (PANTRY_STAPLES.has(ingredient)) {
      categorized.pantryStaples.push(ingredient);
    } else if (PROTEINS.has(ingredient)) {
      categorized.proteins.push(ingredient);
    } else if (KEY_VEGETABLES.has(ingredient)) {
      categorized.vegetables.push(ingredient);
    } else {
      // Check if ingredient contains a known protein/vegetable
      const isProtein = Array.from(PROTEINS).some(
        (p) => ingredient.includes(p) || p.includes(ingredient)
      );
      const isVegetable = Array.from(KEY_VEGETABLES).some(
        (v) => ingredient.includes(v) || v.includes(ingredient)
      );

      if (isProtein) {
        categorized.proteins.push(ingredient);
      } else if (isVegetable) {
        categorized.vegetables.push(ingredient);
      } else {
        categorized.other.push(ingredient);
      }
    }
  });

  // Build the index
  const index: IngredientIndex = {
    ingredients: sortedIngredients,
    counts: Object.fromEntries(ingredientCounts),
    categories: categorized,
    meta: {
      buildTime: new Date().toISOString(),
      totalRecipes,
      totalIngredients: sortedIngredients.length,
    },
  };

  // Write to file
  const outputPath = path.join(__dirname, '../data/ingredient-index.json');
  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2));

  console.log(`\n✅ Ingredient index built successfully!`);
  console.log(`📁 Output: ${outputPath}`);
  console.log(`\n📊 Statistics:`);
  console.log(`   Total ingredients: ${index.meta.totalIngredients}`);
  console.log(`   Proteins: ${categorized.proteins.length}`);
  console.log(`   Vegetables: ${categorized.vegetables.length}`);
  console.log(`   Pantry staples: ${categorized.pantryStaples.length}`);
  console.log(`   Other: ${categorized.other.length}`);
  console.log(`\n🔝 Top 20 ingredients by frequency:`);
  sortedIngredients.slice(0, 20).forEach((ing, i) => {
    console.log(`   ${i + 1}. ${ing} (${ingredientCounts.get(ing)} recipes)`);
  });
}

// Run the build
buildIngredientIndex().catch((error) => {
  console.error('❌ Error building ingredient index:', error);
  process.exit(1);
});
