import { createHash } from 'crypto';
import type { Ingredient } from '../types';
import { createServerSupabaseClient } from './supabaseServer';

// The recipes group ID in Supabase
const RECIPES_GROUP_ID = '52f7d41b-490e-40d1-b5da-eb1d74ec2eae';

// Content type for Instacart shopping list links
const INSTACART_CONTENT_TYPE = 'instacart-shopping-list';

// System user ID for anonymous/system operations
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

// TTL for cached URLs (in milliseconds)
// Instacart links can expire, so we use a conservative TTL
// 7 days = 604800000 ms (shorter than Instacart's default 30-day expiry)
export const INSTACART_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;

/**
 * Generate a deterministic hash from ingredients array
 * Uses SHA-256 and only includes the fields that affect the shopping list
 */
export function hashIngredients(ingredients: Ingredient[]): string {
  // Normalize ingredients to ensure consistent hashing
  const normalized = ingredients.map((ing) => ({
    item: ing.item.toLowerCase().trim(),
    quantity: ing.quantity.trim(),
    unit: ing.unit.toLowerCase().trim(),
    notes: ing.notes?.toLowerCase().trim() || '',
  }));

  // Sort to ensure order doesn't affect hash
  const sorted = normalized.sort((a, b) => a.item.localeCompare(b.item));

  const hash = createHash('sha256')
    .update(JSON.stringify(sorted))
    .digest('hex');

  // Return first 16 chars for a shorter but still unique key
  return hash.substring(0, 16);
}

/**
 * Build the cache key from ingredients hash
 */
export function buildCacheKey(ingredientsHash: string): string {
  return `instacart:${ingredientsHash}`;
}

/**
 * Check if a cached entry is still valid based on TTL
 */
function isEntryValid(createdAt: string): boolean {
  const createdTime = new Date(createdAt).getTime();
  const now = Date.now();
  return now - createdTime < INSTACART_CACHE_TTL;
}

/**
 * Get cached Instacart URL for ingredients
 */
export async function getCachedInstacartUrl(
  ingredients: Ingredient[]
): Promise<string | null> {
  try {
    const supabase = createServerSupabaseClient();
    const hash = hashIngredients(ingredients);
    const cacheKey = buildCacheKey(hash);

    const { data, error } = await supabase
      .from('content')
      .select('metadata, created_at')
      .eq('group_id', RECIPES_GROUP_ID)
      .eq('type', INSTACART_CONTENT_TYPE)
      .eq('data', cacheKey)
      .single();

    if (error || !data) {
      return null;
    }

    // Check TTL
    if (!isEntryValid(data.created_at)) {
      // Entry expired, delete it
      await supabase
        .from('content')
        .delete()
        .eq('group_id', RECIPES_GROUP_ID)
        .eq('type', INSTACART_CONTENT_TYPE)
        .eq('data', cacheKey);
      return null;
    }

    return data.metadata?.url || null;
  } catch (error) {
    console.error('Error reading from Supabase cache:', error);
    return null;
  }
}

/**
 * Store Instacart URL in cache
 */
export async function cacheInstacartUrl(
  ingredients: Ingredient[],
  url: string,
  options?: { title?: string; videoId?: string }
): Promise<void> {
  try {
    const supabase = createServerSupabaseClient();
    const hash = hashIngredients(ingredients);
    const cacheKey = buildCacheKey(hash);

    // Delete any existing entry with this key first
    await supabase
      .from('content')
      .delete()
      .eq('group_id', RECIPES_GROUP_ID)
      .eq('type', INSTACART_CONTENT_TYPE)
      .eq('data', cacheKey);

    // Insert new entry
    const { error } = await supabase.from('content').insert({
      type: INSTACART_CONTENT_TYPE,
      data: cacheKey,
      group_id: RECIPES_GROUP_ID,
      user_id: SYSTEM_USER_ID,
      metadata: {
        url,
        ingredients_hash: hash,
        title: options?.title,
        video_id: options?.videoId,
      },
    });

    if (error) {
      console.error('Error writing to Supabase cache:', error);
    }
  } catch (error) {
    console.error('Error writing to Supabase cache:', error);
    // Don't throw - caching failure shouldn't break the main flow
  }
}

/**
 * Check if Supabase is configured
 */
export function isKVConfigured(): boolean {
  return !!(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
