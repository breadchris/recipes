import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/clients/supabaseServer';
import type { ChannelInfo } from '@/lib/types/admin';

const RECIPES_GROUP_ID = '52f7d41b-490e-40d1-b5da-eb1d74ec2eae';

/**
 * GET /api/admin/channels
 * List all channels with video counts (using SQL aggregation)
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT
          metadata->>'youtube_channel_id' as channel_id,
          metadata->>'youtube_channel' as channel_name,
          COUNT(*) as video_count
        FROM content
        WHERE group_id = '${RECIPES_GROUP_ID}'
          AND type = 'text'
          AND metadata->>'youtube_channel_id' IS NOT NULL
          AND metadata->>'youtube_channel' IS NOT NULL
        GROUP BY
          metadata->>'youtube_channel_id',
          metadata->>'youtube_channel'
        ORDER BY metadata->>'youtube_channel'
      `
    });

    if (error) throw error;

    const channels: ChannelInfo[] = (data || []).map((row: { channel_id: string; channel_name: string; video_count: string }) => ({
      channel_id: row.channel_id,
      channel_name: row.channel_name,
      video_count: Number(row.video_count),
    }));

    return NextResponse.json({ channels });
  } catch (error) {
    console.error('Error listing channels:', error);
    return NextResponse.json(
      { error: 'Failed to list channels' },
      { status: 500 }
    );
  }
}
