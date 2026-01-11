import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import Typesense from 'typesense';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: path.join(__dirname, '../.env.local') });

const COLLECTION_NAME = 'nutrition';
const BATCH_SIZE = 1000;

// Singular/plural synonyms for common ingredients
// This helps users find "Strawberries, raw" when searching for "strawberry"
const INGREDIENT_SYNONYMS: [string, string][] = [
  ['strawberry', 'strawberries'],
  ['banana', 'bananas'],
  ['apple', 'apples'],
  ['orange', 'oranges'],
  ['tomato', 'tomatoes'],
  ['potato', 'potatoes'],
  ['carrot', 'carrots'],
  ['onion', 'onions'],
  ['pepper', 'peppers'],
  ['egg', 'eggs'],
  ['blueberry', 'blueberries'],
  ['raspberry', 'raspberries'],
  ['blackberry', 'blackberries'],
  ['cranberry', 'cranberries'],
  ['cherry', 'cherries'],
  ['grape', 'grapes'],
  ['lemon', 'lemons'],
  ['lime', 'limes'],
  ['peach', 'peaches'],
  ['pear', 'pears'],
  ['plum', 'plums'],
  ['apricot', 'apricots'],
  ['mango', 'mangos'],
  ['kiwi', 'kiwis'],
  ['avocado', 'avocados'],
  ['cucumber', 'cucumbers'],
  ['zucchini', 'zucchinis'],
  ['squash', 'squashes'],
  ['mushroom', 'mushrooms'],
  ['olive', 'olives'],
  ['bean', 'beans'],
  ['pea', 'peas'],
  ['lentil', 'lentils'],
  ['nut', 'nuts'],
  ['almond', 'almonds'],
  ['walnut', 'walnuts'],
  ['cashew', 'cashews'],
  ['peanut', 'peanuts'],
  ['pistachio', 'pistachios'],
  ['seed', 'seeds'],
  ['shrimp', 'shrimps'],
  ['clam', 'clams'],
  ['oyster', 'oysters'],
  ['mussel', 'mussels'],
  ['scallop', 'scallops'],
  ['sardine', 'sardines'],
  ['anchovy', 'anchovies'],
  ['fig', 'figs'],
  ['date', 'dates'],
  ['prune', 'prunes'],
  ['raisin', 'raisins'],
  ['nectarine', 'nectarines'],
  ['tangerine', 'tangerines'],
  ['clementine', 'clementines'],
  ['grapefruit', 'grapefruits'],
  ['pomegranate', 'pomegranates'],
  ['coconut', 'coconuts'],
  ['pineapple', 'pineapples'],
  ['watermelon', 'watermelons'],
  ['cantaloupe', 'cantaloupes'],
  ['honeydew', 'honeydews'],
  ['papaya', 'papayas'],
  ['guava', 'guavas'],
  ['radish', 'radishes'],
  ['turnip', 'turnips'],
  ['beet', 'beets'],
  ['parsnip', 'parsnips'],
  ['celery', 'celeries'],
  ['leek', 'leeks'],
  ['shallot', 'shallots'],
  ['artichoke', 'artichokes'],
  ['asparagus', 'asparaguses'],
  ['broccoli', 'broccolis'],
  ['cauliflower', 'cauliflowers'],
  ['cabbage', 'cabbages'],
  ['spinach', 'spinaches'],
  ['lettuce', 'lettuces'],
  ['kale', 'kales'],
  ['chard', 'chards'],
  ['endive', 'endives'],
];

// Nutrient number mapping (USDA standard numbers)
const NUTRIENT_MAP: Record<string, string> = {
  '208': 'calories', // Energy (kcal)
  '203': 'protein_g', // Protein
  '205': 'carbs_g', // Carbohydrate, by difference
  '204': 'fat_g', // Total lipid (fat)
  '291': 'fiber_g', // Fiber, total dietary
  '269': 'sugar_g', // Sugars, total including NLEA
  '307': 'sodium_mg', // Sodium, Na
  '601': 'cholesterol_mg', // Cholesterol
  '606': 'saturated_fat_g', // Fatty acids, total saturated
};

// TypeScript interfaces
interface FoodNutrient {
  nutrient: {
    id: number;
    number: string;
    name: string;
    unitName: string;
  };
  amount?: number;
}

interface FoodPortion {
  id: number;
  modifier?: string;
  gramWeight: number;
  sequenceNumber?: number;
  value?: number;
  amount?: number;
  measureUnit?: {
    id: number;
    name: string;
    abbreviation: string;
  };
}

interface FoodItem {
  fdcId: number;
  description: string;
  ndbNumber?: number;
  dataType: string;
  foodCategory?: { description: string };
  foodNutrients: FoodNutrient[];
  foodPortions?: FoodPortion[];
}

interface NutritionDocument {
  id: string;
  fdcId: number;
  ndbNumber: number;
  description: string;
  category: string;
  dataType: string;
  // Nutrition per 100g
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  saturated_fat_g: number;
  // Portions as JSON string
  portions: string;
  // Boost whole ingredients over processed foods
  is_raw: boolean;
}

