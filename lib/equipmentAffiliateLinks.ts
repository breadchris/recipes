/**
 * Equipment Affiliate Links Lookup
 *
 * Maps equipment names from recipes to affiliate product links.
 * Includes normalization for variant names.
 */

export type EquipmentCategory =
  | "cookware"
  | "knives"
  | "tools"
  | "appliances"
  | "bakeware"
  | "prep"
  | "measurement";

export interface EquipmentLink {
  name: string;
  amazonUrl: string;
  category: EquipmentCategory;
}

/**
 * Canonical equipment items with affiliate links.
 * Keys are lowercase canonical names.
 * amazonUrl should contain the full URL - the associate tag will be appended.
 */
export const equipmentLinks: Record<string, EquipmentLink> = {
  // Cookware (pots, pans, skillets)
  forks: {
    name: "Forks",
    amazonUrl: "https://amzn.to/453tLYd",
    category: "tools",
  },
  skillet: {
    name: "Skillet",
    amazonUrl: "https://amzn.to/4s8Yehb",
    category: "cookware",
  },
  "cast iron skillet": {
    name: "Cast Iron Skillet",
    amazonUrl: "https://amzn.to/4s8Yehb",
    category: "cookware",
  },
  "nonstick skillet": {
    name: "Nonstick Skillet",
    amazonUrl: "https://amzn.to/4pbZOMP",
    category: "cookware",
  },
  "carbon steel pan": {
    name: "Carbon Steel Pan",
    amazonUrl: "https://amzn.to/4qjjdvY",
    category: "cookware",
  },
  pot: {
    name: "Pot",
    amazonUrl: "https://amzn.to/4p6Zwa0",
    category: "cookware",
  },
  saucepan: {
    name: "Saucepan",
    amazonUrl: "https://amzn.to/3YDzwrJ",
    category: "cookware",
  },
  "dutch oven": {
    name: "Dutch Oven",
    amazonUrl: "https://amzn.to/3NcRajB",
    category: "cookware",
  },
  wok: {
    name: "Wok",
    amazonUrl: "https://amzn.to/4seIlpQ",
    category: "cookware",
  },
  "sauté pan": {
    name: "Sauté Pan",
    amazonUrl: "https://amzn.to/49nMpMM",
    category: "cookware",
  },
  "frying pan": {
    name: "Frying Pan",
    amazonUrl: "",
    category: "cookware",
  },
  griddle: {
    name: "Griddle",
    amazonUrl: "",
    category: "cookware",
  },
  "roasting pan": {
    name: "Roasting Pan",
    amazonUrl: "https://amzn.to/45n7cO6",
    category: "cookware",
  },
  "braising pan": {
    name: "Braising Pan",
    amazonUrl: "https://amzn.to/3NcRajB",
    category: "cookware",
  },
  "pressure cooker": {
    name: "Pressure Cooker",
    amazonUrl: "https://amzn.to/45jhqPu",
    category: "cookware",
  },
  "paella pan": {
    name: "Paella Pan",
    amazonUrl: "",
    category: "cookware",
  },
  stockpot: {
    name: "Stockpot",
    amazonUrl: "https://amzn.to/4saGEJJ",
    category: "cookware",
  },
  "crepe pan": {
    name: "Crepe Pan",
    amazonUrl: "",
    category: "cookware",
  },
  "grill pan": {
    name: "Grill Pan",
    amazonUrl: "",
    category: "cookware",
  },
  "cast iron griddle": {
    name: "Cast Iron Griddle",
    amazonUrl: "",
    category: "cookware",
  },
  comal: {
    name: "Comal",
    amazonUrl: "",
    category: "cookware",
  },
  donabe: {
    name: "Donabe",
    amazonUrl: "",
    category: "cookware",
  },
  "fondue pot": {
    name: "Fondue Pot",
    amazonUrl: "",
    category: "cookware",
  },
  "double boiler": {
    name: "Double Boiler",
    amazonUrl: "",
    category: "cookware",
  },
  "steamer basket": {
    name: "Steamer Basket",
    amazonUrl: "",
    category: "cookware",
  },
  "steamer pot": {
    name: "Steamer Pot",
    amazonUrl: "",
    category: "cookware",
  },
  saucier: {
    name: "Saucier",
    amazonUrl: "",
    category: "cookware",
  },
  braiser: {
    name: "Braiser",
    amazonUrl: "",
    category: "cookware",
  },

  // Knives
  knife: {
    name: "Chef's Knife",
    amazonUrl: "https://amzn.to/3N7ObsY",
    category: "knives",
  },
  "paring knife": {
    name: "Paring Knife",
    amazonUrl: "https://amzn.to/4qOoegB",
    category: "knives",
  },
  "serrated knife": {
    name: "Serrated Knife",
    amazonUrl: "https://amzn.to/4swCQCW",
    category: "knives",
  },
  "boning knife": {
    name: "Boning Knife",
    amazonUrl: "",
    category: "knives",
  },
  cleaver: {
    name: "Cleaver",
    amazonUrl: "",
    category: "knives",
  },
  "chef's knife": {
    name: "Chef's Knife",
    amazonUrl: "",
    category: "knives",
  },
  "bread knife": {
    name: "Bread Knife",
    amazonUrl: "https://amzn.to/4swCQCW",
    category: "knives",
  },
  "oyster knife": {
    name: "Oyster Knife",
    amazonUrl: "",
    category: "knives",
  },
  "slicing knife": {
    name: "Slicing Knife",
    amazonUrl: "",
    category: "knives",
  },
  "butter knife": {
    name: "Butter Knife",
    amazonUrl: "",
    category: "knives",
  },

  // Tools (utensils, hand tools)
  whisk: {
    name: "Whisk",
    amazonUrl: "",
    category: "tools",
  },
  spatula: {
    name: "Spatula",
    amazonUrl: "",
    category: "tools",
  },
  "wooden spoon": {
    name: "Wooden Spoon",
    amazonUrl: "",
    category: "tools",
  },
  tongs: {
    name: "Tongs",
    amazonUrl: "",
    category: "tools",
  },
  ladle: {
    name: "Ladle",
    amazonUrl: "",
    category: "tools",
  },
  "slotted spoon": {
    name: "Slotted Spoon",
    amazonUrl: "",
    category: "tools",
  },
  "mortar and pestle": {
    name: "Mortar and Pestle",
    amazonUrl: "",
    category: "tools",
  },
  "rolling pin": {
    name: "Rolling Pin",
    amazonUrl: "",
    category: "tools",
  },
  peeler: {
    name: "Vegetable Peeler",
    amazonUrl: "",
    category: "tools",
  },
  grater: {
    name: "Grater",
    amazonUrl: "",
    category: "tools",
  },
  "box grater": {
    name: "Box Grater",
    amazonUrl: "",
    category: "tools",
  },
  microplane: {
    name: "Microplane",
    amazonUrl: "",
    category: "tools",
  },
  strainer: {
    name: "Strainer",
    amazonUrl: "",
    category: "tools",
  },
  "fine mesh strainer": {
    name: "Fine Mesh Strainer",
    amazonUrl: "https://amzn.to/4jldS54",
    category: "tools",
  },
  colander: {
    name: "Colander",
    amazonUrl: "https://amzn.to/44QL8eH",
    category: "tools",
  },
  mandoline: {
    name: "Mandoline Slicer",
    amazonUrl: "",
    category: "tools",
  },
  "salad spinner": {
    name: "Salad Spinner",
    amazonUrl: "",
    category: "tools",
  },
  chopsticks: {
    name: "Cooking Chopsticks",
    amazonUrl: "",
    category: "tools",
  },
  brush: {
    name: "Pastry Brush",
    amazonUrl: "",
    category: "tools",
  },
  "bench scraper": {
    name: "Bench Scraper",
    amazonUrl: "",
    category: "tools",
  },
  "potato masher": {
    name: "Potato Masher",
    amazonUrl: "https://amzn.to/49DkJ6I",
    category: "tools",
  },
  masher: {
    name: "masher",
    amazonUrl: "https://amzn.to/49DkJ6I",
    category: "tools",
  },
  ricer: {
    name: "Potato Ricer",
    amazonUrl: "",
    category: "tools",
  },
  "kitchen shears": {
    name: "Kitchen Shears",
    amazonUrl: "",
    category: "tools",
  },
  "garlic press": {
    name: "Garlic Press",
    amazonUrl: "",
    category: "tools",
  },
  "citrus juicer": {
    name: "Citrus Juicer",
    amazonUrl: "",
    category: "tools",
  },
  "ice cream scoop": {
    name: "Ice Cream Scoop",
    amazonUrl: "",
    category: "tools",
  },
  "pastry bag": {
    name: "Pastry Bag",
    amazonUrl: "",
    category: "tools",
  },
  "offset spatula": {
    name: "Offset Spatula",
    amazonUrl: "",
    category: "tools",
  },
  "spider strainer": {
    name: "Spider Strainer",
    amazonUrl: "",
    category: "tools",
  },
  skimmer: {
    name: "Skimmer",
    amazonUrl: "",
    category: "tools",
  },
  cheesecloth: {
    name: "Cheesecloth",
    amazonUrl: "",
    category: "tools",
  },
  "kitchen twine": {
    name: "Kitchen Twine",
    amazonUrl: "",
    category: "tools",
  },
  "meat mallet": {
    name: "Meat Mallet",
    amazonUrl: "",
    category: "tools",
  },
  blowtorch: {
    name: "Kitchen Blowtorch",
    amazonUrl: "",
    category: "tools",
  },
  "kitchen torch": {
    name: "Kitchen Torch",
    amazonUrl: "",
    category: "tools",
  },
  "pizza cutter": {
    name: "Pizza Cutter",
    amazonUrl: "",
    category: "tools",
  },
  "pastry blender": {
    name: "Pastry Blender",
    amazonUrl: "https://amzn.to/45E0d3s",
    category: "tools",
  },
  "cookie cutter": {
    name: "Cookie Cutters",
    amazonUrl: "",
    category: "tools",
  },
  "dough whisk": {
    name: "Dough Whisk",
    amazonUrl: "",
    category: "tools",
  },
  "bread lame": {
    name: "Bread Lame",
    amazonUrl: "",
    category: "tools",
  },
  "dough scraper": {
    name: "Dough Scraper",
    amazonUrl: "",
    category: "tools",
  },
  "bowl scraper": {
    name: "Bowl Scraper",
    amazonUrl: "",
    category: "tools",
  },
  "pasta roller": {
    name: "Pasta Roller",
    amazonUrl: "",
    category: "tools",
  },
  spiralizer: {
    name: "Spiralizer",
    amazonUrl: "",
    category: "tools",
  },
  "meat tenderizer": {
    name: "Meat Tenderizer",
    amazonUrl: "",
    category: "tools",
  },
  "apple corer": {
    name: "Apple Corer",
    amazonUrl: "",
    category: "tools",
  },
  "can opener": {
    name: "Can Opener",
    amazonUrl: "",
    category: "tools",
  },
  "julienne peeler": {
    name: "Julienne Peeler",
    amazonUrl: "",
    category: "tools",
  },
  zester: {
    name: "Zester",
    amazonUrl: "",
    category: "tools",
  },
  funnel: {
    name: "Funnel",
    amazonUrl: "",
    category: "tools",
  },
  "silicone spatula": {
    name: "Silicone Spatula",
    amazonUrl: "",
    category: "tools",
  },
  "rubber spatula": {
    name: "Rubber Spatula",
    amazonUrl: "",
    category: "tools",
  },
  "fish spatula": {
    name: "Fish Spatula",
    amazonUrl: "",
    category: "tools",
  },
  "wooden spatula": {
    name: "Wooden Spatula",
    amazonUrl: "",
    category: "tools",
  },
  turner: {
    name: "Turner",
    amazonUrl: "",
    category: "tools",
  },
  "food mill": {
    name: "Food Mill",
    amazonUrl: "",
    category: "tools",
  },
  chinois: {
    name: "Chinois",
    amazonUrl: "",
    category: "tools",
  },
  sieve: {
    name: "Sieve",
    amazonUrl: "",
    category: "tools",
  },
  "cocktail shaker": {
    name: "Cocktail Shaker",
    amazonUrl: "",
    category: "tools",
  },
  muddler: {
    name: "Muddler",
    amazonUrl: "",
    category: "tools",
  },
  jigger: {
    name: "Jigger",
    amazonUrl: "",
    category: "tools",
  },
  "tortilla press": {
    name: "Tortilla Press",
    amazonUrl: "",
    category: "tools",
  },
  tamper: {
    name: "Espresso Tamper",
    amazonUrl: "",
    category: "tools",
  },
  "piping tips": {
    name: "Piping Tips",
    amazonUrl: "",
    category: "tools",
  },

  // Appliances
  oven: {
    name: "Oven",
    amazonUrl: "",
    category: "appliances",
  },
  grill: {
    name: "Grill",
    amazonUrl: "",
    category: "appliances",
  },
  blender: {
    name: "Blender",
    amazonUrl: "https://amzn.to/45E0d3s",
    category: "appliances",
  },
  "immersion blender": {
    name: "Immersion Blender",
    amazonUrl: "https://amzn.to/4ppAQtp",
    category: "appliances",
  },
  "food processor": {
    name: "Food Processor",
    amazonUrl: "",
    category: "appliances",
  },
  "stand mixer": {
    name: "Stand Mixer",
    amazonUrl: "",
    category: "appliances",
  },
  "hand mixer": {
    name: "Hand Mixer",
    amazonUrl: "",
    category: "appliances",
  },
  microwave: {
    name: "Microwave",
    amazonUrl: "",
    category: "appliances",
  },
  toaster: {
    name: "Toaster",
    amazonUrl: "",
    category: "appliances",
  },
  "toaster oven": {
    name: "Toaster Oven",
    amazonUrl: "",
    category: "appliances",
  },
  "rice cooker": {
    name: "Rice Cooker",
    amazonUrl: "",
    category: "appliances",
  },
  "espresso machine": {
    name: "Espresso Machine",
    amazonUrl: "",
    category: "appliances",
  },
  smoker: {
    name: "Smoker",
    amazonUrl: "",
    category: "appliances",
  },
  "deep fryer": {
    name: "Deep Fryer",
    amazonUrl: "",
    category: "appliances",
  },
  "spice grinder": {
    name: "Spice Grinder",
    amazonUrl: "",
    category: "appliances",
  },
  "meat grinder": {
    name: "Meat Grinder",
    amazonUrl: "",
    category: "appliances",
  },
  "pasta machine": {
    name: "Pasta Machine",
    amazonUrl: "",
    category: "appliances",
  },
  "waffle iron": {
    name: "Waffle Iron",
    amazonUrl: "",
    category: "appliances",
  },
  "pizza oven": {
    name: "Pizza Oven",
    amazonUrl: "",
    category: "appliances",
  },
  "sous vide": {
    name: "Sous Vide Machine",
    amazonUrl: "https://amzn.to/4q7c0zN",
    category: "appliances",
  },
  "vacuum sealer": {
    name: "Vacuum Sealer",
    amazonUrl: "",
    category: "appliances",
  },
  kettle: {
    name: "Electric Kettle",
    amazonUrl: "",
    category: "appliances",
  },
  "bamboo steamer": {
    name: "Bamboo Steamer",
    amazonUrl: "",
    category: "appliances",
  },
  "air fryer": {
    name: "Air Fryer",
    amazonUrl: "",
    category: "appliances",
  },
  "slow cooker": {
    name: "Slow Cooker",
    amazonUrl: "",
    category: "appliances",
  },
  dehydrator: {
    name: "Dehydrator",
    amazonUrl: "",
    category: "appliances",
  },
  "ice cream maker": {
    name: "Ice Cream Maker",
    amazonUrl: "",
    category: "appliances",
  },
  "coffee grinder": {
    name: "Coffee Grinder",
    amazonUrl: "",
    category: "appliances",
  },
  "electric mixer": {
    name: "Electric Mixer",
    amazonUrl: "",
    category: "appliances",
  },
  "milk frother": {
    name: "Milk Frother",
    amazonUrl: "",
    category: "appliances",
  },
  "french press": {
    name: "French Press",
    amazonUrl: "",
    category: "appliances",
  },
  "smoke gun": {
    name: "Smoke Gun",
    amazonUrl: "",
    category: "appliances",
  },
  "instant pot": {
    name: "Instant Pot",
    amazonUrl: "",
    category: "appliances",
  },
  "sandwich press": {
    name: "Sandwich Press",
    amazonUrl: "",
    category: "appliances",
  },
  rotisserie: {
    name: "Rotisserie",
    amazonUrl: "",
    category: "appliances",
  },

  // Bakeware
  "sheet pan": {
    name: "Sheet Pan",
    amazonUrl: "",
    category: "bakeware",
  },
  "baking dish": {
    name: "Baking Dish",
    amazonUrl: "",
    category: "bakeware",
  },
  "muffin tin": {
    name: "Muffin Tin",
    amazonUrl: "",
    category: "bakeware",
  },
  "pie pan": {
    name: "Pie Pan",
    amazonUrl: "",
    category: "bakeware",
  },
  "cake pan": {
    name: "Cake Pan",
    amazonUrl: "",
    category: "bakeware",
  },
  "baking steel": {
    name: "Baking Steel",
    amazonUrl: "",
    category: "bakeware",
  },
  "pizza stone": {
    name: "Pizza Stone",
    amazonUrl: "",
    category: "bakeware",
  },
  "pizza peel": {
    name: "Pizza Peel",
    amazonUrl: "",
    category: "bakeware",
  },
  "wire rack": {
    name: "Wire Cooling Rack",
    amazonUrl: "",
    category: "bakeware",
  },
  "casserole dish": {
    name: "Casserole Dish",
    amazonUrl: "",
    category: "bakeware",
  },
  "loaf pan": {
    name: "Loaf Pan",
    amazonUrl: "",
    category: "bakeware",
  },
  "springform pan": {
    name: "Springform Pan",
    amazonUrl: "",
    category: "bakeware",
  },
  molds: {
    name: "Molds",
    amazonUrl: "https://amzn.to/4sAZaeO",
    category: "bakeware",
  },
  "tart mold": {
    name: "Tart Mold",
    amazonUrl: "",
    category: "bakeware",
  },
  ramekin: {
    name: "Ramekins",
    amazonUrl: "",
    category: "bakeware",
  },
  "silicone mat": {
    name: "Silicone Baking Mat",
    amazonUrl: "",
    category: "bakeware",
  },
  "proofing basket": {
    name: "Proofing Basket",
    amazonUrl: "",
    category: "bakeware",
  },
  "9x13 inch pan": {
    name: "9x13 Inch Baking Pan",
    amazonUrl: "https://amzn.to/3Na7yS0",
    category: "bakeware",
  },
  banneton: {
    name: "Banneton",
    amazonUrl: "",
    category: "bakeware",
  },
  "pie plate": {
    name: "Pie Plate",
    amazonUrl: "",
    category: "bakeware",
  },
  "bread tin": {
    name: "Bread Tin",
    amazonUrl: "",
    category: "bakeware",
  },
  "cake tin": {
    name: "Cake Tin",
    amazonUrl: "",
    category: "bakeware",
  },
  "bundt pan": {
    name: "Bundt Pan",
    amazonUrl: "",
    category: "bakeware",
  },
  "pizza screen": {
    name: "Pizza Screen",
    amazonUrl: "",
    category: "bakeware",
  },
  "pullman loaf pan": {
    name: "Pullman Loaf Pan",
    amazonUrl: "",
    category: "bakeware",
  },
  "cupcake liners": {
    name: "Cupcake Liners",
    amazonUrl: "",
    category: "bakeware",
  },
  "pastry cutter": {
    name: "Pastry Cutter",
    amazonUrl: "",
    category: "bakeware",
  },
  "biscuit cutter": {
    name: "Biscuit Cutter",
    amazonUrl: "",
    category: "bakeware",
  },
  "ring mold": {
    name: "Ring Mold",
    amazonUrl: "",
    category: "bakeware",
  },

  // Prep (cutting boards, bowls, prep containers)
  "cutting board": {
    name: "Cutting Board",
    amazonUrl: "https://amzn.to/4jldS54",
    category: "prep",
  },
  "mixing bowl": {
    name: "Mixing Bowl Set",
    amazonUrl: "https://amzn.to/4aImrow",
    category: "prep",
  },
  "parchment paper": {
    name: "Parchment Paper",
    amazonUrl: "https://amzn.to/4pns8f9",
    category: "prep",
  },
  "plastic wrap": {
    name: "Plastic Wrap",
    amazonUrl: "",
    category: "prep",
  },
  "aluminum foil": {
    name: "Aluminum Foil",
    amazonUrl: "",
    category: "prep",
  },
  "paper towels": {
    name: "Paper Towels",
    amazonUrl: "",
    category: "prep",
  },
  "butcher paper": {
    name: "Butcher Paper",
    amazonUrl: "",
    category: "prep",
  },
  "wax paper": {
    name: "Wax Paper",
    amazonUrl: "",
    category: "prep",
  },
  "vacuum bag": {
    name: "Vacuum Seal Bags",
    amazonUrl: "",
    category: "prep",
  },
  "freezer bag": {
    name: "Freezer Bags",
    amazonUrl: "",
    category: "prep",
  },
  "mason jar": {
    name: "Mason Jars",
    amazonUrl: "",
    category: "prep",
  },
  "squeeze bottle": {
    name: "Squeeze Bottles",
    amazonUrl: "",
    category: "prep",
  },
  "spray bottle": {
    name: "Spray Bottle",
    amazonUrl: "",
    category: "prep",
  },

  // Measurement
  thermometer: {
    name: "Instant Read Thermometer",
    amazonUrl: "",
    category: "measurement",
  },
  scale: {
    name: "Kitchen Scale",
    amazonUrl: "",
    category: "measurement",
  },
  "measuring cups": {
    name: "Measuring Cups",
    amazonUrl: "",
    category: "measurement",
  },
  "measuring spoons": {
    name: "Measuring Spoons",
    amazonUrl: "",
    category: "measurement",
  },
};

