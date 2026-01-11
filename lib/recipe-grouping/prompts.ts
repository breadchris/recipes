/**
 * LLM prompts for recipe type extraction and grouping
 */

/**
 * System prompt for dish name extraction (Pass 1)
 */
export const EXTRACTION_SYSTEM_PROMPT = `You are a culinary expert who specializes in categorizing and classifying dishes. Your task is to extract the core dish name from recipe titles and identify regional variations.

You have deep knowledge of:
- Global cuisines and their regional variations
- Cooking techniques and methods
- How dishes are named across different cultures
- The difference between technique-focused content and dish-focused recipes`;

/**
 * User prompt template for dish name extraction (Pass 1)
 * Processes a batch of recipe titles
 */
export const EXTRACTION_USER_PROMPT = `Analyze the following recipe titles and extract the core dish name for each.

For each recipe:
1. Extract the core dish name (remove time prefixes like "150-Hour", adjectives like "Best", "Ultimate", "Perfect")
2. Identify the dish category (a normalized slug like "fried-chicken", "tacos", "chocolate-cake")
3. Identify regional/cultural style if present (Korean, Southern, Japanese, Italian, etc.)
4. Determine if this is technique-focused (teaching a method) vs dish-focused (making a specific dish)
5. Rate your confidence (high/medium/low)

Rules:
- Remove time-based prefixes ("150-Hour", "Quick", "Easy", "30-Minute")
- Remove superlatives ("Best", "Ultimate", "Perfect", "Crispiest")
- Remove channel/show suffixes ("| America's Test Kitchen")
- KEEP regional identifiers as part of the dish name ("Korean Fried Chicken", not just "Fried Chicken")
- "Sandwich" versions are DIFFERENT from base dish ("Fried Chicken Sandwich" != "Fried Chicken")
- For multi-dish titles, extract the PRIMARY dish mentioned
- Use lowercase slugs with hyphens for dish_category (e.g., "fried-chicken", "chocolate-chip-cookies")

Recipes to analyze:
{recipes}

Respond with JSON in this exact format:
{
  "extractions": [
    {
      "video_id": "...",
      "original_title": "...",
      "dish_name": "extracted dish name",
      "dish_category": "slug-format-category",
      "regional_style": "Regional Style" or null,
      "is_technique_focused": false,
      "confidence": "high"
    }
  ]
}`;

/**
 * System prompt for hierarchical grouping (Pass 2)
 */
export const GROUPING_SYSTEM_PROMPT = `You are a culinary taxonomy expert who organizes dishes into meaningful hierarchical categories. You understand the relationships between dishes, their regional variations, and how to group similar recipes for comparison.

Your goal is to create groups that allow home cooks to compare different approaches to the same dish (e.g., "How does Kenji's fried chicken compare to America's Test Kitchen's?").`;

/**
 * User prompt template for hierarchical grouping (Pass 2)
 */
export const GROUPING_USER_PROMPT = `Create hierarchical groupings from the following extracted dish names. Each group should have a parent category with sub-variations.

Requirements:
1. Group similar dishes under a parent category (e.g., all fried chicken variants under "Fried Chicken")
2. Create meaningful sub-variations based on:
   - Regional style (Korean, Japanese, Southern, Nashville)
   - Preparation method (grilled, fried, baked) if it's a key differentiator
   - Key ingredient variation (beef tacos vs fish tacos vs chicken tacos)
3. Only create groups with 2+ recipes - singles go to ungrouped
4. Preserve dish specificity - don't over-generalize
5. Keep sandwiches/wraps separate from base dishes
6. "Generic" variation for dishes without a specific style modifier

Examples of good groupings:
- "Fried Chicken" parent with variations: "Korean Fried Chicken", "Southern Fried Chicken", "Japanese Fried Chicken (Karaage)", "Generic"
- "Tacos" parent with variations: "Beef Tacos", "Fish Tacos", "Carnitas Tacos", "Birria Tacos"
- "Chocolate Chip Cookies" should NOT be grouped with "Sugar Cookies" - they are different dishes

Extracted dishes to group:
{dishes}

Respond with JSON in this exact format:
{
  "groups": [
    {
      "slug": "fried-chicken",
      "canonical_name": "Fried Chicken",
      "description": "Crispy fried chicken dishes with various regional styles",
      "variations": [
        {
          "slug": "korean-fried-chicken",
          "name": "Korean Fried Chicken",
          "dish_names": ["Korean Fried Chicken", "Yangnyeom Chicken", "KFC Korean Style"]
        },
        {
          "slug": "generic",
          "name": "Fried Chicken",
          "dish_names": ["Fried Chicken", "Crispy Fried Chicken"]
        }
      ]
    }
  ],
  "ungrouped_dishes": ["Unique Dish Name 1", "Another Unique Dish"]
}`;

/**
 * Format the extraction prompt with recipe data
 */
export function formatExtractionPrompt(
  recipes: Array<{ video_id: string; title: string }>
): string {
  const recipesJson = JSON.stringify(recipes, null, 2);
  return EXTRACTION_USER_PROMPT.replace('{recipes}', recipesJson);
}

/**
 * Format the grouping prompt with dish data
 */
export function formatGroupingPrompt(
  dishes: Array<{ dish_name: string; video_ids: string[] }>
): string {
  const dishesJson = JSON.stringify(dishes, null, 2);
  return GROUPING_USER_PROMPT.replace('{dishes}', dishesJson);
}
