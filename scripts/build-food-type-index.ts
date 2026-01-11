import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

/**
 * Build a food type index by classifying recipes based on keywords in titles and descriptions.
 * This enables filtering/browsing by dish category (burger, pizza, salad, etc.)
 */

// Food type taxonomy with keyword patterns
// Keywords are matched case-insensitively against title and description
const FOOD_TYPE_KEYWORDS: Record<string, string[]> = {
  // Core categories (300+ recipes expected)
  dessert: [
    'cake', 'brownie', 'brownies', 'cookie', 'cookies', 'pie', 'tart', 'mousse',
    'cheesecake', 'ice cream', 'gelato', 'sorbet', 'flan', 'pudding', 'trifle',
    'éclair', 'eclair', 'macaron', 'macarons', 'cupcake', 'cupcakes', 'truffle',
    'truffles', 'candy', 'candies', 'chocolate', 'caramel', 'tiramisu', 'pavlova',
    'meringue', 'custard', 'creme brulee', 'crème brûlée', 'panna cotta',
    'churro', 'churros', 'donut', 'doughnut', 'profiterole', 'shortcake',
    'cobbler', 'crumble', 'crisp', 'bark', 'fudge', 'biscotti'
  ],
  chicken: [
    'chicken', 'fried chicken', 'wings', 'wing', 'rotisserie', 'poultry',
    'hen', 'cornish hen'
  ],
  beef: [
    'steak', 'steaks', 'prime rib', 'ribeye', 'rib eye', 'wellington',
    'short rib', 'short ribs', 'brisket', 'beef', 'filet mignon', 'tenderloin',
    'sirloin', 'strip steak', 'flank steak', 'skirt steak', 'tri-tip', 'tri tip',
    'roast beef', 'pot roast', 'chuck roast', 'meatloaf', 'meatball', 'meatballs'
  ],
  vegetable: [
    'vegetable', 'vegetables', 'veggie', 'veggies', 'beans', 'legumes', 'lentil',
    'lentils', 'spinach', 'kale', 'potato', 'potatoes', 'mushroom', 'mushrooms',
    'tofu', 'tempeh', 'cauliflower', 'broccoli', 'asparagus', 'artichoke',
    'eggplant', 'aubergine', 'zucchini', 'squash', 'brussels sprout', 'brussels sprouts',
    'green bean', 'green beans', 'corn', 'beet', 'beets', 'carrot', 'carrots'
  ],
  bread: [
    'bread', 'baguette', 'biscuit', 'biscuits', 'croissant', 'croissants',
    'pretzel', 'pretzels', 'muffin', 'muffins', 'scone', 'scones', 'crepe',
    'crepes', 'pancake', 'pancakes', 'waffle', 'waffles', 'doughnut', 'doughnuts',
    'donut', 'donuts', 'bagel', 'bagels', 'focaccia', 'ciabatta', 'brioche',
    'sourdough', 'cornbread', 'roll', 'rolls', 'toast', 'french toast',
    'pita', 'naan', 'flatbread'
  ],
  seafood: [
    'fish', 'salmon', 'cod', 'tuna', 'shrimp', 'prawn', 'prawns', 'lobster',
    'crab', 'oyster', 'oysters', 'scallop', 'scallops', 'clam', 'clams',
    'mussel', 'mussels', 'calamari', 'squid', 'octopus', 'anchovy', 'anchovies',
    'tilapia', 'halibut', 'trout', 'bass', 'sea bass', 'snapper', 'mahi',
    'swordfish', 'catfish', 'sardine', 'sardines', 'mackerel', 'ceviche'
  ],
  breakfast: [
    'egg', 'eggs', 'omelette', 'omelet', 'hash brown', 'hash browns', 'hashbrown',
    'quiche', 'brunch', 'scrambled', 'fried egg', 'poached egg', 'benedict',
    'eggs benedict', 'frittata', 'shakshuka', 'huevos rancheros', 'breakfast'
  ],
  pasta: [
    'pasta', 'spaghetti', 'lasagna', 'lasagne', 'bolognese', 'risotto', 'polenta',
    'gnocchi', 'ravioli', 'linguine', 'fettuccine', 'penne', 'rigatoni',
    'tortellini', 'macaroni', 'mac and cheese', 'mac & cheese', 'carbonara',
    'alfredo', 'primavera', 'marinara', 'puttanesca', 'arrabbiata', 'cacio e pepe',
    'orzo', 'farfalle', 'orecchiette', 'ziti', 'bucatini', 'tagliatelle'
  ],
  pork: [
    'pork', 'ham', 'bacon', 'chorizo', 'sausage', 'sausages', 'bratwurst',
    'pork chop', 'pork chops', 'pulled pork', 'carnitas', 'pork belly',
    'pork shoulder', 'pork loin', 'pork tenderloin', 'spare rib', 'spare ribs',
    'baby back', 'baby back ribs', 'prosciutto', 'pancetta', 'guanciale',
    'kielbasa', 'andouille', 'hot dog', 'hot dogs'
  ],
  sauce: [
    'sauce', 'dressing', 'vinaigrette', 'aioli', 'chutney', 'marinade',
    'ketchup', 'jam', 'jelly', 'condiment', 'gravy', 'salsa', 'pesto',
    'hummus', 'guacamole', 'tzatziki', 'chimichurri', 'hollandaise',
    'béarnaise', 'bearnaise', 'béchamel', 'bechamel', 'remoulade', 'tartar',
    'mayo', 'mayonnaise', 'mustard', 'relish', 'syrup', 'glaze'
  ],
  asian: [
    'stir-fry', 'stir fry', 'stirfry', 'pad thai', 'tandoori', 'sichuan',
    'szechuan', 'teriyaki', 'dim sum', 'dumpling', 'dumplings', 'wonton',
    'wontons', 'spring roll', 'spring rolls', 'egg roll', 'egg rolls',
    'fried rice', 'curry', 'tikka masala', 'korma', 'vindaloo', 'biryani',
    'satay', 'samosa', 'samosas', 'tempura', 'katsu', 'gyoza', 'bao',
    'banh mi', 'bulgogi', 'bibimbap', 'kimchi', 'miso', 'edamame',
    'kung pao', 'general tso', 'orange chicken', 'sesame chicken',
    'sweet and sour', 'lo mein', 'chow mein', 'chow fun', 'mongolian'
  ],
  soup: [
    'soup', 'borscht', 'broth', 'chowder', 'bisque', 'stew', 'gumbo',
    'bouillabaisse', 'gazpacho', 'minestrone', 'pho', 'ramen', 'miso soup',
    'consommé', 'consomme', 'pozole', 'menudo', 'tom yum', 'laksa',
    'cioppino', 'clam chowder', 'chicken soup', 'tortilla soup'
  ],
  bbq: [
    'grilled', 'grill', 'grilling', 'barbecue', 'barbeque', 'bbq',
    'smoked', 'smoke', 'smoking', 'charred', 'seared', 'flame',
    'ribs', 'pulled', 'burnt ends', 'texas style', 'kansas city',
    'carolina', 'memphis', 'brisket'
  ],
  mexican: [
    'taco', 'tacos', 'quesadilla', 'quesadillas', 'enchilada', 'enchiladas',
    'chilaquiles', 'tamale', 'tamales', 'elote', 'burrito', 'burritos',
    'fajita', 'fajitas', 'carnitas', 'carne asada', 'birria', 'quesabirria',
    'tostada', 'tostadas', 'nachos', 'chimichanga', 'chimichangas',
    'empanada', 'empanadas', 'churro', 'churros', 'mole', 'pozole',
    'street corn', 'mexican', 'tex-mex', 'tex mex'
  ],
  sandwich: [
    'sandwich', 'sandwiches', 'cheesesteak', 'torta', 'banh mi', 'hoagie',
    'sub', 'submarine', 'panini', 'wrap', 'wraps', 'club', 'blt',
    'grilled cheese', 'melt', 'po boy', 'po\'boy', 'poboy', 'reuben',
    'cuban', 'cubano', 'monte cristo', 'sloppy joe', 'philly'
  ],
  salad: [
    'salad', 'salads', 'coleslaw', 'slaw', 'caesar', 'cobb', 'greek salad',
    'wedge salad', 'caprese', 'niçoise', 'nicoise', 'waldorf', 'chopped'
  ],
  burger: [
    'burger', 'burgers', 'hamburger', 'hamburgers', 'cheeseburger', 'cheeseburgers',
    'patty', 'patties', 'smash burger', 'smashburger', 'slider', 'sliders'
  ],

  // Secondary categories (100-299 recipes expected)
  pizza: [
    'pizza', 'pizzas', 'flatbread', 'calzone', 'calzones', 'stromboli',
    'deep dish', 'neapolitan', 'margherita', 'pepperoni pizza'
  ],
  italian: [
    'carbonara', 'pesto', 'minestrone', 'osso buco', 'ossobuco', 'parmigiana',
    'parmesan', 'piccata', 'marsala', 'saltimbocca', 'cacciatore', 'arancini',
    'bruschetta', 'antipasto', 'caprese', 'carpaccio', 'vitello',
    'italian', 'tuscan', 'sicilian', 'neapolitan'
  ],
  french: [
    'coq au vin', 'bourguignon', 'boeuf bourguignon', 'ratatouille',
    'béarnaise', 'bearnaise', 'béchamel', 'bechamel', 'bouillabaisse',
    'cassoulet', 'confit', 'croque', 'croque monsieur', 'croque madame',
    'french', 'provençal', 'provencal', 'lyonnaise', 'niçoise', 'nicoise',
    'gratin', 'dauphinoise', 'soufflé', 'souffle', 'quiche lorraine',
    'blanquette', 'pot-au-feu', 'pot au feu', 'tarte tatin', 'clafoutis'
  ],
  noodle: [
    'ramen', 'pho', 'lo mein', 'chow mein', 'udon', 'soba', 'noodle', 'noodles',
    'pad thai', 'pad see ew', 'japchae', 'laksa', 'dan dan', 'zha jiang',
    'rice noodle', 'rice noodles', 'glass noodle', 'glass noodles',
    'vermicelli', 'chow fun', 'ho fun', 'mei fun'
  ],
  appetizer: [
    'dip', 'dips', 'starter', 'starters', 'skewer', 'skewers', 'tapas',
    'croquette', 'croquettes', 'spring roll', 'spring rolls', 'appetizer',
    'appetizers', 'hors d\'oeuvre', 'hors d\'oeuvres', 'canapé', 'canape',
    'antipasti', 'mezze', 'finger food', 'bite', 'bites', 'nibble', 'nibbles',
    'crostini', 'bruschetta', 'deviled egg', 'deviled eggs'
  ],
  drink: [
    'cocktail', 'cocktails', 'mocktail', 'mocktails', 'margarita', 'margaritas',
    'sangria', 'smoothie', 'smoothies', 'beverage', 'beverages', 'drink', 'drinks',
    'martini', 'mojito', 'daiquiri', 'cosmopolitan', 'manhattan', 'old fashioned',
    'negroni', 'whiskey sour', 'paloma', 'moscow mule', 'espresso martini',
    'milkshake', 'shake', 'lemonade', 'punch', 'spritz', 'aperol'
  ],
  casserole: [
    'casserole', 'casseroles', 'pot pie', 'pot pies', 'pot roast', 'gratin',
    'moussaka', 'hash', 'bake', 'hotdish', 'hot dish', 'one pot', 'one-pot',
    'shepherd\'s pie', 'shepherds pie', 'cottage pie', 'tater tot',
    'king ranch', 'green bean casserole', 'tuna casserole'
  ],
};

