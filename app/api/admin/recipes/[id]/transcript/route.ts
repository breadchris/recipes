import { NextRequest, NextResponse } from 'next/server';
import { loadRawVtt, loadTranscriptSegments } from '@/lib/admin/data/file-io';
import { parseVtt } from '@/lib/admin/data/vtt-parser';

/**
 * GET /api/admin/recipes/[id]/transcript
 * Get transcript segments for a video
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;

    // First try to load pre-parsed segments from Lambda format
    const lambdaSegments = await loadTranscriptSegments(videoId);
    if (lambdaSegments && lambdaSegments.length > 0) {
      // Add IDs to segments (Lambda format doesn't have them)
      const segments = lambdaSegments.map((seg, i) => ({
        id: `seg-${i}`,
        ...seg,
      }));
      return NextResponse.json({ segments });
    }

    // Fall back to raw VTT parsing for legacy files
    const rawVtt = await loadRawVtt(videoId);
    if (!rawVtt) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }

    // Parse to segments
    const segments = parseVtt(rawVtt);

    return NextResponse.json({ segments });
  } catch (error) {
    console.error('Error loading transcript:', error);
    return NextResponse.json(
      { error: 'Failed to load transcript' },
      { status: 500 }
    );
  }
}
