import { notFound } from 'next/navigation';
import { AdminRecipeEditor } from './admin-recipe-editor';
import { AdminRecipeGenerator } from './admin-recipe-generator';
import {
  isLegacyFormat,
  migrateFromLegacy,
  loadCurrentVersion,
  getAvailableVersionNumbers,
  normalizeRecipe,
} from '@/lib/admin/data/recipe-versions';
import { recipeExists, loadVideoMetadata } from '@/lib/admin/data/file-io';

interface PageProps {
  params: Promise<{ videoId: string }>;
}

export default async function AdminRecipePage({ params }: PageProps) {
  const { videoId } = await params;

  // Load video metadata first - 404 if video doesn't exist
  const metadata = await loadVideoMetadata(videoId);
  if (!metadata) {
    notFound();
  }

  // Check if recipe exists - show generator if not
  if (!recipeExists(videoId)) {
    return (
      <AdminRecipeGenerator
        videoId={videoId}
        videoTitle={metadata.fulltitle || metadata.title || videoId}
      />
    );
  }

  // Migrate legacy format if needed
  if (await isLegacyFormat(videoId)) {
    await migrateFromLegacy(videoId);
  }

  // Load recipe data
  const versionedRecipe = await loadCurrentVersion(videoId);
  if (!versionedRecipe) {
    notFound();
  }

  const availableVersions = await getAvailableVersionNumbers(videoId);
  const normalizedRecipe = normalizeRecipe(versionedRecipe.recipe);

  return (
    <AdminRecipeEditor
      videoId={videoId}
      initialRecipe={normalizedRecipe}
      initialVersionInfo={versionedRecipe.version_info}
      initialAvailableVersions={availableVersions}
      videoTitle={metadata?.fulltitle || metadata?.title || videoId}
    />
  );
}
