import { NextRequest, NextResponse } from 'next/server';
import {
  listVersions,
  getCurrentVersion,
  isLegacyFormat,
  migrateFromLegacy,
  setCurrentVersion,
} from '@/lib/admin/data/recipe-versions';
import { recipeExists } from '@/lib/admin/data/file-io';

/**
 * GET /api/admin/recipes/[id]/versions
 * List all versions for a recipe
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;

    if (!recipeExists(videoId)) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    // Migrate legacy format if needed
    if (await isLegacyFormat(videoId)) {
      await migrateFromLegacy(videoId);
    }

    const versions = await listVersions(videoId);
    const currentVersion = await getCurrentVersion(videoId);

    return NextResponse.json({
      current_version: currentVersion,
      versions,
    });
  } catch (error) {
    console.error('Error listing versions:', error);
    return NextResponse.json(
      { error: 'Failed to list versions' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/recipes/[id]/versions
 * Switch to a different version
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const body = await request.json();
    const { version } = body as { version: number };

    if (!recipeExists(videoId)) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    // Set the current version
    await setCurrentVersion(videoId, version);

    return NextResponse.json({
      success: true,
      current_version: version,
    });
  } catch (error) {
    console.error('Error switching version:', error);
    return NextResponse.json(
      { error: 'Failed to switch version' },
      { status: 500 }
    );
  }
}
