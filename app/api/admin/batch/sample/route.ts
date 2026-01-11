import { NextRequest, NextResponse } from 'next/server';
import {
  getAllVideoIds,
  hasTranscript,
  loadVideoMetadata,
} from '@/lib/admin/data/file-io';
import type { BatchSampleResponse, BatchVideoSample } from '@/lib/types/admin';

/**
 * GET /api/admin/batch/sample
 * Get a random sample of videos with transcripts for batch processing
 *
 * Query params:
 * - count: number of videos to sample (default: 10)
 * - channels: comma-separated list of channel IDs to filter by (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const count = parseInt(searchParams.get('count') || '10', 10);
    const channelsParam = searchParams.get('channels');
    const channelFilter = channelsParam ? channelsParam.split(',').filter(Boolean) : [];

    // Get all video IDs
    const allVideoIds = await getAllVideoIds();

    // Filter to videos with transcripts
    const videosWithTranscripts: string[] = [];
    for (const videoId of allVideoIds) {
      if (hasTranscript(videoId)) {
        videosWithTranscripts.push(videoId);
      }
    }

    // If channel filter is provided, filter by channels
    let filteredVideos = videosWithTranscripts;
    if (channelFilter.length > 0) {
      const videosByChannel: string[] = [];
      for (const videoId of videosWithTranscripts) {
        const metadata = await loadVideoMetadata(videoId);
        if (metadata && channelFilter.includes(metadata.channel_id || '')) {
          videosByChannel.push(videoId);
        }
      }
      filteredVideos = videosByChannel;
    }

    // Shuffle and take random sample
    const shuffled = [...filteredVideos].sort(() => Math.random() - 0.5);
    const sampled = shuffled.slice(0, Math.min(count, shuffled.length));

    // Load metadata for sampled videos
    const videos: BatchVideoSample[] = [];
    for (const videoId of sampled) {
      const metadata = await loadVideoMetadata(videoId);
      videos.push({
        video_id: videoId,
        title: metadata?.fulltitle || metadata?.title || videoId,
        channel_name: metadata?.channel,
        channel_id: metadata?.channel_id,
      });
    }

    const response: BatchSampleResponse = { videos };
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error sampling videos:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sample videos' },
      { status: 500 }
    );
  }
}
