import { NextResponse } from 'next/server';
import { loadVideoMetadata } from '@/lib/admin/data/file-io';

interface VideoDetails {
  id: string;
  title: string;
  channel_name: string | null;
  thumbnail: string;
}

/**
 * POST /api/admin/recipe-types/videos
 * Returns video details for a list of video IDs
 */
export async function POST(request: Request) {
  try {
    const { video_ids } = await request.json();

    if (!Array.isArray(video_ids)) {
      return NextResponse.json(
        { error: 'video_ids must be an array' },
        { status: 400 }
      );
    }

    const videos: VideoDetails[] = await Promise.all(
      video_ids.map(async (videoId: string) => {
        const metadata = await loadVideoMetadata(videoId);
        return {
          id: videoId,
          title: metadata?.fulltitle || metadata?.title || videoId,
          channel_name: metadata?.channel || null,
          thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        };
      })
    );

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Error fetching video details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video details' },
      { status: 500 }
    );
  }
}
