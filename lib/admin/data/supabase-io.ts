/**
 * Supabase-based data layer for admin panel.
 * Replaces file-io.ts for reading/writing recipe data.
 */
import { createServerSupabaseClient } from '@/lib/clients/supabaseServer';
import type { VideoRecipes, RecipeVersionInfo, VersionedRecipe, RecipeVersionSummary } from '@/lib/types/admin';
import type { CleanedTranscript } from '@/lib/types';
import { DEFAULT_RECIPE_PROMPT } from '../openai/default-prompt';

const RECIPES_GROUP_ID = '52f7d41b-490e-40d1-b5da-eb1d74ec2eae';

/**
 * Content record from Supabase
 */
interface ContentRecord {
  id: string;
  data: string;
  metadata: {
    type: string;
    youtube_video_id: string;
    youtube_title: string;
    youtube_url: string;
    youtube_channel: string;
    youtube_channel_id: string;
    youtube_channel_handle: string;
    youtube_duration: number;
    youtube_views: number;
    youtube_upload_date: string;
    youtube_thumbnail: string;
    youtube_thumbnails: { url: string; width?: number; height?: number }[];
    youtube_description: string;
    recipes?: VideoRecipes['recipes'];
    cleaned_transcript?: CleanedTranscript;
    transcript?: {
      plainText?: string;
      segments?: { startTime: number; endTime: number; text: string }[];
    };
    // Version management fields
    recipe_versions?: VersionedRecipe[];
    current_recipe_version?: number;
  } | null;
}

/**
 * Video metadata structure (matches file-io.ts interface)
 */
export interface VideoMetadata {
  id: string;
  fulltitle: string;
  title?: string;
  description: string;
  webpage_url: string;
  upload_date: string;
  duration: number;
  channel?: string;
  channel_id?: string;
  thumbnails?: { url: string; width?: number; height?: number }[];
}

/**
 * Get the Supabase content ID for a video
 */
async function getContentId(videoId: string): Promise<string | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('content')
    .select('id')
    .eq('group_id', RECIPES_GROUP_ID)
    .filter('metadata->>youtube_video_id', 'eq', videoId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}

/**
 * Get content record for a video
 */
async function getContentRecord(videoId: string): Promise<ContentRecord | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('content')
    .select('id, data, metadata')
    .eq('group_id', RECIPES_GROUP_ID)
    .filter('metadata->>youtube_video_id', 'eq', videoId)
    .single();

  if (error || !data) {
    if (error?.code !== 'PGRST116') {
      console.error('Error fetching content record:', error);
    }
    return null;
  }

  return data as ContentRecord;
}

/**
 * Get list of all video IDs
 */
