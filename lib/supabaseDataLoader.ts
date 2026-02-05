import { createServerSupabaseClient } from './clients/supabaseServer';
import type { Channel, Video, VideoWithChannel, Thumbnail, Recipe, CleanedTranscript } from './types';

const RECIPES_GROUP_ID = '52f7d41b-490e-40d1-b5da-eb1d74ec2eae';

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
    youtube_thumbnails: Thumbnail[];
    youtube_description: string;
    recipes?: Recipe[];
    cleaned_transcript?: CleanedTranscript;
  } | null;
}

/**
 * Transform a Supabase content record to a VideoWithChannel
 */
function contentToVideo(record: ContentRecord): VideoWithChannel | null {
  const meta = record.metadata;
  if (!meta || meta.type !== 'youtube_video') {
    return null;
  }

  return {
    id: meta.youtube_video_id,
    title: meta.youtube_title,
    description: meta.youtube_description || '',
    duration: meta.youtube_duration || 0,
    view_count: meta.youtube_views || 0,
    upload_date: meta.youtube_upload_date || '',
    thumbnails: meta.youtube_thumbnails || [],
    channel: meta.youtube_channel,
    channel_id: meta.youtube_channel_id,
    channelSlug: meta.youtube_channel_handle,
    hasRecipe: !!(meta.recipes && meta.recipes.length > 0),
    recipes: meta.recipes || undefined,
    cleaned_transcript: meta.cleaned_transcript || undefined,
    // VideoWithChannel additional fields
    channelName: meta.youtube_channel,
    channelFollowers: 0, // Not stored in metadata, would need separate channel lookup
    recipeTitle: meta.recipes?.[0]?.title,
  };
}

/**
 * Fetch all content records from Supabase with pagination
 */
async function fetchAllRecords(): Promise<ContentRecord[]> {
  const supabase = createServerSupabaseClient();
  const allRecords: ContentRecord[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('content')
      .select('id, data, metadata')
      .eq('group_id', RECIPES_GROUP_ID)
      .eq('type', 'text')
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching content records:', error);
      throw new Error(`Failed to fetch content records: ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    allRecords.push(...(data as ContentRecord[]));

    if (data.length < limit) {
      break;
    }

    offset += limit;
  }

  return allRecords;
}

/**
 * Get all videos from Supabase
 */
export async function getAllVideos(): Promise<VideoWithChannel[]> {
  const records = await fetchAllRecords();
  const videos: VideoWithChannel[] = [];

  for (const record of records) {
    const video = contentToVideo(record);
    if (video) {
      videos.push(video);
    }
  }

  console.log(`Loaded ${videos.length} videos from Supabase`);
  return videos;
}

/**
 * Get a single video by ID from Supabase
 */
export async function getVideoById(videoId: string): Promise<VideoWithChannel | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('content')
    .select('id, data, metadata')
    .eq('group_id', RECIPES_GROUP_ID)
    .eq('type', 'text')
    .filter('metadata->>youtube_video_id', 'eq', videoId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching video by ID:', error);
    return null;
  }

  const video = contentToVideo(data as ContentRecord);
  if (video) {
    console.log('[getVideoById] Video loaded:', {
      id: video.id,
      totalSize: JSON.stringify(video).length,
      transcriptSize: video.cleaned_transcript ? JSON.stringify(video.cleaned_transcript).length : 0,
      recipesSize: video.recipes ? JSON.stringify(video.recipes).length : 0,
    });
  }
  return video;
}

/**
 * Get multiple videos by IDs from Supabase in bulk
 */
export async function getVideosByIds(videoIds: string[]): Promise<Map<string, VideoWithChannel>> {
  if (videoIds.length === 0) {
    return new Map();
  }

  const supabase = createServerSupabaseClient();
  const results = new Map<string, VideoWithChannel>();

  // Use OR filter with multiple conditions, batched to avoid query limits
  const BATCH_SIZE = 50;

  for (let i = 0; i < videoIds.length; i += BATCH_SIZE) {
    const batch = videoIds.slice(i, i + BATCH_SIZE);
    const orFilter = batch.map(id => `metadata->>youtube_video_id.eq.${id}`).join(',');

    const { data, error } = await supabase
      .from('content')
      .select('id, data, metadata')
      .eq('group_id', RECIPES_GROUP_ID)
      .eq('type', 'text')
      .or(orFilter);

    if (error) {
      console.error('Error fetching videos by IDs:', error);
      continue;
    }

    for (const record of (data || []) as ContentRecord[]) {
      const video = contentToVideo(record);
      if (video) {
        results.set(video.id, video);
      }
    }
  }

  console.log(`[getVideosByIds] Loaded ${results.size} videos in bulk`);
  return results;
}

/**
 * Get a channel by slug with all its videos
 */
export async function getChannelBySlug(slug: string): Promise<Channel | null> {
  const supabase = createServerSupabaseClient();

  // Fetch all videos for this channel
  const allRecords: ContentRecord[] = [];
  let offset = 0;
  const limit = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('content')
      .select('id, data, metadata')
      .eq('group_id', RECIPES_GROUP_ID)
      .eq('type', 'text')
      .filter('metadata->>youtube_channel_handle', 'eq', slug)
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching channel videos:', error);
      return null;
    }

    if (!data || data.length === 0) {
      break;
    }

    allRecords.push(...(data as ContentRecord[]));

    if (data.length < limit) {
      break;
    }

    offset += limit;
  }

  if (allRecords.length === 0) {
    return null;
  }

  // Build channel from first record's metadata
  const firstMeta = allRecords[0].metadata;
  if (!firstMeta) {
    return null;
  }

  // Convert records to Video entries
  const entries: Video[] = [];
  for (const record of allRecords) {
    const video = contentToVideo(record);
    if (video) {
      // Convert VideoWithChannel back to Video for entries, strip large data not needed for navigation
      const { channelName, channelFollowers, recipeTitle, cleaned_transcript, ...videoOnly } = video;
      entries.push(videoOnly);
    }
  }

  return {
    channel: firstMeta.youtube_channel,
    channel_id: firstMeta.youtube_channel_id,
    channelSlug: firstMeta.youtube_channel_handle,
    channel_follower_count: 0, // Not stored in content metadata
    description: '',
    thumbnails: [],
    entries,
  };
}

/**
 * Get all channels from Supabase
 */
export async function getAllChannels(): Promise<Channel[]> {
  const records = await fetchAllRecords();

  // Group videos by channel slug
  const channelMap = new Map<string, { meta: ContentRecord['metadata']; videos: Video[] }>();

  for (const record of records) {
    const meta = record.metadata;
    if (!meta || meta.type !== 'youtube_video') continue;

    const slug = meta.youtube_channel_handle;
    if (!channelMap.has(slug)) {
      channelMap.set(slug, { meta, videos: [] });
    }

    const video = contentToVideo(record);
    if (video) {
      // Strip large data not needed for channel listings
      const { channelName, channelFollowers, recipeTitle, cleaned_transcript, ...videoOnly } = video;
      channelMap.get(slug)!.videos.push(videoOnly);
    }
  }

  // Convert to Channel array
  const channels: Channel[] = [];
  for (const [slug, { meta, videos }] of channelMap) {
    if (!meta) continue;

    channels.push({
      channel: meta.youtube_channel,
      channel_id: meta.youtube_channel_id,
      channelSlug: slug,
      channel_follower_count: 0,
      description: '',
      thumbnails: [],
      entries: videos,
    });
  }

  console.log(`Loaded ${channels.length} channels from Supabase`);
  return channels;
}
