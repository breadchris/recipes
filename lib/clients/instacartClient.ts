import type { Ingredient, Recipe } from '../types';

const INSTACART_API_URL = 'https://connect.dev.instacart.tools/idp/v1/products/recipe';

// Request types
export interface InstacartMeasurement {
  quantity?: number;
  unit?: string;
}

export interface InstacartFilter {
  brand_filters?: string[];
  health_filters?: ('ORGANIC' | 'GLUTEN_FREE' | 'FAT_FREE' | 'VEGAN' | 'KOSHER' | 'SUGAR_FREE' | 'LOW_FAT')[];
}

export interface InstacartLineItem {
  name: string;
  display_text?: string;
  product_ids?: number[];
  upcs?: string[];
  measurements?: InstacartMeasurement[];
  filters?: InstacartFilter;
}

export interface InstacartLandingPageConfiguration {
  partner_linkback_url?: string;
  enable_pantry_items?: boolean;
}

export interface InstacartRecipeRequest {
  title: string;
  image_url?: string;
  author?: string;
  servings?: number;
  cooking_time?: number;
  external_reference_id?: string;
  content_creator_credit_info?: string;
  expires_in?: number;
  instructions?: string[];
  ingredients: InstacartLineItem[];
  landing_page_configuration?: InstacartLandingPageConfiguration;
}

// Response types
export interface InstacartRecipeResponse {
  products_link_url: string;
}

export interface InstacartError {
  message: string;
  code: number;
  meta?: Record<string, string>;
}

/**
 * Check if Instacart API is configured
 */
export function isInstacartConfigured(): boolean {
  return !!process.env.INSTACART_API;
}

/**
 * Create an Instacart recipe page and return the checkout URL
 */
export async function createRecipePage(
  request: InstacartRecipeRequest
): Promise<InstacartRecipeResponse> {
  const apiKey = process.env.INSTACART_API;

  if (!apiKey) {
    throw new Error('INSTACART_API environment variable is not configured');
  }

  const response = await fetch(INSTACART_API_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `Instacart API error (${response.status}): ${errorData.message || response.statusText}`
    );
  }

  return response.json();
}

/**
 * Map a unit string to Instacart-compatible unit
 * See: https://docs.instacart.com/developer_platform/reference/units_of_measurement
 */
function mapUnit(unit: string): string {
  const unitMap: Record<string, string> = {
    // Direct mappings
    'cup': 'cup',
    'cups': 'cup',
    'tablespoon': 'tablespoon',
    'tablespoons': 'tablespoon',
    'tbsp': 'tablespoon',
    'teaspoon': 'teaspoon',
    'teaspoons': 'teaspoon',
    'tsp': 'teaspoon',
    'ounce': 'ounce',
    'ounces': 'ounce',
    'oz': 'ounce',
    'pound': 'pound',
    'pounds': 'pound',
    'lb': 'pound',
    'lbs': 'pound',
    'gram': 'gram',
    'grams': 'gram',
    'g': 'gram',
    'kilogram': 'kilogram',
    'kilograms': 'kilogram',
    'kg': 'kilogram',
    'milliliter': 'milliliter',
    'milliliters': 'milliliter',
    'ml': 'milliliter',
    'liter': 'liter',
    'liters': 'liter',
    'l': 'liter',
    'pint': 'pint',
    'pints': 'pint',
    'quart': 'quart',
    'quarts': 'quart',
    'gallon': 'gallon',
    'gallons': 'gallon',
    'pinch': 'pinch',
    'dash': 'dash',
    'clove': 'clove',
    'cloves': 'clove',
    'slice': 'slice',
    'slices': 'slice',
    'piece': 'piece',
    'pieces': 'piece',
    'whole': 'each',
    'large': 'each',
    'medium': 'each',
    'small': 'each',
    'can': 'can',
    'cans': 'can',
    'package': 'package',
    'packages': 'package',
    'bunch': 'bunch',
    'bunches': 'bunch',
    'head': 'head',
    'heads': 'head',
    'stalk': 'stalk',
    'stalks': 'stalk',
    'sprig': 'sprig',
    'sprigs': 'sprig',
    '': 'each',
  };

  const normalizedUnit = unit.toLowerCase().trim();
  return unitMap[normalizedUnit] || 'each';
}

/**
 * Convert recipe ingredients to Instacart line items
 */
export function convertIngredientsToLineItems(ingredients: Ingredient[]): InstacartLineItem[] {
  return ingredients.map((ingredient) => {
    const lineItem: InstacartLineItem = {
      name: ingredient.item,
    };

    // Add display text with full ingredient description
    const displayParts: string[] = [];
    if (ingredient.quantity) {
      displayParts.push(ingredient.quantity);
    }
    if (ingredient.unit) {
      displayParts.push(ingredient.unit);
    }
    displayParts.push(ingredient.item);
    if (ingredient.notes) {
      displayParts.push(`(${ingredient.notes})`);
    }
    lineItem.display_text = displayParts.join(' ');

    // Add measurements if quantity is available
    if (ingredient.quantity) {
      const quantity = parseFloat(ingredient.quantity);
      if (!isNaN(quantity) && quantity > 0) {
        lineItem.measurements = [{
          quantity,
          unit: mapUnit(ingredient.unit || ''),
        }];
      }
    }

    return lineItem;
  });
}

/**
 * Create an Instacart recipe page from a Recipe object
 */
export async function createRecipePageFromRecipe(
  recipe: Recipe,
  options?: {
    imageUrl?: string;
    author?: string;
    externalReferenceId?: string;
    partnerLinkbackUrl?: string;
    enablePantryItems?: boolean;
    expiresInDays?: number;
  }
): Promise<InstacartRecipeResponse> {
  const request: InstacartRecipeRequest = {
    title: recipe.title,
    ingredients: convertIngredientsToLineItems(recipe.ingredients),
  };

  // Add optional recipe fields
  if (options?.imageUrl) {
    request.image_url = options.imageUrl;
  }
  if (options?.author) {
    request.author = options.author;
  }
  if (recipe.servings) {
    request.servings = recipe.servings;
  }
  if (recipe.cook_time_minutes) {
    request.cooking_time = recipe.cook_time_minutes;
  }
  if (options?.externalReferenceId) {
    request.external_reference_id = options.externalReferenceId;
  }
  if (options?.expiresInDays) {
    request.expires_in = options.expiresInDays;
  }

  // Add instructions
  if (recipe.instructions && recipe.instructions.length > 0) {
    request.instructions = recipe.instructions.map((i) => i.text);
  }

  // Add landing page configuration
  if (options?.partnerLinkbackUrl || options?.enablePantryItems) {
    request.landing_page_configuration = {};
    if (options.partnerLinkbackUrl) {
      request.landing_page_configuration.partner_linkback_url = options.partnerLinkbackUrl;
    }
    if (options.enablePantryItems !== undefined) {
      request.landing_page_configuration.enable_pantry_items = options.enablePantryItems;
    }
  }

  return createRecipePage(request);
}
