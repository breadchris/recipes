import { NextResponse } from 'next/server';
import { getAllVideoIds, loadVideoMetadata } from '@/lib/admin/data/file-io';
import type { ChannelInfo } from '@/lib/types/admin';

/**
 * GET /api/admin/channels
 * List all channels with video counts
 */
export async function GET() {
  try {
    const videoIds = await getAllVideoIds();
    const channelMap = new Map<string, { name: string; count: number }>();

    for (const videoId of videoIds) {
      const metadata = await loadVideoMetadata(videoId);
      if (metadata?.channel_id && metadata?.channel) {
        const existing = channelMap.get(metadata.channel_id);
        if (existing) {
          existing.count++;
        } else {
          channelMap.set(metadata.channel_id, {
            name: metadata.channel,
            count: 1,
          });
        }
      }
    }

    const channels: ChannelInfo[] = Array.from(channelMap.entries())
      .map(([channel_id, { name, count }]) => ({
        channel_id,
        channel_name: name,
        video_count: count,
      }))
      .sort((a, b) => a.channel_name.localeCompare(b.channel_name));

    return NextResponse.json({ channels });
  } catch (error) {
    console.error('Error listing channels:', error);
    return NextResponse.json(
      { error: 'Failed to list channels' },
      { status: 500 }
    );
  }
}
