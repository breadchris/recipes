import { NextRequest, NextResponse } from 'next/server';
import { LambdaExtractor } from '@/pipeline/lambda';

/**
 * POST /api/admin/recipes/[id]/fetch-transcript
 * Fetch transcript for a video from YouTube via Lambda
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;

    if (!videoId || videoId.length !== 11) {
      return NextResponse.json(
        { error: 'Invalid video ID' },
        { status: 400 }
      );
    }

    const extractor = new LambdaExtractor();

    // Check if already cached locally
    if (extractor.isLocalCached(videoId)) {
      return NextResponse.json({
        success: true,
        cached: true,
        message: 'Transcript already exists locally',
      });
    }

    // Try to extract via Lambda
    const result = await extractor.extractVideo(videoId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || 'Lambda extraction failed' },
        { status: 500 }
      );
    }

    // Sync from S3 to local cache
    const synced = await extractor.syncFromS3([videoId]);

    if (synced === 0) {
      return NextResponse.json(
        { error: 'Failed to sync from S3' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      cached: false,
      message: 'Transcript fetched successfully',
    });
  } catch (error) {
    console.error('Error fetching transcript:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch transcript' },
      { status: 500 }
    );
  }
}
