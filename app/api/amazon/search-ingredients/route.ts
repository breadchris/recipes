import { NextRequest, NextResponse } from 'next/server';
import {
  searchIngredients,
  generateAddToCartUrl,
  isAmazonConfigured,
} from '@/lib/clients/amazonClient';
import type { Ingredient } from '@/lib/types';

export async function POST(request: NextRequest) {
  // Check if Amazon PAAPI is configured
  if (!isAmazonConfigured()) {
    return NextResponse.json(
      { error: 'Amazon API not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const ingredients: Ingredient[] = body.ingredients;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return NextResponse.json(
        { error: 'Invalid ingredients array' },
        { status: 400 }
      );
    }

    // Search for each ingredient on Amazon
    const results = await searchIngredients(ingredients);

    // Separate matched and unmatched ingredients
    const matched = results.filter(r => r.product !== null);
    const unmatched = results.filter(r => r.product === null);

    // Generate Add-to-Cart URL if we have matches
    const asins = matched.map(r => r.product!.asin);
    const cartUrl = asins.length > 0 ? generateAddToCartUrl(asins) : null;

    return NextResponse.json({
      cartUrl,
      matchedCount: matched.length,
      unmatchedCount: unmatched.length,
      matched: matched.map(r => ({
        ingredient: r.ingredient.item,
        product: {
          asin: r.product!.asin,
          title: r.product!.title,
          price: r.product!.price,
        },
      })),
      unmatched: unmatched.map(r => r.ingredient.item),
    });
  } catch (error) {
    console.error('Error searching ingredients:', error);
    return NextResponse.json(
      { error: 'Failed to search ingredients' },
      { status: 500 }
    );
  }
}
