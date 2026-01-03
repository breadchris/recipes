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

  // Knives
  knife: {
    name: "Chef's Knife",
    amazonUrl: "",
    category: "knives",
  },
  "paring knife": {
    name: "Paring Knife",
    amazonUrl: "",
    category: "knives",
  },
  "serrated knife": {
    name: "Serrated Knife",
    amazonUrl: "",
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
    amazonUrl: "",
    category: "tools",
  },
  colander: {
    name: "Colander",
    amazonUrl: "",
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
    amazonUrl: "",
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
    amazonUrl: "",
    category: "appliances",
  },
  "immersion blender": {
    name: "Immersion Blender",
    amazonUrl: "",
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
    amazonUrl: "",
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

  // Prep (cutting boards, bowls, prep containers)
  "cutting board": {
    name: "Cutting Board",
    amazonUrl: "",
    category: "prep",
  },
  "mixing bowl": {
    name: "Mixing Bowl Set",
    amazonUrl: "",
    category: "prep",
  },
  "parchment paper": {
    name: "Parchment Paper",
    amazonUrl: "",
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
