import { NextRequest, NextResponse } from 'next/server';
import { loadPipelineVideo } from '@/lib/admin/data/file-io';

/**
 * GET /api/admin/pipeline/[runId]/videos/[videoId]
 * Get a specific video from a pipeline run
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string; videoId: string }> }
) {
  try {
    const { runId, videoId } = await params;

    const video = await loadPipelineVideo(runId, videoId);

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found in pipeline run' },
        { status: 404 }
      );
    }

    return NextResponse.json(video);
  } catch (error) {
    console.error('Error loading pipeline video:', error);
    return NextResponse.json(
      { error: 'Failed to load pipeline video' },
      { status: 500 }
    );
  }
}
