import { NextRequest, NextResponse } from 'next/server';
import {
  isLegacyFormat,
  migrateFromLegacy,
  loadVersion,
  loadCurrentVersion,
  getCurrentVersion,
  getAvailableVersionNumbers,
  updateCurrentVersion,
  normalizeRecipe,
} from '@/lib/admin/data/recipe-versions';
import { recipeExists } from '@/lib/admin/data/file-io';
import type { VersionedRecipeResponse, StepChange, VideoRecipes } from '@/lib/types/admin';

/**
 * GET /api/admin/recipes/[id]
 * Load a specific recipe with version info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const versionParam = searchParams.get('version');

    // Check if recipe exists
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

    // Get the requested or current version
    const version = versionParam ? parseInt(versionParam) : await getCurrentVersion(videoId);
    const versionedRecipe = await loadVersion(videoId, version);

    if (!versionedRecipe) {
      return NextResponse.json(
        { error: 'Version not found' },
        { status: 404 }
      );
    }

    // Normalize to new format and get available versions
    const normalizedRecipe = normalizeRecipe(versionedRecipe.recipe);
    const availableVersions = await getAvailableVersionNumbers(videoId);

    const response: VersionedRecipeResponse = {
      version_info: versionedRecipe.version_info,
      recipe: normalizedRecipe,
      available_versions: availableVersions,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error loading recipe:', error);
    return NextResponse.json(
      { error: 'Failed to load recipe' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/recipes/[id]
 * Save manual edits to the current version
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const body = await request.json();
    const { recipeIndex, changes } = body as { recipeIndex: number; changes: StepChange[] };

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

    // Update the current version
    const updated = await updateCurrentVersion(videoId, (recipe: VideoRecipes) => {
      const normalized = normalizeRecipe(recipe);
      const recipeContent = normalized.recipes[recipeIndex];

      if (!recipeContent) {
        return normalized;
      }

      // Apply changes to instructions
      for (const change of changes) {
        const instruction = recipeContent.instructions.find(
          (inst) => inst.step === change.step
        );
        if (instruction) {
          if (change.notes !== undefined) {
            instruction.notes = change.notes;
          }
          if (change.timestamp_seconds !== undefined) {
            instruction.timestamp_seconds = change.timestamp_seconds;
          }
          if (change.end_time_seconds !== undefined) {
            instruction.end_time_seconds = change.end_time_seconds;
          }
        }
      }

      return normalized;
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to update recipe' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recipe: normalizeRecipe(updated.recipe),
    });
  } catch (error) {
    console.error('Error updating recipe:', error);
    return NextResponse.json(
      { error: 'Failed to update recipe' },
      { status: 500 }
    );
  }
}
