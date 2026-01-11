'use client';

import { useState, useCallback } from 'react';
import { AdminRecipeViewer } from '@/components/admin/AdminRecipeViewer';
import type { VideoRecipes, RecipeVersionInfo } from '@/lib/types/admin';

interface AdminRecipeEditorProps {
  videoId: string;
  initialRecipe: VideoRecipes;
  initialVersionInfo: RecipeVersionInfo;
  initialAvailableVersions: number[];
  videoTitle: string;
}

export function AdminRecipeEditor({
  videoId,
  initialRecipe,
  initialVersionInfo,
  initialAvailableVersions,
}: AdminRecipeEditorProps) {
  const [recipe, setRecipe] = useState<VideoRecipes>(initialRecipe);
  const [versionInfo, setVersionInfo] = useState<RecipeVersionInfo>(initialVersionInfo);
  const [availableVersions, setAvailableVersions] = useState<number[]>(initialAvailableVersions);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRegenerating2Stage, setIsRegenerating2Stage] = useState(false);

  const handleVersionChange = useCallback(
    async (version: number) => {
      try {
        const response = await fetch(`/api/admin/recipes/${videoId}?version=${version}`);
        if (!response.ok) throw new Error('Failed to load version');
        const data = await response.json();
        setRecipe(data.recipe);
        setVersionInfo(data.version_info);
        setAvailableVersions(data.available_versions);
      } catch (error) {
        console.error('Failed to load version:', error);
      }
    },
    [videoId]
  );

  const handleRegenerate = useCallback(
    async (prompt: string) => {
      setIsRegenerating(true);
      try {
        const response = await fetch(`/api/admin/recipes/${videoId}/regenerate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to regenerate');
        }

        const data = await response.json();
        setRecipe(data.recipe);
        setVersionInfo(data.version_info);
        setAvailableVersions((prev) => [data.version, ...prev]);
      } catch (error) {
        console.error('Failed to regenerate:', error);
        alert(error instanceof Error ? error.message : 'Failed to regenerate recipe');
      } finally {
        setIsRegenerating(false);
      }
    },
    [videoId]
  );

  const handleRegenerate2Stage = useCallback(
    async (prompt: string) => {
      setIsRegenerating2Stage(true);
      try {
        const response = await fetch(`/api/admin/recipes/${videoId}/regenerate-2stage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to regenerate (2-stage)');
        }

        const data = await response.json();
        setRecipe(data.recipe);
        setVersionInfo(data.version_info);
        setAvailableVersions((prev) => [data.version, ...prev]);
      } catch (error) {
        console.error('Failed to regenerate (2-stage):', error);
        alert(error instanceof Error ? error.message : 'Failed to regenerate recipe (2-stage)');
      } finally {
        setIsRegenerating2Stage(false);
      }
    },
    [videoId]
  );

  const handleSaveChanges = useCallback(
    async (
      changes: { step: number; notes?: string; timestamp_seconds?: number; end_time_seconds?: number }[]
    ) => {
      try {
        const response = await fetch(`/api/admin/recipes/${videoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipeIndex: 0, changes }),
        });

        if (!response.ok) throw new Error('Failed to save changes');

        const data = await response.json();
        setRecipe(data.recipe);
      } catch (error) {
        console.error('Failed to save changes:', error);
        throw error;
      }
    },
    [videoId]
  );

  return (
    <AdminRecipeViewer
      recipe={recipe}
      versionInfo={versionInfo}
      availableVersions={availableVersions}
      onVersionChange={handleVersionChange}
      onRegenerate={handleRegenerate}
      isRegenerating={isRegenerating}
      onRegenerate2Stage={handleRegenerate2Stage}
      isRegenerating2Stage={isRegenerating2Stage}
      onSaveChanges={handleSaveChanges}
    />
  );
}
