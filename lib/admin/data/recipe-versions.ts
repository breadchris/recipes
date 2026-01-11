/**
 * Recipe version management for the admin panel.
 * Handles loading, saving, and versioning of recipes.
 */
import { readFile, writeFile, readdir, mkdir, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import type {
  VideoRecipes,
  RecipeVersionInfo,
  VersionedRecipe,
  RecipeVersionSummary,
  AdminRecipeContent,
} from '@/lib/types/admin';
import { DEFAULT_RECIPE_PROMPT } from '../openai/default-prompt';
import { recipesDir } from './file-io';

/**
 * Normalize a recipe to the new format with recipes array.
 * Handles legacy format where recipe content is at the top level.
 */
export function normalizeRecipe(recipe: VideoRecipes): VideoRecipes {
  // If already has recipes array with content, return as-is
  if (recipe.recipes && Array.isArray(recipe.recipes) && recipe.recipes.length > 0) {
    return recipe;
  }

  // Legacy format: extract recipe content and wrap in recipes array
  const {
    has_recipe,
    video_id,
    video_url,
    upload_date,
    recipes: _recipes, // exclude empty recipes array if present
    ...content
  } = recipe as VideoRecipes & Record<string, unknown>;

  return {
    has_recipe: has_recipe ?? true,
    video_id: video_id ?? '',
    video_url: video_url ?? '',
    upload_date: upload_date ?? '',
    recipes: [content as unknown as AdminRecipeContent],
  };
}

/**
 * Get the versions directory for a video
 */
export function getVersionsDir(videoId: string): string {
  return join(recipesDir(), videoId, 'versions');
}

/**
 * Get the current version file path
 */
function getCurrentVersionFile(videoId: string): string {
  return join(recipesDir(), videoId, 'current_version.txt');
}

/**
 * Get the legacy recipe file path
 */
function getLegacyRecipeFile(videoId: string): string {
  return join(recipesDir(), `${videoId}_recipe.json`);
}

/**
 * Check if a recipe is in legacy (flat file) format
 */
export async function isLegacyFormat(videoId: string): Promise<boolean> {
  const legacyPath = getLegacyRecipeFile(videoId);
  const versionedDir = getVersionsDir(videoId);

  const legacyExists = existsSync(legacyPath);
  const versionedExists = existsSync(versionedDir);

  return legacyExists && !versionedExists;
}

/**
 * Migrate a legacy recipe to versioned format
 */
export async function migrateFromLegacy(videoId: string): Promise<void> {
  const legacyPath = getLegacyRecipeFile(videoId);
  const versionsDir = getVersionsDir(videoId);

  // Read legacy recipe
  const content = await readFile(legacyPath, 'utf-8');
  const recipe: VideoRecipes = JSON.parse(content);

  // Get file modification time for created_at
  const stats = await stat(legacyPath);
  const createdAt = stats.mtime.toISOString();

  // Create version info
  const versionInfo: RecipeVersionInfo = {
    version: 1,
    created_at: createdAt,
    prompt_used: DEFAULT_RECIPE_PROMPT,
    model: 'gpt-4o',
    temperature: 0.3,
    generation_type: 'original',
  };

  // Create versioned structure
  const versionedRecipe: VersionedRecipe = {
    version_info: versionInfo,
    recipe,
  };

  // Create versions directory
  await mkdir(versionsDir, { recursive: true });

  // Write v1.json
  const v1Path = join(versionsDir, 'v1.json');
  await writeFile(v1Path, JSON.stringify(versionedRecipe, null, 2), 'utf-8');

  // Write current_version.txt
  const currentVersionPath = getCurrentVersionFile(videoId);
  await writeFile(currentVersionPath, '1', 'utf-8');
}

/**
 * List all versions for a video
 */
export async function listVersions(videoId: string): Promise<RecipeVersionSummary[]> {
  const versionsDir = getVersionsDir(videoId);

  if (!existsSync(versionsDir)) {
    return [];
  }

  const files = await readdir(versionsDir);
  const versionFiles = files.filter((f) => /^v\d+\.json$/.test(f));

  const summaries: RecipeVersionSummary[] = [];

  for (const file of versionFiles) {
    const versionNum = parseInt(file.match(/^v(\d+)\.json$/)?.[1] || '0');
    if (versionNum === 0) continue;

    try {
      const content = await readFile(join(versionsDir, file), 'utf-8');
      const versionedRecipe: VersionedRecipe = JSON.parse(content);

      summaries.push({
        version: versionedRecipe.version_info.version,
        created_at: versionedRecipe.version_info.created_at,
        generation_type: versionedRecipe.version_info.generation_type,
      });
    } catch {
      // Skip invalid files
    }
  }

  // Sort by version number descending (newest first)
  return summaries.sort((a, b) => b.version - a.version);
}

/**
 * Get the current version number for a video
 */
export async function getCurrentVersion(videoId: string): Promise<number> {
  const currentVersionPath = getCurrentVersionFile(videoId);

  if (!existsSync(currentVersionPath)) {
    return 1;
  }

  const content = await readFile(currentVersionPath, 'utf-8');
  return parseInt(content.trim()) || 1;
}

/**
 * Set the current version for a video
 */
export async function setCurrentVersion(videoId: string, version: number): Promise<void> {
  const currentVersionPath = getCurrentVersionFile(videoId);
  await mkdir(dirname(currentVersionPath), { recursive: true });
  await writeFile(currentVersionPath, String(version), 'utf-8');
}

/**
 * Load a specific version of a recipe
 */
export async function loadVersion(videoId: string, version: number): Promise<VersionedRecipe | null> {
  const versionPath = join(getVersionsDir(videoId), `v${version}.json`);

  if (!existsSync(versionPath)) {
    return null;
  }

  const content = await readFile(versionPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Load the current version of a recipe
 */
export async function loadCurrentVersion(videoId: string): Promise<VersionedRecipe | null> {
  const currentVersion = await getCurrentVersion(videoId);
  return loadVersion(videoId, currentVersion);
}

/**
 * Get the next version number
 */
export async function getNextVersion(videoId: string): Promise<number> {
  const versions = await listVersions(videoId);
  if (versions.length === 0) {
    return 1;
  }
  return Math.max(...versions.map((v) => v.version)) + 1;
}

/**
 * Save a new version of a recipe
 */
export async function saveNewVersion(
  videoId: string,
  recipe: VideoRecipes,
  versionInfo: Omit<RecipeVersionInfo, 'version'>
): Promise<number> {
  const versionsDir = getVersionsDir(videoId);
  await mkdir(versionsDir, { recursive: true });

  const version = await getNextVersion(videoId);

  const fullVersionInfo: RecipeVersionInfo = {
    ...versionInfo,
    version,
  };

  const versionedRecipe: VersionedRecipe = {
    version_info: fullVersionInfo,
    recipe,
  };

  // Write the version file
  const versionPath = join(versionsDir, `v${version}.json`);
  await writeFile(versionPath, JSON.stringify(versionedRecipe, null, 2), 'utf-8');

  // Update current version
  await setCurrentVersion(videoId, version);

  return version;
}

/**
 * Get list of available version numbers
 */
export async function getAvailableVersionNumbers(videoId: string): Promise<number[]> {
  const versions = await listVersions(videoId);
  return versions.map((v) => v.version).sort((a, b) => b - a);
}

/**
 * Update the current version in place (for notes/boundary edits, not regeneration)
 */
export async function updateCurrentVersion(
  videoId: string,
  updateFn: (recipe: VideoRecipes) => VideoRecipes
): Promise<VersionedRecipe | null> {
  const currentVersion = await getCurrentVersion(videoId);
  const versionedRecipe = await loadVersion(videoId, currentVersion);

  if (!versionedRecipe) {
    return null;
  }

  // Apply the update function
  const updatedRecipe = updateFn(versionedRecipe.recipe);

  // Create updated versioned recipe
  const updated: VersionedRecipe = {
    version_info: versionedRecipe.version_info,
    recipe: updatedRecipe,
  };

  // Write back to the same version file
  const versionPath = join(getVersionsDir(videoId), `v${currentVersion}.json`);
  await writeFile(versionPath, JSON.stringify(updated, null, 2), 'utf-8');

  return updated;
}
