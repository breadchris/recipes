import { NextRequest, NextResponse } from 'next/server';
import {
  createRecipePageFromRecipe,
  isInstacartConfigured,
} from '@/lib/clients/instacartClient';
import type { Recipe } from '@/lib/types';

export async function POST(request: NextRequest) {
  // Check if Instacart API is configured
  if (!isInstacartConfigured()) {
    return NextResponse.json(
      { error: 'Instacart API not configured' },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const recipe: Recipe = body.recipe;
    const videoId: string | undefined = body.videoId;

    if (!recipe || !recipe.ingredients || recipe.ingredients.length === 0) {
      return NextResponse.json(
        { error: 'Invalid recipe or missing ingredients' },
        { status: 400 }
      );
    }

    // Build partner linkback URL if videoId is provided
    const partnerLinkbackUrl = videoId
      ? `${process.env.NEXT_PUBLIC_BASE_URL || 'https://recipes.example.com'}/recipe/${videoId}`
      : undefined;

    // Create Instacart recipe page
    const result = await createRecipePageFromRecipe(recipe, {
      partnerLinkbackUrl,
      enablePantryItems: true,
    });

    return NextResponse.json({
      products_link_url: result.products_link_url,
    });
  } catch (error) {
    console.error('Error creating Instacart recipe page:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create Instacart recipe page' },
      { status: 500 }
    );
  }
}
