import { NextRequest, NextResponse } from 'next/server';
import { getPipelineRuns, getPipelineRunVideoIds, loadPipelineVideo } from '@/lib/admin/data/file-io';

/**
 * GET /api/admin/pipeline/[runId]
 * Get details of a specific pipeline run
 * Query params:
 *   - include_videos: 'true' - include full video data (can be large)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const includeVideos = searchParams.get('include_videos') === 'true';

    // Find the manifest for this run
    const runs = await getPipelineRuns();
    const manifest = runs.find(r => r.run_id === runId);

    if (!manifest) {
      return NextResponse.json(
        { error: 'Pipeline run not found' },
        { status: 404 }
      );
    }

    // Get video IDs in this run
    const videoIds = await getPipelineRunVideoIds(runId);

    // Optionally load full video data
    let videos = undefined;
    if (includeVideos) {
      videos = [];
      for (const videoId of videoIds) {
        const video = await loadPipelineVideo(runId, videoId);
        if (video) {
          videos.push(video);
        }
      }
    }

    return NextResponse.json({
      manifest,
      video_ids: videoIds,
      video_count: videoIds.length,
      ...(videos && { videos }),
    });
  } catch (error) {
    console.error('Error loading pipeline run:', error);
    return NextResponse.json(
      { error: 'Failed to load pipeline run' },
      { status: 500 }
    );
  }
}