// Load SR Legacy foods from JSON file
function loadSRLegacyFoods(): FoodItem[] {
  const filePath = path.join(
    __dirname,
    '../data/fooddata/FoodData_Central_sr_legacy_food_json_2021-10-28.json'
  );

  if (!fs.existsSync(filePath)) {
    console.warn('⚠️  SR Legacy file not found, skipping');
    return [];
  }

  console.log('📖 Loading SR Legacy foods...');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return data.SRLegacyFoods || [];
}

// Load Foundation foods from zip file
function loadFoundationFoods(): FoodItem[] {
  const zipPath = path.join(
    __dirname,
    '../data/fooddata/FoodData_Central_foundation_food_json_2024-10-31.zip'
  );

  if (!fs.existsSync(zipPath)) {
    console.warn('⚠️  Foundation zip file not found, skipping');
    return [];
  }

  console.log('📖 Loading Foundation foods from zip...');

  // Use unzip to extract and read the JSON
  const { execSync } = require('child_process');
  try {
    const jsonContent = execSync(`unzip -p "${zipPath}" foundationDownload.json`, {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
      encoding: 'utf-8',
    });
    const data = JSON.parse(jsonContent);
    return data.FoundationFoods || [];
  } catch (error) {
    console.warn('⚠️  Failed to extract Foundation foods:', (error as Error).message);
    return [];
  }
}

// Format portion for display
function formatPortion(portion: FoodPortion): { modifier: string; gramWeight: number } {
  let modifier = '';

  // SR Legacy uses modifier field directly
  if (portion.modifier && portion.modifier.trim()) {
    modifier = portion.modifier.trim();
  }
  // Foundation uses measureUnit.name with optional value/amount
  else if (portion.measureUnit && portion.measureUnit.name !== 'undetermined') {
    const quantity = portion.value || portion.amount || 1;
    modifier = quantity > 1 ? `${quantity} ${portion.measureUnit.name}` : portion.measureUnit.name;
  }

  return {
    modifier: modifier || 'serving',
    gramWeight: portion.gramWeight,
  };
}

// Check if food is a whole/raw ingredient (not processed)
function isRawIngredient(description: string): boolean {
  const lowerDesc = description.toLowerCase();

  // Negative indicators - processed foods or dishes (check first)
  const processedIndicators = [
    'juice',
    'canned',
    'dried',
    'cooked',
    'fried',
    'baked',
    'roasted',
    'boiled',
    'steamed',
    'sauce',
    'soup',
    'prepared',
    'frozen',
    'concentrate',
    'powder',
    'extract',
    'oil',
    'butter',
    'spread',
    'jam',
    'jelly',
    'pickled',
    'smoked',
    'cured',
    'pastry',
    'pastries',
    'cake',
    'pie',
    'cookie',
    'bread',
    'cereal',
    'chips',
    'crackers',
    'candy',
    'syrup',
    'drink',
    'beverage',
    'cocktail',
    'wine',
    'beer',
    'liquor',
  ];

  if (processedIndicators.some((indicator) => lowerDesc.includes(indicator))) {
    return false;
  }

  // Check for "raw" as a standalone descriptor (USDA format uses commas)
  // Examples: "Apples, raw", "Beef, raw", "Chicken, breast, raw"
  const parts = lowerDesc.split(',').map((p) => p.trim());
  const hasRawDescriptor = parts.some((part) => part === 'raw' || part.startsWith('raw ') || part.endsWith(' raw'));

  return hasRawDescriptor;
}

// Transform food item to Typesense document
function transformFood(food: FoodItem): NutritionDocument {
  // Extract nutrients by USDA number
  const nutrients: Record<string, number> = {};
  for (const fn of food.foodNutrients) {
    const fieldName = NUTRIENT_MAP[fn.nutrient.number];
    if (fieldName && fn.amount !== undefined) {
      nutrients[fieldName] = fn.amount;
    }
  }

  // Calculate calories from macros if not present
  // Standard conversion: protein=4 kcal/g, carbs=4 kcal/g, fat=9 kcal/g
  let calories = nutrients.calories || 0;
  if (calories === 0) {
    const protein = nutrients.protein_g || 0;
    const carbs = nutrients.carbs_g || 0;
    const fat = nutrients.fat_g || 0;
    if (protein > 0 || carbs > 0 || fat > 0) {
      calories = Math.round(protein * 4 + carbs * 4 + fat * 9);
    }
  }

  // Extract and format portions
  const portions = (food.foodPortions || [])
    .filter((p) => p.gramWeight > 0)
    .map(formatPortion)
    .filter((p) => p.modifier); // Remove empty modifiers

  return {
    id: `fdc-${food.fdcId}`,
    fdcId: food.fdcId,
    ndbNumber: food.ndbNumber || 0,
    description: food.description,
    category: food.foodCategory?.description || 'Uncategorized',
    dataType: food.dataType,
    calories,
    protein_g: nutrients.protein_g || 0,
    carbs_g: nutrients.carbs_g || 0,
    fat_g: nutrients.fat_g || 0,
    fiber_g: nutrients.fiber_g || 0,
    sugar_g: nutrients.sugar_g || 0,
    sodium_mg: nutrients.sodium_mg || 0,
    cholesterol_mg: nutrients.cholesterol_mg || 0,
    saturated_fat_g: nutrients.saturated_fat_g || 0,
    portions: JSON.stringify(portions),
    is_raw: isRawIngredient(food.description),
  };
}

