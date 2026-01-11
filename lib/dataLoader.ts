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

async function loadFromBlob(url: string): Promise<RecipesData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch from blob: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const compressed = Buffer.from(arrayBuffer);
  const decompressed = gunzipSync(compressed);
  return JSON.parse(decompressed.toString()) as RecipesData;
}

async function loadFromFile(): Promise<RecipesData> {
  const dataPath = path.join(process.cwd(), 'data', 'recipes-data.json.gz');
  const compressed = await fs.readFile(dataPath);
  const decompressed = gunzipSync(compressed);
  return JSON.parse(decompressed.toString()) as RecipesData;
}

async function loadData(): Promise<RecipesData> {
  if (cachedData) {
    return cachedData;
  }

  try {
    const blobUrl = process.env.RECIPES_DATA_URL;
    const data = blobUrl
      ? await loadFromBlob(blobUrl)
      : await loadFromFile();

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