/**
 * Normalization map: maps variant names to canonical names.
 * All keys should be lowercase.
 */
export const equipmentAliases: Record<string, string> = {
  // Cast iron variants
  "cast-iron skillet": "cast iron skillet",
  "cast iron pan": "cast iron skillet",
  "cast-iron pan": "cast iron skillet",

  // Nonstick variants
  "non-stick skillet": "nonstick skillet",
  "non-stick pan": "nonstick skillet",
  "nonstick pan": "nonstick skillet",
  "ceramic nonstick skillet": "nonstick skillet",

  // Dutch oven variants
  "dutch oven": "dutch oven",

  // Immersion blender variants
  "hand blender": "immersion blender",

  // Microplane variants
  "microplane grater": "microplane",
  zester: "microplane",

  // Mandoline variants
  mandolin: "mandoline",
  "mandoline slicer": "mandoline",
  "mandolin slicer": "mandoline",

  // Sheet pan variants
  "sheet tray": "sheet pan",
  "baking tray": "sheet pan",
  "baking sheet": "sheet pan",
  "rimmed baking sheet": "sheet pan",
  "rimmed baking sheets": "sheet pan",
  "cookie sheet": "sheet pan",

  // Strainer variants
  "fine strainer": "fine mesh strainer",
  "tea strainer": "fine mesh strainer",
  "double mesh strainer": "fine mesh strainer",

  // Bowl variants
  bowl: "mixing bowl",
  "large bowl": "mixing bowl",
  "mixing bowls": "mixing bowl",

  // Pot variants
  "large pot": "pot",
  "deep pot": "pot",
  "smaller pot": "pot",

  // Pan variants
  pan: "skillet",
  "large pan": "skillet",
  "wide pan": "skillet",
  "wide skillet": "skillet",
  "fry pan": "frying pan",
  "non-stick fry pan": "nonstick skillet",
  "stainless skillet": "skillet",
  "oven-safe pan": "skillet",
  "oven-safe skillet": "skillet",

  // Spoon variants
  spoon: "wooden spoon",
  "stirring spoon": "wooden spoon",
  "mixing spoon": "wooden spoon",

  // Peeler variants
  "vegetable peeler": "peeler",

  // Thermometer variants
  "digital thermometer": "thermometer",
  "probe thermometer": "thermometer",
  "meat thermometer": "thermometer",
  "instant-read thermometer": "thermometer",
  "handheld thermometer": "thermometer",
  "predictive thermometer": "thermometer",
  "temperature probe": "thermometer",

  // Scale variants
  "digital scale": "scale",
  "kitchen scale": "scale",

  // Measuring variants
  "measuring cup": "measuring cups",

  // Brush variants
  "pastry brush": "brush",
  "basting brush": "brush",
  "silicone brush": "brush",
  "grill brush": "brush",

  // Foil/wrap variants
  foil: "aluminum foil",
  "heavy-duty foil": "aluminum foil",
  "paper towel": "paper towels",

  // Scissors/shears variants
  scissors: "kitchen shears",
  "poultry shears": "kitchen shears",

  // Spider/skimmer variants
  "spider skimmer": "spider strainer",

  // Ricer variants
  "potato ricer": "ricer",

  // Citrus juicer variants
  "lime juicer": "citrus juicer",
  "citrus press": "citrus juicer",

  // Sous vide variants
  "sous-vide machine": "sous vide",

  // Pizza stone/steel variants
  "baking steel or stone": "baking steel",

  // Stockpot variants
  "22-quart stockpot": "stockpot",

  // Misc variants
  "wok spatula": "spatula",
  "rubber spatula": "spatula",
  "stiff spatula": "spatula",
  "wooden spatula": "spatula",
  "cooking chopsticks": "chopsticks",
  molcajete: "mortar and pestle",
  mortar: "mortar and pestle",
  skewers: "skewer",
  toothpicks: "toothpick",
  fork: "forks",
  twine: "kitchen twine",
  string: "kitchen twine",
  "piping bag": "pastry bag",
  "cheese grater": "grater",
  "food processor or grater": "food processor",
  "mini chopper or food processor": "food processor",
  "meat grinder or food processor": "meat grinder",
  "electric kettle": "kettle",
  "charcoal grill": "grill",
  "gas grill or toaster oven": "grill",
  "grill or broiler": "grill",
  "chimney starter": "grill",
  "charcoal chimney": "grill",

  // Size variants - skillets
  "10-inch skillet": "skillet",
  "12-inch skillet": "skillet",
  "10-inch nonstick skillet": "nonstick skillet",
  "12-inch nonstick skillet": "nonstick skillet",
  "10-inch non-stick skillet": "nonstick skillet",
  "12-inch non-stick skillet": "nonstick skillet",
  "10-inch pan": "skillet",
  "10-inch nonstick pan": "nonstick skillet",
  "large skillet": "skillet",
  "small skillet": "skillet",
  "deep pan": "skillet",
  "heavy pan": "skillet",
  "heavy-bottom pot": "pot",
  "heavy-bottomed pot": "pot",
  "stainless steel pan": "skillet",
  "14-inch flat-bottomed carbon steel wok": "wok",

  // Size variants - saucepans/pots
  "medium pot": "pot",
  "small pot": "pot",
  "large saucepan": "saucepan",
  "medium saucepan": "saucepan",
  "small saucepan": "saucepan",
  "2-quart saucier": "saucier",
  "deep saucepan": "saucepan",
  "medium-sized pot": "pot",
  "cooking pot": "pot",
  "heavy-bottom saucepan": "saucepan",

  // Size variants - bowls
  "medium bowl": "mixing bowl",
  "small bowl": "mixing bowl",
  "smaller bowl": "mixing bowl",
  "heatproof bowl": "mixing bowl",
  "metal bowl": "mixing bowl",
  "glass bowl": "mixing bowl",

  // Torch variants
  "blow torch": "blowtorch",
  torch: "blowtorch",

  // Lame variants
  lame: "bread lame",
  "baker's lame": "bread lame",
  "razor blade": "bread lame",

  // Banneton/proofing variants
  "banneton basket": "banneton",

  // Cookie cutter variants
  "cookie cutters": "cookie cutter",

  // Silicone mat variants
  silpat: "silicone mat",
  "silicone baking mat": "silicone mat",

  // Cast iron variants
  "cast iron": "cast iron skillet",
  "enameled dutch oven": "dutch oven",
  "enameled Dutch oven": "dutch oven",
  "Dutch oven": "dutch oven",

  // Crepe pan variants
  "crêpe pan": "crepe pan",
  "crepe maker": "crepe pan",

  // Chef's knife variants
  "chef knife": "chef's knife",
  "chefs knife": "chef's knife",
  "sharp knife": "chef's knife",

  // Ice cream maker variants
  "ice cream machine": "ice cream maker",

  // Waffle maker variants
  "waffle maker": "waffle iron",

  // Bag variants
  "ziploc bag": "freezer bag",
  "ziplock bag": "freezer bag",
  "zipper lock bag": "freezer bag",
  "zip-top bag": "freezer bag",
  "zip top bag": "freezer bag",
  "Ziploc bag": "freezer bag",
  "resealable bag": "freezer bag",
  "gallon zipper lock bag": "freezer bag",
  "freeze lock bag": "freezer bag",
  "brining bags": "freezer bag",

  // Sous vide variants
  "sous vide machine": "sous vide",
  "immersion circulator": "sous vide",
  "sous-vide bag": "vacuum bag",
  "sous vide bag": "vacuum bag",
  "vacuum seal bag": "vacuum bag",

  // Twine variants
  "cooking twine": "kitchen twine",
  "butcher twine": "kitchen twine",
  "kitchen string": "kitchen twine",
  "cotton string": "kitchen twine",

  // Instant pot variants
  "Instant Pot": "instant pot",
  "Instant Pot Duo Crisp": "instant pot",

  // Air fryer variants
  "air fryer rack": "air fryer",
  "air fryer racks": "air fryer",
  "air fryer tray": "air fryer",

  // Slow cooker variants
  "crock pot": "slow cooker",

  // Griddle variants
  "griddle pan": "griddle",
  "griddle or skillet": "griddle",
  "plancha or skillet": "griddle",

  // Steamer variants
  steamer: "steamer basket",

  // Misc tool aliases
  "bench scraper": "dough scraper",
  "kitchen scraper": "dough scraper",
  "instant read thermometer": "thermometer",
  "candy thermometer": "thermometer",
  shears: "kitchen shears",
  "seafood scissors": "kitchen shears",
  "shrimp shears": "kitchen shears",
  "wire skimmer": "skimmer",
  "mesh spider": "spider strainer",
  spider: "spider strainer",
  "lemon juicer": "citrus juicer",
  juicer: "citrus juicer",
  "cooling rack": "wire rack",
  "cooling racks": "wire rack",
  "resting rack": "wire rack",
  "mesh rack": "wire rack",

  // Baking pan variants
  "9x13 pan": "9x13 inch pan",
  "9x13 baking dish": "9x13 inch pan",
  "9 by 13 inch pan": "9x13 inch pan",
  "13 by 9 dish": "9x13 inch pan",
  "13x9 inch pan": "9x13 inch pan",
};

