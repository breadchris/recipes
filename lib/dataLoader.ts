import { promises as fs } from 'fs';
import { gunzipSync } from 'zlib';
import path from 'path';
import type { Channel, VideoWithChannel } from './types';

interface RecipesData {
  channels: Channel[];
  videos: VideoWithChannel[];
  channelsBySlug: Record<string, Channel>;
  videosByID: Record<string, VideoWithChannel>;
  metadata: {
    totalChannels: number;
    totalVideos: number;
    generatedAt: string;
  };
}

let cachedData: RecipesData | null = null;

async function loadData(): Promise<RecipesData> {
  if (cachedData) {
    return cachedData;
  }

  const dataPath = path.join(process.cwd(), 'data', 'recipes-data.json.gz');

  try {
    const compressed = await fs.readFile(dataPath);
    const decompressed = gunzipSync(compressed);
    const data = JSON.parse(decompressed.toString()) as RecipesData;

    cachedData = data;
    console.log(`Loaded ${data.metadata.totalVideos} videos from ${data.metadata.totalChannels} channels`);

    return data;
  } catch (error) {
    console.error('Failed to load recipes data:', error);
    throw new Error('Could not load recipe data');
  }
}

export async function getAllVideos(): Promise<VideoWithChannel[]> {
  const data = await loadData();
  return data.videos;
}

export async function getVideoById(videoId: string): Promise<VideoWithChannel | null> {
  const data = await loadData();
  return data.videosByID[videoId] || null;
}

export async function getChannelBySlug(slug: string): Promise<Channel | null> {
  const data = await loadData();
  return data.channelsBySlug[slug] || null;
}

export async function getAllChannels(): Promise<Channel[]> {
  const data = await loadData();
  return data.channels;
}
