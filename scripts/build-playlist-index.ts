import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import type { Playlist, Thumbnail } from '../lib/types';

interface PlaylistMetadata {
  id: string;
  title: string;
  channel_id: string;
  url: string;
  video_count: number;
  description: string;
}

interface YoutubeMetadata {
  channels: Record<string, { id: string; name: string; url: string }>;
  playlists: Record<string, PlaylistMetadata>;
}

interface CachedPlaylist {
  id: string;
  title: string;
  description: string;
  channel: string;
  channel_id: string;
  thumbnails: Thumbnail[];
  entries: Array<{ id: string; title?: string }>;
}

interface Channel {
  channel: string;
  channel_id: string;
  channelSlug: string;
}

interface RecipesData {
  channels: Channel[];
}

interface PlaylistIndex {
  playlists: Playlist[];
  meta: {
    buildTime: string;
    totalPlaylists: number;
  };
}

function loadYoutubeMetadata(): YoutubeMetadata {
  const metadataPath = path.join(__dirname, '../youtube/youtube_metadata.json');
  return JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
}

function loadRecipesData(): RecipesData {
  const dataPath = path.join(__dirname, '../data/recipes-data.json.gz');
  const compressedData = fs.readFileSync(dataPath);
  const decompressedData = zlib.gunzipSync(compressedData);
  return JSON.parse(decompressedData.toString());
}

function loadCachedPlaylist(playlistId: string): CachedPlaylist | null {
  const cachePath = path.join(
    __dirname,
    '../data/youtube-cache',
    `playlist_${playlistId}.json.gz`
  );

  if (!fs.existsSync(cachePath)) {
    return null;
  }

  try {
    const compressedData = fs.readFileSync(cachePath);
    const decompressedData = zlib.gunzipSync(compressedData);
    return JSON.parse(decompressedData.toString());
  } catch (error) {
    console.error(`  Warning: Failed to load cached playlist ${playlistId}:`, error);
    return null;
  }
}

function getBestThumbnails(thumbnails: Thumbnail[] | undefined): Thumbnail[] {
  if (!thumbnails || thumbnails.length === 0) return [];

  // Filter for YouTube thumbnails
  const ytThumbnails = thumbnails.filter(
    (t) => t.url && t.url.includes('ytimg.com')
  );
  if (ytThumbnails.length === 0) return thumbnails.slice(0, 3);

  // Sort by resolution (highest first)
  const sorted = ytThumbnails.sort((a, b) => {
    const aRes = (a.width || 0) * (a.height || 0);
    const bRes = (b.width || 0) * (b.height || 0);
    return bRes - aRes;
  });

  // Keep up to 3 different sizes
  const sizes: Thumbnail[] = [];
  const addedResolutions = new Set<number>();

  for (const thumb of sorted) {
    const res = (thumb.width || 0) * (thumb.height || 0);
    if (!addedResolutions.has(res) && sizes.length < 3) {
      sizes.push(thumb);
      addedResolutions.add(res);
    }
  }

  return sizes;
}