/**
 * Look up equipment link by name (handles normalization).
 */
export function getEquipmentLink(equipment: string): EquipmentLink | null {
  const normalized = equipment.toLowerCase().trim();
  const canonical = equipmentAliases[normalized] ?? normalized;
  return equipmentLinks[canonical] ?? null;
}

/**
 * Get the affiliate URL for equipment, with associate tag appended.
 * Returns null if equipment not found or no URL configured.
 */
export function getEquipmentAffiliateUrl(equipment: string): string | null {
  const link = getEquipmentLink(equipment);
  if (!link || !link.amazonUrl) return null;

  const tag = process.env.AMAZON_ASSOCIATE_TAG || "";
  if (!tag) return link.amazonUrl;

  // Append tag if URL doesn't already have one
  const url = new URL(link.amazonUrl);
  if (!url.searchParams.has("tag")) {
    url.searchParams.set("tag", tag);
  }
  return url.toString();
}

/**
 * Get all equipment in a specific category.
 */
export function getEquipmentByCategory(
  category: EquipmentCategory,
): Array<{ key: string; link: EquipmentLink }> {
  return Object.entries(equipmentLinks)
    .filter(([, link]) => link.category === category)
    .map(([key, link]) => ({ key, link }));
}

/**
 * Get canonical name for equipment (resolves aliases).
 */
export function getCanonicalEquipmentName(equipment: string): string {
  const normalized = equipment.toLowerCase().trim();
  return equipmentAliases[normalized] ?? normalized;
}