// Priority order for categories (when a recipe matches multiple, prefer these)
// Lower index = higher priority
const CATEGORY_PRIORITY = [
  'burger', 'pizza', 'taco', 'sandwich', 'salad', 'soup',
  'pasta', 'noodle', 'asian', 'mexican', 'italian', 'french',
  'dessert', 'bread', 'breakfast', 'appetizer', 'drink',
  'chicken', 'beef', 'pork', 'seafood', 'vegetable',
  'bbq', 'casserole', 'sauce'
];

interface FoodTypeIndex {
  // Mapping of videoId to food types
  videoFoodTypes: Record<string, string[]>;
  // Statistics by food type
  stats: Record<string, number>;
  // Build metadata
  meta: {
    buildTime: string;
    totalVideos: number;
    classifiedVideos: number;
    unclassifiedVideos: number;
    coveragePercent: number;
  };
}

interface Recipe {
  title?: string;
  description?: string;
}

interface Video {
  id: string;
  title: string;
  description?: string;
  recipes?: Recipe[];
}

interface RecipesData {
  videos: Video[];
}

function classifyRecipe(title: string, description: string = ''): string[] {
  const text = `${title} ${description}`.toLowerCase();
  const matchedTypes: string[] = [];

  for (const [foodType, keywords] of Object.entries(FOOD_TYPE_KEYWORDS)) {
    for (const keyword of keywords) {
      // Word boundary matching to avoid partial matches
      // e.g., "steak" shouldn't match "cheesesteak" (that's handled by sandwich)
      const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(text)) {
        matchedTypes.push(foodType);
        break; // Only add each food type once
      }
    }
  }

  // Sort by priority
  matchedTypes.sort((a, b) => {
    const aIndex = CATEGORY_PRIORITY.indexOf(a);
    const bIndex = CATEGORY_PRIORITY.indexOf(b);
    return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
  });

  return matchedTypes;
}

