import { NextResponse } from 'next/server';
import { getPipelineRuns, type RunManifest } from '@/lib/admin/data/file-io';

/**
 * GET /api/admin/pipeline
 * List all pipeline runs
 */
export async function GET() {
  try {
    const runs = await getPipelineRuns();

    return NextResponse.json({
      runs,
      total: runs.length,
    });
  } catch (error) {
    console.error('Error listing pipeline runs:', error);
    return NextResponse.json(
      { error: 'Failed to list pipeline runs' },
      { status: 500 }
    );
  }
}
