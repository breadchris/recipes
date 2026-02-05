/**
 * Data loader that fetches recipe data from Supabase and Typesense.
 * No local JSON files are used at runtime.
 */

import type { Playlist, PlaylistWithVideos, VideoWithChannel } from './types';
import { typesenseClient, PLAYLIST_COLLECTION_NAME } from './typesense';

// Typesense document type for playlists
interface TypesensePlaylistDocument {
  id: string;
  title: string;
  description: string;
  channelName: string;
  channelSlug: string;
  channel_id: string;
  url: string;
  video_count: number;
  video_ids: string[];
  thumbnails: string;
}

export {
  getAllVideos,
  getVideoById,
  getVideosByIds,
  getChannelBySlug,
  getAllChannels,
} from './supabaseDataLoader';

import { getVideosByIds } from './supabaseDataLoader';

// Playlist cache for performance
let cachedPlaylists: Playlist[] | null = null;

/**
 * Fetch all playlists from Typesense
 */
export async function getAllPlaylists(): Promise<Playlist[]> {
  if (cachedPlaylists) {
    return cachedPlaylists;
  }

  try {
    const searchResult = await typesenseClient
      .collections(PLAYLIST_COLLECTION_NAME)
      .documents()
      .search({
        q: '*',
        query_by: 'title',
        per_page: 250,
        sort_by: 'video_count:desc',
      });

    const playlists: Playlist[] = (searchResult.hits || []).map((hit: any) => {
      const doc = hit.document;
      return {
        id: doc.id,
        title: doc.title,
        description: doc.description || '',
        channel_id: doc.channel_id,
        channelName: doc.channelName,
        channelSlug: doc.channelSlug,
        url: doc.url,
        video_count: doc.video_count,
        video_ids: doc.video_ids || [],
        thumbnails: JSON.parse(doc.thumbnails || '[]'),
      };
    });

    cachedPlaylists = playlists;
    return playlists;
  } catch (error) {
    console.error('Error fetching playlists from Typesense:', error);
    return [];
  }
}

/**
 * Get a playlist by ID from Typesense
 */
export async function getPlaylistById(playlistId: string): Promise<Playlist | null> {
  try {
    const result = await typesenseClient
      .collections(PLAYLIST_COLLECTION_NAME)
      .documents(playlistId)
      .retrieve();

    const doc = result as unknown as TypesensePlaylistDocument;

    return {
      id: doc.id,
      title: doc.title,
      description: doc.description || '',
      channel_id: doc.channel_id,
      channelName: doc.channelName,
      channelSlug: doc.channelSlug,
      url: doc.url,
      video_count: doc.video_count,
      video_ids: doc.video_ids || [],
      thumbnails: JSON.parse(doc.thumbnails || '[]'),
    };
  } catch (error: any) {
    if (error.httpStatus === 404) {
      return null;
    }
    console.error('Error fetching playlist from Typesense:', error);
    return null;
  }
}

/**
 * Get a playlist by ID with all its videos loaded
 */
export async function getPlaylistWithVideos(
  playlistId: string
): Promise<PlaylistWithVideos | null> {
  const playlist = await getPlaylistById(playlistId);
  if (!playlist) {
    return null;
  }

  // Bulk load all videos
  const videoMap = await getVideosByIds(playlist.video_ids);

  // Preserve order from playlist
  const videos: VideoWithChannel[] = [];
  for (const videoId of playlist.video_ids) {
    const video = videoMap.get(videoId);
    if (video) {
      videos.push(video);
    }
  }

  return {
    ...playlist,
    videos,
  };
}