async function buildFoodTypeIndex() {
  console.log('🍔 Building food type index...');

  // Load recipes data
  const dataPath = path.join(__dirname, '../data/recipes-data.json.gz');
  const compressedData = fs.readFileSync(dataPath);
  const decompressedData = zlib.gunzipSync(compressedData);
  const recipesData: RecipesData = JSON.parse(decompressedData.toString());

  console.log(`📊 Processing ${recipesData.videos.length} videos...`);

  const videoFoodTypes: Record<string, string[]> = {};
  const stats: Record<string, number> = {};
  let classifiedCount = 0;

  // Initialize stats
  for (const foodType of Object.keys(FOOD_TYPE_KEYWORDS)) {
    stats[foodType] = 0;
  }

  recipesData.videos.forEach((video) => {
    // Combine video title/description with recipe titles/descriptions
    let combinedText = `${video.title} ${video.description || ''}`;

    if (video.recipes) {
      video.recipes.forEach((recipe) => {
        combinedText += ` ${recipe.title || ''} ${recipe.description || ''}`;
      });
    }

    const foodTypes = classifyRecipe(video.title, combinedText);

    if (foodTypes.length > 0) {
      videoFoodTypes[video.id] = foodTypes;
      classifiedCount++;

      // Update stats
      foodTypes.forEach((type) => {
        stats[type]++;
      });
    }
  });

  const totalVideos = recipesData.videos.length;
  const coveragePercent = (classifiedCount / totalVideos) * 100;

  const index: FoodTypeIndex = {
    videoFoodTypes,
    stats,
    meta: {
      buildTime: new Date().toISOString(),
      totalVideos,
      classifiedVideos: classifiedCount,
      unclassifiedVideos: totalVideos - classifiedCount,
      coveragePercent: Math.round(coveragePercent * 100) / 100,
    },
  };

  // Write to file
  const outputPath = path.join(__dirname, '../data/food-type-index.json');
  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2));

  console.log(`\n✅ Food type index built successfully!`);
  console.log(`📁 Output: ${outputPath}`);
  console.log(`\n📊 Statistics:`);
  console.log(`   Total videos: ${totalVideos}`);
  console.log(`   Classified: ${classifiedCount} (${coveragePercent.toFixed(1)}%)`);
  console.log(`   Unclassified: ${totalVideos - classifiedCount} (${(100 - coveragePercent).toFixed(1)}%)`);
  console.log(`\n📈 Food type distribution:`);

  // Sort by count and display
  const sortedStats = Object.entries(stats)
    .sort((a, b) => b[1] - a[1]);

  sortedStats.forEach(([type, count]) => {
    const pct = ((count / totalVideos) * 100).toFixed(1);
    console.log(`   ${type}: ${count} (${pct}%)`);
  });
}

// Run the build
buildFoodTypeIndex().catch((error) => {
  console.error('❌ Error building food type index:', error);
  process.exit(1);
});