export async function getAllVideoIds(): Promise<string[]> {
  const supabase = createServerSupabaseClient();
  const videoIds: string[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('content')
      .select('metadata')
      .eq('group_id', RECIPES_GROUP_ID)
      .eq('type', 'text')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching video IDs:', error);
      break;
    }

    if (!data || data.length === 0) break;

    for (const record of data) {
      const meta = record.metadata as ContentRecord['metadata'];
      if (meta?.youtube_video_id) {
        videoIds.push(meta.youtube_video_id);
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }

  return videoIds.sort();
}

/**
 * Bulk video info for listing (optimized single query)
 */
export interface VideoListItem {
  video_id: string;
  title: string;
  channel_name?: string;
  channel_id?: string;
  has_recipe: boolean;
  has_transcript: boolean;
  is_legacy: boolean;
  has_keywords: boolean;
}

/**
 * Get all videos with metadata for listing (single query, no N+1)
 * Uses parallel paginated queries for fast fetching of large datasets.
 */
export async function getAllVideosForListing(): Promise<VideoListItem[]> {
  const supabase = createServerSupabaseClient();

  console.log('Starting getAllVideosForListing...');
  const startTime = Date.now();

  // First, get total count to plan parallel fetches
  const { count, error: countError } = await supabase
    .from('content')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', RECIPES_GROUP_ID)
    .eq('type', 'text');

  if (countError) {
    console.error('Error getting count:', countError);
    return [];
  }

  const totalCount = count || 0;
  console.log(`Total videos to fetch: ${totalCount}`);

  if (totalCount === 0) return [];

  // Fetch in parallel batches
  const batchSize = 500;
  const parallelBatches = 5; // Fetch 5 batches at a time
  const videos: VideoListItem[] = [];

  for (let batchStart = 0; batchStart < totalCount; batchStart += batchSize * parallelBatches) {
    // Create parallel fetch promises
    const promises: Promise<VideoListItem[]>[] = [];

    for (let i = 0; i < parallelBatches; i++) {
      const offset = batchStart + (i * batchSize);
      if (offset >= totalCount) break;

      promises.push(fetchBatch(supabase, offset, batchSize));
    }

    // Execute batches in parallel
    const results = await Promise.all(promises);
    for (const batch of results) {
      videos.push(...batch);
    }

    console.log(`Fetched ${Math.min(batchStart + batchSize * parallelBatches, totalCount)} / ${totalCount} videos`);
  }

  console.log(`getAllVideosForListing completed: ${videos.length} videos in ${Date.now() - startTime}ms`);
  return videos.sort((a, b) => a.video_id.localeCompare(b.video_id));
}

/**
 * Fetch a single batch of videos
 */
async function fetchBatch(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  offset: number,
  limit: number
): Promise<VideoListItem[]> {
  const { data, error } = await supabase
    .from('content')
    .select('metadata')
    .eq('group_id', RECIPES_GROUP_ID)
    .eq('type', 'text')
    .range(offset, offset + limit - 1);

  if (error) {
    console.error(`Error fetching batch at offset ${offset}:`, error);
    return [];
  }

  if (!data) return [];

  const videos: VideoListItem[] = [];

  for (const record of data) {
    const meta = record.metadata as ContentRecord['metadata'];
    if (!meta?.youtube_video_id) continue;

    const hasVersionedRecipes = !!(meta.recipe_versions && meta.recipe_versions.length > 0);
    const hasLegacyRecipes = !!(meta.recipes && meta.recipes.length > 0);

    const hasTranscript = !!(
      meta.cleaned_transcript ||
      meta.transcript?.plainText ||
      meta.transcript?.segments
    );

    let hasKeywords = false;
    if (hasVersionedRecipes && meta.recipe_versions) {
      const currentVersion = meta.current_recipe_version || 1;
      const currentVersioned = meta.recipe_versions.find(
        v => v.version_info.version === currentVersion
      );
      hasKeywords = !!(
        currentVersioned?.recipe?.recipes?.[0]?.instructions?.[0]?.keywords
      );
    }

    videos.push({
      video_id: meta.youtube_video_id,
      title: meta.youtube_title || meta.youtube_video_id,
      channel_name: meta.youtube_channel,
      channel_id: meta.youtube_channel_id,
      has_recipe: hasVersionedRecipes || hasLegacyRecipes,
      has_transcript: hasTranscript,
      is_legacy: hasLegacyRecipes && !hasVersionedRecipes,
      has_keywords: hasKeywords,
    });
  }

  return videos;
}

/**
 * Paginated video listing result
 */
export interface PaginatedVideosResult {
  items: VideoListItem[];
  total: number;
}

/**
 * Get videos for listing with pagination and server-side filtering.
 * This is the efficient approach - only fetches one page at a time.
 */
export async function getVideosForListingPaginated(options: {
  page: number;
  limit: number;
  search?: string;
  channelId?: string;
  hasRecipe?: boolean;
}): Promise<PaginatedVideosResult> {
  const supabase = createServerSupabaseClient();
  const offset = (options.page - 1) * options.limit;

  // Build the query with filters
  let query = supabase
    .from('content')
    .select('metadata', { count: 'exact' })
    .eq('group_id', RECIPES_GROUP_ID)
    .eq('type', 'text');

  // Channel filter
  if (options.channelId) {
    query = query.filter('metadata->>youtube_channel_id', 'eq', options.channelId);
  }

  // Text search across title, video_id, and channel name
  if (options.search) {
    const searchPattern = `%${options.search}%`;
    query = query.or(
      `metadata->>youtube_title.ilike.${searchPattern},` +
      `metadata->>youtube_video_id.ilike.${searchPattern},` +
      `metadata->>youtube_channel.ilike.${searchPattern}`
    );
  }

  // Pagination
  query = query
    .order('metadata->>youtube_video_id', { ascending: true })
    .range(offset, offset + options.limit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('Error in getVideosForListingPaginated:', error);
    return { items: [], total: 0 };
  }

  if (!data) return { items: [], total: 0 };

  // Process results into VideoListItem format
  const items: VideoListItem[] = [];

  for (const record of data) {
    const meta = record.metadata as ContentRecord['metadata'];
    if (!meta?.youtube_video_id) continue;

    const hasVersionedRecipes = !!(meta.recipe_versions && meta.recipe_versions.length > 0);
    const hasLegacyRecipes = !!(meta.recipes && meta.recipes.length > 0);
    const hasRecipe = hasVersionedRecipes || hasLegacyRecipes;

    // Apply hasRecipe filter if specified (post-query since we can't easily filter JSONB arrays)
    if (options.hasRecipe !== undefined) {
      if (options.hasRecipe && !hasRecipe) continue;
      if (!options.hasRecipe && hasRecipe) continue;
    }

    const hasTranscript = !!(
      meta.cleaned_transcript ||
      meta.transcript?.plainText ||
      meta.transcript?.segments
    );

    let hasKeywords = false;
    if (hasVersionedRecipes && meta.recipe_versions) {
      const currentVersion = meta.current_recipe_version || 1;
      const currentVersioned = meta.recipe_versions.find(
        v => v.version_info.version === currentVersion
      );
      hasKeywords = !!(
        currentVersioned?.recipe?.recipes?.[0]?.instructions?.[0]?.keywords
      );
    }

    items.push({
      video_id: meta.youtube_video_id,
      title: meta.youtube_title || meta.youtube_video_id,
      channel_name: meta.youtube_channel,
      channel_id: meta.youtube_channel_id,
      has_recipe: hasRecipe,
      has_transcript: hasTranscript,
      is_legacy: hasLegacyRecipes && !hasVersionedRecipes,
      has_keywords: hasKeywords,
    });
  }

  return {
    items,
    total: count || 0,
  };
}

/**
 * Load video metadata
 */
export async function loadVideoMetadata(videoId: string): Promise<VideoMetadata | null> {
  const record = await getContentRecord(videoId);
  if (!record?.metadata) return null;

  const meta = record.metadata;
  return {
    id: meta.youtube_video_id,
    fulltitle: meta.youtube_title,
    title: meta.youtube_title,
    description: meta.youtube_description || '',
    webpage_url: meta.youtube_url,
    upload_date: meta.youtube_upload_date || '',
    duration: meta.youtube_duration || 0,
    channel: meta.youtube_channel,
    channel_id: meta.youtube_channel_id,
    thumbnails: meta.youtube_thumbnails,
  };
}

/**
 * Check if recipe exists for a video
 */
export async function recipeExists(videoId: string): Promise<boolean> {
  const record = await getContentRecord(videoId);
  if (!record?.metadata) return false;

  // Check for versioned recipes first
  if (record.metadata.recipe_versions && record.metadata.recipe_versions.length > 0) {
    return true;
  }

  // Check for legacy recipes array
  return !!(record.metadata.recipes && record.metadata.recipes.length > 0);
}

/**
 * Check if video has transcript
 */
export async function hasTranscript(videoId: string): Promise<boolean> {
  const record = await getContentRecord(videoId);
  if (!record?.metadata) return false;

  return !!(
    record.metadata.cleaned_transcript ||
    record.metadata.transcript?.plainText ||
    record.metadata.transcript?.segments
  );
}

/**
 * Format seconds to timestamp for AI
 */
function formatTimestampForAI(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `[${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
  }
  return `[${mins}:${secs.toString().padStart(2, '0')}]`;
}

/**
 * Load existing cleaned transcript
 */
export async function loadCleanedTranscript(videoId: string): Promise<CleanedTranscript | null> {
  const record = await getContentRecord(videoId);
  if (!record?.metadata?.cleaned_transcript) return null;
  return record.metadata.cleaned_transcript;
}

/**
 * Load raw transcript/VTT content
 */
export async function loadRawVtt(videoId: string): Promise<string | null> {
  const record = await getContentRecord(videoId);
  if (!record?.metadata) return null;

  const meta = record.metadata;

  // If we have segments, construct timestamped text
  if (meta.transcript?.segments && Array.isArray(meta.transcript.segments)) {
    const parts: string[] = [];
    for (const segment of meta.transcript.segments) {
      const timestamp = formatTimestampForAI(segment.startTime);
      parts.push(`${timestamp} ${segment.text}`);
    }
    return `TIMESTAMPED_TEXT:${parts.join(' ')}`;
  }

  // Return plain text if available
  if (meta.transcript?.plainText) {
    return meta.transcript.plainText;
  }

  return null;
}

/**
 * Load transcript segments
 */
export async function loadTranscriptSegments(
  videoId: string
): Promise<{ startTime: number; endTime: number; text: string }[] | null> {
  const record = await getContentRecord(videoId);
  if (!record?.metadata?.transcript?.segments) return null;

  return record.metadata.transcript.segments;
}

/**
 * Get list of all channel slugs
 */
export async function getChannelSlugs(): Promise<string[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('content')
    .select('metadata')
    .eq('group_id', RECIPES_GROUP_ID)
    .eq('type', 'text');

  if (error || !data) {
    console.error('Error fetching channel slugs:', error);
    return [];
  }

  const slugSet = new Set<string>();
  for (const record of data) {
    const meta = record.metadata as ContentRecord['metadata'];
    if (meta?.youtube_channel_handle) {
      slugSet.add(meta.youtube_channel_handle);
    }
  }

  return Array.from(slugSet).sort();
}

// ============================================
// Recipe Version Management
// ============================================

/**
 * Check if recipe is in legacy format (no versions yet)
 */
export async function isLegacyFormat(videoId: string): Promise<boolean> {
  const record = await getContentRecord(videoId);
  if (!record?.metadata) return false;

  // Legacy if has recipes but no recipe_versions
  const hasRecipes = !!(record.metadata.recipes && record.metadata.recipes.length > 0);
  const hasVersions = !!(record.metadata.recipe_versions && record.metadata.recipe_versions.length > 0);

  return hasRecipes && !hasVersions;
}

/**
 * Migrate legacy recipe to versioned format
 */
export async function migrateFromLegacy(videoId: string): Promise<void> {
  const record = await getContentRecord(videoId);
  if (!record?.metadata?.recipes) return;

  const supabase = createServerSupabaseClient();

  // Create version 1 from existing recipes
  const versionInfo: RecipeVersionInfo = {
    version: 1,
    created_at: new Date().toISOString(),
    prompt_used: DEFAULT_RECIPE_PROMPT,
    model: 'gpt-4.1-nano',
    temperature: 0.3,
    generation_type: 'original',
  };

  const videoRecipes: VideoRecipes = {
    has_recipe: true,
    video_id: videoId,
    video_url: record.metadata.youtube_url || '',
    upload_date: record.metadata.youtube_upload_date || '',
    recipes: record.metadata.recipes,
    cleaned_transcript: record.metadata.cleaned_transcript,
  };

  const versionedRecipe: VersionedRecipe = {
    version_info: versionInfo,
    recipe: videoRecipes,
  };

  // Update metadata with versioned format
  const { error } = await supabase
    .from('content')
    .update({
      metadata: {
        ...record.metadata,
        recipe_versions: [versionedRecipe],
        current_recipe_version: 1,
      },
    })
    .eq('id', record.id);

  if (error) {
    console.error('Error migrating to versioned format:', error);
    throw error;
  }
}

/**
 * List all versions for a video
 */
export async function listVersions(videoId: string): Promise<RecipeVersionSummary[]> {
  const record = await getContentRecord(videoId);
  if (!record?.metadata?.recipe_versions) return [];

  return record.metadata.recipe_versions.map(v => ({
    version: v.version_info.version,
    created_at: v.version_info.created_at,
    generation_type: v.version_info.generation_type,
  })).sort((a, b) => b.version - a.version);
}

/**
 * Get current version number
 */
export async function getCurrentVersion(videoId: string): Promise<number> {
  const record = await getContentRecord(videoId);
  return record?.metadata?.current_recipe_version || 1;
}

/**
 * Set current version
 */
export async function setCurrentVersion(videoId: string, version: number): Promise<void> {
  const record = await getContentRecord(videoId);
  if (!record) throw new Error('Video not found');

  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from('content')
    .update({
      metadata: {
        ...record.metadata,
        current_recipe_version: version,
      },
    })
    .eq('id', record.id);

  if (error) {
    console.error('Error setting current version:', error);
    throw error;
  }
}

/**
 * Load a specific version
 */
export async function loadVersion(videoId: string, version: number): Promise<VersionedRecipe | null> {
  const record = await getContentRecord(videoId);
  if (!record?.metadata?.recipe_versions) return null;

  return record.metadata.recipe_versions.find(v => v.version_info.version === version) || null;
}

/**
 * Load current version
 */
export async function loadCurrentVersion(videoId: string): Promise<VersionedRecipe | null> {
  const currentVersion = await getCurrentVersion(videoId);
  return loadVersion(videoId, currentVersion);
}

/**
 * Get next version number
 */
export async function getNextVersion(videoId: string): Promise<number> {
  const versions = await listVersions(videoId);
  if (versions.length === 0) return 1;
  return Math.max(...versions.map(v => v.version)) + 1;
}

/**
 * Save a new version
 */
export async function saveNewVersion(
  videoId: string,
  recipe: VideoRecipes,
  versionInfo: Omit<RecipeVersionInfo, 'version'>
): Promise<number> {
  const record = await getContentRecord(videoId);
  if (!record) throw new Error('Video not found');

  const supabase = createServerSupabaseClient();

  const version = await getNextVersion(videoId);

  const fullVersionInfo: RecipeVersionInfo = {
    ...versionInfo,
    version,
  };

  const versionedRecipe: VersionedRecipe = {
    version_info: fullVersionInfo,
    recipe,
  };

  const existingVersions = record.metadata?.recipe_versions || [];

  // Update metadata with new version
  const { error } = await supabase
    .from('content')
    .update({
      metadata: {
        ...record.metadata,
        recipe_versions: [...existingVersions, versionedRecipe],
        current_recipe_version: version,
        // Also update the public-facing recipes array
        recipes: recipe.recipes,
        cleaned_transcript: recipe.cleaned_transcript,
      },
    })
    .eq('id', record.id);

  if (error) {
    console.error('Error saving new version:', error);
    throw error;
  }

  return version;
}

/**
 * Get available version numbers
 */
export async function getAvailableVersionNumbers(videoId: string): Promise<number[]> {
  const versions = await listVersions(videoId);
  return versions.map(v => v.version).sort((a, b) => b - a);
}

/**
 * Update current version in place (for edits)
 */
export async function updateCurrentVersion(
  videoId: string,
  updateFn: (recipe: VideoRecipes) => VideoRecipes
): Promise<VersionedRecipe | null> {
  const record = await getContentRecord(videoId);
  if (!record?.metadata?.recipe_versions) return null;

  const currentVersion = record.metadata.current_recipe_version || 1;
  const versionIndex = record.metadata.recipe_versions.findIndex(
    v => v.version_info.version === currentVersion
  );

  if (versionIndex === -1) return null;

  const currentVersioned = record.metadata.recipe_versions[versionIndex];
  const updatedRecipe = updateFn(currentVersioned.recipe);

  const updated: VersionedRecipe = {
    version_info: currentVersioned.version_info,
    recipe: updatedRecipe,
  };

  // Update the versions array
  const newVersions = [...record.metadata.recipe_versions];
  newVersions[versionIndex] = updated;

  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from('content')
    .update({
      metadata: {
        ...record.metadata,
        recipe_versions: newVersions,
        // Also update the public-facing recipes array
        recipes: updatedRecipe.recipes,
        cleaned_transcript: updatedRecipe.cleaned_transcript,
      },
    })
    .eq('id', record.id);

  if (error) {
    console.error('Error updating current version:', error);
    throw error;
  }

  return updated;
}

/**
 * Save cleaned transcript to video
 */
export async function saveCleanedTranscript(
  videoId: string,
  cleanedTranscript: CleanedTranscript
): Promise<void> {
  const record = await getContentRecord(videoId);
  if (!record) throw new Error('Video not found');

  const supabase = createServerSupabaseClient();

  // If we have versioned recipes, update the current version's transcript too
  let updatedVersions = record.metadata?.recipe_versions;
  if (updatedVersions && updatedVersions.length > 0) {
    const currentVersion = record.metadata?.current_recipe_version || 1;
    updatedVersions = updatedVersions.map(v => {
      if (v.version_info.version === currentVersion) {
        return {
          ...v,
          recipe: {
            ...v.recipe,
            cleaned_transcript: cleanedTranscript,
          },
        };
      }
      return v;
    });
  }

  const { error } = await supabase
    .from('content')
    .update({
      metadata: {
        ...record.metadata,
        cleaned_transcript: cleanedTranscript,
        ...(updatedVersions ? { recipe_versions: updatedVersions } : {}),
      },
    })
    .eq('id', record.id);

  if (error) {
    console.error('Error saving cleaned transcript:', error);
    throw error;
  }
}

/**
 * Save transcript segments to video
 */
export async function saveTranscriptSegments(
  videoId: string,
  segments: { startTime: number; endTime: number; text: string }[],
  plainText?: string
): Promise<void> {
  const record = await getContentRecord(videoId);
  if (!record) throw new Error('Video not found');

  const supabase = createServerSupabaseClient();

  const { error } = await supabase
    .from('content')
    .update({
      metadata: {
        ...record.metadata,
        transcript: {
          segments,
          plainText: plainText || segments.map(s => s.text).join(' '),
        },
      },
    })
    .eq('id', record.id);

  if (error) {
    console.error('Error saving transcript segments:', error);
    throw error;
  }
}

/**
 * Normalize recipe format
 */
export function normalizeRecipe(recipe: VideoRecipes): VideoRecipes {
  if (recipe.recipes && Array.isArray(recipe.recipes) && recipe.recipes.length > 0) {
    return recipe;
  }

  const {
    has_recipe,
    video_id,
    video_url,
    upload_date,
    recipes: _recipes,
    cleaned_transcript,
    ...content
  } = recipe as VideoRecipes & Record<string, unknown>;

  return {
    has_recipe: has_recipe ?? true,
    video_id: video_id ?? '',
    video_url: video_url ?? '',
    upload_date: upload_date ?? '',
    recipes: [content as unknown as VideoRecipes['recipes'][0]],
    cleaned_transcript,
  };
}
