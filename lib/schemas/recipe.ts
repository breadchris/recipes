import { z } from 'zod';

/**
 * Zod schema for recipe ingredients
 * NOTE: Using .nullable() instead of .optional() because OpenAI's structured outputs
 * requires all properties to be in the 'required' array. Nullable allows null values
 * while keeping the field required in the schema.
 */
export const ingredientSchema = z.object({
  item: z.string().describe('The ingredient name'),
  quantity: z.string().describe('The amount (e.g., "2", "1/2")'),
  unit: z.string().describe('The unit of measurement (e.g., "cups", "tablespoons", or empty string)'),
  notes: z.string().nullable().describe('Optional preparation notes, or null if none'),
});

/**
 * Zod schema for measurement extraction from instructions
 */
export const measurementsSchema = z.object({
  temperatures: z.array(z.string()).nullable().describe('Cooking temperatures (e.g., "350°F", "medium-high heat"), or null if none'),
  amounts: z.array(z.string()).nullable().describe('Specific quantities used in this step, or null if none'),
  times: z.array(z.string()).nullable().describe('Duration or timing cues (e.g., "5 minutes", "until golden"), or null if none'),
});

/**
 * Zod schema for step keywords/ingredients
 */
export const keywordsSchema = z.object({
  ingredients: z.array(ingredientSchema).nullable().describe('Ingredients used in this specific step, or null if none'),
  techniques: z.array(z.string()).nullable().describe('Cooking techniques (e.g., "sear", "fold", "whisk"), or null if none'),
  equipment: z.array(z.string()).nullable().describe('Equipment used in this step, or null if none'),
});

/**
 * Zod schema for recipe instructions
 */
export const instructionSchema = z.object({
  step: z.number().describe('Step number starting from 1'),
  text: z.string().describe('The instruction text - should be a single, atomic action'),
  timing_confidence: z.enum(['high', 'medium', 'low', 'none']).describe('Confidence in timing accuracy'),
  measurements: measurementsSchema.nullable().describe('Extracted measurements from this step, or null if none'),
  keywords: keywordsSchema.nullable().describe('Keywords extracted from this step, or null if none'),
});

/**
 * Main Zod schema for generated recipes
 * Matches the Recipe interface from lib/types.ts
 */
export const recipeSchema = z.object({
  title: z.string().describe('Recipe title'),
  description: z.string().describe('Brief description of the dish (1-2 sentences)'),
  prep_time_minutes: z.number().nullable().describe('Preparation time in minutes, or null if unknown'),
  cook_time_minutes: z.number().nullable().describe('Cooking time in minutes, or null if unknown'),
  total_time_minutes: z.number().nullable().describe('Total time in minutes, or null if unknown'),
  servings: z.number().nullable().describe('Number of servings, or null if not applicable'),
  yield: z.string().nullable().describe('Yield description (e.g., "4 servings", "12 cookies"), or null'),
  difficulty: z.enum(['easy', 'medium', 'hard']).nullable().describe('Difficulty level, or null if not specified'),
  cuisine_type: z.array(z.string()).nullable().describe('Cuisine types (e.g., ["italian", "mediterranean"]), or null'),
  meal_type: z.array(z.string()).nullable().describe('Meal types (e.g., ["dinner", "main course"]), or null'),
  dietary_tags: z.array(z.string()).nullable().describe('Dietary tags - only add if truly applicable (e.g., "vegetarian" means NO meat), or null'),
  ingredients: z.array(ingredientSchema).describe('List of ingredients with quantities'),
  instructions: z.array(instructionSchema).describe('Step-by-step instructions'),
  equipment: z.array(z.string()).nullable().describe('Required equipment, or null if none specified'),
  tags: z.array(z.string()).nullable().describe('Additional tags (e.g., "quick", "weeknight"), or null'),
  tips: z.array(z.string()).nullable().describe('Helpful tips or variations, or null if none'),
});

export type GeneratedRecipe = z.infer<typeof recipeSchema>;
export type GeneratedIngredient = z.infer<typeof ingredientSchema>;
export type GeneratedInstruction = z.infer<typeof instructionSchema>;