async function buildPlaylistIndex() {
  console.log('Building playlist index...\n');

  // Load data sources
  console.log('Loading YouTube metadata...');
  const youtubeMetadata = loadYoutubeMetadata();
  const playlistMetadata = youtubeMetadata.playlists || {};
  console.log(`  Found ${Object.keys(playlistMetadata).length} playlists in metadata`);

  console.log('Loading recipes data for channel mapping...');
  const recipesData = loadRecipesData();

  // Build channel_id -> channel info mapping
  const channelMap = new Map<string, { channelName: string; channelSlug: string }>();
  for (const channel of recipesData.channels) {
    channelMap.set(channel.channel_id, {
      channelName: channel.channel,
      channelSlug: channel.channelSlug,
    });
  }
  console.log(`  Mapped ${channelMap.size} channels`);

  // Also build channel name -> info mapping for fallback
  const channelNameMap = new Map<string, { channelName: string; channelSlug: string }>();
  for (const channel of recipesData.channels) {
    channelNameMap.set(channel.channel.toLowerCase(), {
      channelName: channel.channel,
      channelSlug: channel.channelSlug,
    });
  }

  // Scan for playlist cache files
  const cacheDir = path.join(__dirname, '../data/youtube-cache');
  const cacheFiles = fs.readdirSync(cacheDir).filter((f) => f.startsWith('playlist_'));
  console.log(`  Found ${cacheFiles.length} playlist cache files`);

  // Process playlists
  console.log('\nProcessing playlists...');
  const playlists: Playlist[] = [];
  let skippedNoChannel = 0;
  let skippedNoVideos = 0;

  for (const [playlistId, metadata] of Object.entries(playlistMetadata)) {
    // Load cached playlist for thumbnails and video IDs
    const cached = loadCachedPlaylist(playlistId);

    // Get channel info
    let channelInfo = channelMap.get(metadata.channel_id);

    // Fallback: try to find by channel name from cached data
    if (!channelInfo && cached?.channel) {
      channelInfo = channelNameMap.get(cached.channel.toLowerCase());
    }

    if (!channelInfo) {
      skippedNoChannel++;
      continue;
    }

    // Get video IDs from cached entries
    const videoIds = cached?.entries?.map((e) => e.id).filter(Boolean) || [];
    if (videoIds.length === 0) {
      skippedNoVideos++;
      continue;
    }

    // Build playlist object
    const playlist: Playlist = {
      id: playlistId,
      title: cached?.title || metadata.title,
      description: cached?.description || metadata.description || '',
      channel_id: metadata.channel_id,
      channelName: channelInfo.channelName,
      channelSlug: channelInfo.channelSlug,
      url: metadata.url,
      video_count: videoIds.length,
      video_ids: videoIds,
      thumbnails: getBestThumbnails(cached?.thumbnails),
    };

    playlists.push(playlist);
  }

  // Also check for cached playlists not in metadata
  for (const cacheFile of cacheFiles) {
    const playlistId = cacheFile.replace('playlist_', '').replace('.json.gz', '');

    // Skip if already processed from metadata
    if (playlistMetadata[playlistId]) {
      continue;
    }

    const cached = loadCachedPlaylist(playlistId);
    if (!cached) continue;

    // Get channel info
    let channelInfo = channelMap.get(cached.channel_id);
    if (!channelInfo && cached.channel) {
      channelInfo = channelNameMap.get(cached.channel.toLowerCase());
    }

    if (!channelInfo) {
      skippedNoChannel++;
      continue;
    }

    const videoIds = cached.entries?.map((e) => e.id).filter(Boolean) || [];
    if (videoIds.length === 0) {
      skippedNoVideos++;
      continue;
    }

    const playlist: Playlist = {
      id: playlistId,
      title: cached.title || 'Untitled Playlist',
      description: cached.description || '',
      channel_id: cached.channel_id,
      channelName: channelInfo.channelName,
      channelSlug: channelInfo.channelSlug,
      url: `https://www.youtube.com/playlist?list=${playlistId}`,
      video_count: videoIds.length,
      video_ids: videoIds,
      thumbnails: getBestThumbnails(cached.thumbnails),
    };

    playlists.push(playlist);
  }

  // Sort playlists by video count (most videos first)
  playlists.sort((a, b) => b.video_count - a.video_count);

  const index: PlaylistIndex = {
    playlists,
    meta: {
      buildTime: new Date().toISOString(),
      totalPlaylists: playlists.length,
    },
  };

  // Write output
  const outputPath = path.join(__dirname, '../data/playlist-index.json');
  fs.writeFileSync(outputPath, JSON.stringify(index, null, 2));

  console.log('\nPlaylist index built successfully!');
  console.log(`  Output: ${outputPath}`);
  console.log(`  Total playlists: ${playlists.length}`);
  console.log(`  Skipped (no channel match): ${skippedNoChannel}`);
  console.log(`  Skipped (no videos): ${skippedNoVideos}`);

  // Show top 10 playlists by video count
  console.log('\nTop 10 playlists by video count:');
  for (const playlist of playlists.slice(0, 10)) {
    console.log(`  ${playlist.title} (${playlist.channelName}): ${playlist.video_count} videos`);
  }

  // Show playlists by channel
  console.log('\nPlaylists by channel:');
  const byChannel = new Map<string, number>();
  for (const playlist of playlists) {
    byChannel.set(playlist.channelName, (byChannel.get(playlist.channelName) || 0) + 1);
  }
  const sortedChannels = [...byChannel.entries()].sort((a, b) => b[1] - a[1]);
  for (const [channelName, count] of sortedChannels.slice(0, 10)) {
    console.log(`  ${channelName}: ${count} playlists`);
  }
}

buildPlaylistIndex().catch((error) => {
  console.error('Error building playlist index:', error);
  process.exit(1);
});
