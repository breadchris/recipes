'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { RecipeGenerator } from '../page';
import type { GeneratedRecipeRecord } from '@/lib/types/generated-recipe';
import type { GeneratedRecipe } from '@/lib/schemas/recipe';

export default function SavedRecipePage() {
  const params = useParams();
  const id = params.id as string;

  const [recipeData, setRecipeData] = useState<{
    recipe: GeneratedRecipe;
    generatedId: string;
    savedId: string;
    prompt?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecipe() {
      try {
        const res = await fetch(`/api/save-generated-recipe/${id}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to load recipe');
          return;
        }

        const record = data.recipe as GeneratedRecipeRecord;
        setRecipeData({
          recipe: record.metadata.recipe as GeneratedRecipe,
          generatedId: record.metadata.generated_id,
          savedId: record.id,
          prompt: record.metadata.prompt,
        });
      } catch (err) {
        console.error('Error fetching recipe:', err);
        setError('Failed to load recipe');
      } finally {
        setLoading(false);
      }
    }

    if (id) {
      fetchRecipe();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-600 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-zinc-500 dark:text-zinc-400">Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (error || !recipeData) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-2xl font-medium text-zinc-900 dark:text-zinc-100 mb-2">
            Recipe Not Found
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6">
            {error || 'This recipe could not be found.'}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return <RecipeGenerator embedded={false} initialRecipeData={recipeData} />;
}
