import { NextRequest, NextResponse } from 'next/server';
import {
  createShoppingListFromIngredients,
  isInstacartConfigured,
} from '@/lib/clients/instacartClient';
import {
  getCachedInstacartUrl,
  cacheInstacartUrl,
  isKVConfigured,
} from '@/lib/clients/kvClient';
import type { Ingredient } from '@/lib/types';

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
    const title: string = body.title;
    const ingredients: Ingredient[] = body.ingredients;
    const videoId: string | undefined = body.videoId;

    if (!ingredients || ingredients.length === 0) {
      return NextResponse.json({ error: 'Missing ingredients' }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: 'Missing title' }, { status: 400 });
    }

    // Try to get cached URL first (if KV is configured)
    if (isKVConfigured()) {
      const cachedUrl = await getCachedInstacartUrl(ingredients);
      if (cachedUrl) {
        return NextResponse.json({
          products_link_url: cachedUrl,
          cached: true,
        });
      }
    }

    // Build partner linkback URL if videoId is provided
    const partnerLinkbackUrl = videoId
      ? `${process.env.NEXT_PUBLIC_BASE_URL || 'https://recipes.example.com'}/recipe/${videoId}`
      : undefined;

    // Create Instacart shopping list
    const result = await createShoppingListFromIngredients(title, ingredients, {
      partnerLinkbackUrl,
      enablePantryItems: true,
      expiresInDays: 30,
    });

    // Cache the URL for future requests (if KV is configured)
    if (isKVConfigured() && result.products_link_url) {
      await cacheInstacartUrl(ingredients, result.products_link_url, {
        title,
        videoId,
      });
    }

    return NextResponse.json({
      products_link_url: result.products_link_url,
      cached: false,
    });
  } catch (error) {
    console.error('Error creating Instacart shopping list:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create Instacart shopping list',
      },
      { status: 500 }
    );
  }
}
