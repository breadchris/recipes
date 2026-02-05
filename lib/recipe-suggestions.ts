// Recipe categories (nouns)
const categories = [
  'hamburger',
  'pasta',
  'soup',
  'salad',
  'stir-fry',
  'tacos',
  'pizza',
  'curry',
  'sandwich',
  'risotto',
  'steak',
  'chicken',
  'salmon',
  'ramen',
  'burrito',
  'omelette',
  'fried rice',
  'noodles',
  'wings',
  'quesadilla',
  'mac and cheese',
  'chili',
  'shrimp',
  'meatballs',
  'lasagna',
];

// Adjectives to describe recipes
const adjectives = [
  'crunchy',
  'creamy',
  'spicy',
  'savory',
  'tangy',
  'smoky',
  'zesty',
  'cheesy',
  'crispy',
  'buttery',
  'garlicky',
  'herby',
  'sweet',
  'caramelized',
  'grilled',
  'roasted',
  'braised',
  'loaded',
  'stuffed',
  'homemade',
];

// Placeholder templates
const templates = [
  (adj: string, cat: string) => `Try a ${adj} ${cat}...`,
  (adj: string, cat: string) => `How about ${adj} ${cat}?`,
  (adj: string, cat: string) => `What about a ${adj} ${cat}?`,
  (adj: string, cat: string) => `Maybe some ${adj} ${cat}?`,
  (adj: string, cat: string) => `${adj} ${cat} sounds good...`,
];

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Get a random adjective
 */
export function getRandomAdjective(): string {
  return getRandomItem(adjectives);
}

/**
 * Get a random recipe category
 */
export function getRandomCategory(): string {
  return getRandomItem(categories);
}

/**
 * Generate a random placeholder suggestion
 */
export function getRandomPlaceholder(): string {
  const adj = getRandomItem(adjectives);
  const cat = getRandomItem(categories);
  const template = getRandomItem(templates);
  return template(adj, cat);
}

/**
 * Generate multiple unique placeholders
 */
export function getRandomPlaceholders(count: number): string[] {
  const placeholders: string[] = [];
  const seen = new Set<string>();

  while (placeholders.length < count && placeholders.length < categories.length * adjectives.length) {
    const placeholder = getRandomPlaceholder();
    if (!seen.has(placeholder)) {
      seen.add(placeholder);
      placeholders.push(placeholder);
    }
  }

  return placeholders;
}

// Cooking waiting phrases for loading state
const waitingPhrases = [
  'preheating the oven',
  'emulsifying oil and water',
  'simmering the broth',
  'whisking the batter',
  'caramelizing the onions',
  'deglazing the pan',
  'reducing the sauce',
  'proofing the dough',
  'toasting the spices',
  'blanching the vegetables',
  'tempering the chocolate',
  'resting the meat',
  'clarifying the butter',
  'folding in the eggs',
  'infusing the cream',
];

/**
 * Get a random cooking waiting phrase for loading states
 */
export function getRandomWaitingPhrase(): string {
  return getRandomItem(waitingPhrases);
}

// Example questions for modification input placeholder
const exampleQuestions = [
  'Can I make this ahead of time?',
  'How long will leftovers keep?',
  'Can I freeze this?',
  'What side dishes pair well?',
  "What's a good vegetarian substitute?",
  'Can I use an air fryer instead?',
  'How do I make this gluten-free?',
  'What wine pairs with this?',
];

/**
 * Get a random example question for the modification input
 */
export function getRandomExampleQuestion(): string {
  return getRandomItem(exampleQuestions);
}