async function indexNutritionToTypesense() {
  console.log('🔍 Indexing nutrition data to Typesense...\n');

  // Validate environment variables
  const host = process.env.TYPESENSE_HOST;
  const apiKey = process.env.TYPESENSE_ADMIN_API_KEY;

  if (!host || !apiKey) {
    console.error('❌ Missing TYPESENSE_HOST or TYPESENSE_ADMIN_API_KEY environment variables');
    process.exit(1);
  }

  // Initialize Typesense client
  const client = new Typesense.Client({
    nodes: [
      {
        host,
        port: parseInt(process.env.TYPESENSE_PORT || '443'),
        protocol: process.env.TYPESENSE_PROTOCOL || 'https',
      },
    ],
    apiKey,
    connectionTimeoutSeconds: 10,
  });

  // Load data from both sources
  const srLegacyFoods = loadSRLegacyFoods();
  const foundationFoods = loadFoundationFoods();

  console.log(`📊 Loaded ${srLegacyFoods.length} SR Legacy + ${foundationFoods.length} Foundation foods\n`);

  if (srLegacyFoods.length === 0 && foundationFoods.length === 0) {
    console.error('❌ No food data found. Please ensure FoodData files are in data/fooddata/');
    process.exit(1);
  }

  // Delete existing collection if it exists
  try {
    await client.collections(COLLECTION_NAME).delete();
    console.log('🗑️  Deleted existing collection');
  } catch (error: any) {
    if (error.httpStatus !== 404) {
      throw error;
    }
  }

  // Create collection schema
  const schema = {
    name: COLLECTION_NAME,
    fields: [
      { name: 'id', type: 'string' as const },
      { name: 'fdcId', type: 'int32' as const },
      { name: 'ndbNumber', type: 'int32' as const, optional: true },
      { name: 'description', type: 'string' as const },
      { name: 'category', type: 'string' as const, facet: true },
      { name: 'dataType', type: 'string' as const, facet: true },
      // Nutrition per 100g
      { name: 'calories', type: 'float' as const, optional: true },
      { name: 'protein_g', type: 'float' as const, optional: true },
      { name: 'carbs_g', type: 'float' as const, optional: true },
      { name: 'fat_g', type: 'float' as const, optional: true },
      { name: 'fiber_g', type: 'float' as const, optional: true },
      { name: 'sugar_g', type: 'float' as const, optional: true },
      { name: 'sodium_mg', type: 'float' as const, optional: true },
      { name: 'cholesterol_mg', type: 'float' as const, optional: true },
      { name: 'saturated_fat_g', type: 'float' as const, optional: true },
      // Portions stored as JSON string
      { name: 'portions', type: 'string' as const },
      // Boost whole ingredients over processed foods
      { name: 'is_raw', type: 'bool' as const },
    ],
  };

  await client.collections().create(schema);
  console.log('✅ Created collection schema\n');

  // Add synonyms for singular/plural forms
  console.log('📝 Adding ingredient synonyms...');
  for (const [singular, plural] of INGREDIENT_SYNONYMS) {
    await client.collections(COLLECTION_NAME).synonyms().upsert(singular, {
      synonyms: [singular, plural],
    });
  }
  console.log(`✅ Added ${INGREDIENT_SYNONYMS.length} synonym pairs\n`);

  // Transform all foods to documents
  // Foundation foods are added second, so they'll take precedence with upsert
  const allFoods = [...srLegacyFoods, ...foundationFoods];
  const documents = allFoods.map(transformFood);

  // Batch import documents
  console.log('📇 Indexing foods...');
  let indexed = 0;
  let errors = 0;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    const results = await client
      .collections(COLLECTION_NAME)
      .documents()
      .import(batch, { action: 'upsert' });

    // Count successful imports
    const successful = results.filter((r: any) => r.success).length;
    indexed += successful;

    // Count and log errors
    const batchErrors = results.filter((r: any) => !r.success);
    if (batchErrors.length > 0) {
      errors += batchErrors.length;
      console.warn(`   ⚠️  ${batchErrors.length} documents failed in batch ${Math.floor(i / BATCH_SIZE) + 1}`);
    }

    console.log(`   Indexed ${indexed}/${documents.length} foods...`);
  }

  // Summary
  console.log(`\n✅ Nutrition indexing complete!`);
  console.log(`📦 Collection: ${COLLECTION_NAME}`);
  console.log(`🥗 Indexed ${indexed} foods (${errors} errors)`);
  console.log(`\nNutrition values are stored per 100g. Use portions array to calculate for other units.`);
  console.log(`Example: For "1 cup", find portion with matching modifier and multiply nutrients by (gramWeight / 100)`);
}

// Run the indexing
indexNutritionToTypesense().catch((error) => {
  console.error('❌ Error indexing to Typesense:', error);
  process.exit(1);
});
