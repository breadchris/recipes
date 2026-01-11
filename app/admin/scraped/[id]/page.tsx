'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface ScrapedRecipe {
  id: string;
  name: string;
  source: string;
  source_domain: string;
  image: string;
  directions: string[] | string;
  ingredients: string[];
  tags: string[];
  video: string;
  yield: string;
  time_minutes: number;
}

const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  'americastestkitchen.com': "America's Test Kitchen",
  'cooking.nytimes.com': 'NYT Cooking',
  'epicurious.com': 'Epicurious',
  'joshuaweissman.com': 'Joshua Weissman',
};

export default function ScrapedRecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [recipe, setRecipe] = useState<ScrapedRecipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRecipe() {
      try {
        const res = await fetch(`/api/admin/scraped/${encodeURIComponent(id)}`);
        if (!res.ok) {
          throw new Error('Recipe not found');
        }
        const data = await res.json();
        setRecipe(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recipe');
      } finally {
        setLoading(false);
      }
    }
    fetchRecipe();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          href="/admin/scraped"
          className="text-violet-400 hover:text-violet-300 mb-4 inline-block"
        >
          ← Back to Scraped Recipes
        </Link>
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{error || 'Recipe not found'}</p>
        </div>
      </div>
    );
  }

  const directions = Array.isArray(recipe.directions)
    ? recipe.directions.filter(Boolean)
    : recipe.directions?.split('\n\n').filter(Boolean) ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link
        href="/admin/scraped"
        className="text-violet-400 hover:text-violet-300 mb-4 inline-block"
      >
        ← Back to Scraped Recipes
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h1 className="text-3xl font-bold text-zinc-100 mb-4">{recipe.name}</h1>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <span className="px-3 py-1 bg-zinc-700 text-zinc-300 rounded text-sm">
              {SOURCE_DISPLAY_NAMES[recipe.source_domain] || recipe.source_domain}
            </span>
            {recipe.time_minutes > 0 && (
              <span className="text-zinc-400 text-sm">
                ⏱ {recipe.time_minutes} minutes
              </span>
            )}
            {recipe.yield && (
              <span className="text-zinc-400 text-sm">📊 {recipe.yield}</span>
            )}
          </div>

          {recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {recipe.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-violet-900/30 text-violet-400 rounded text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-3 mb-8">
            <a
              href={recipe.source}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg hover:bg-zinc-600 transition-colors text-sm"
            >
              View Original →
            </a>
            {recipe.video && (
              <a
                href={recipe.video}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-red-900/50 text-red-300 rounded-lg hover:bg-red-900/70 transition-colors text-sm"
              >
                Watch Video →
              </a>
            )}
          </div>

          {recipe.image && (
            <div className="aspect-video relative rounded-lg overflow-hidden mb-8 bg-zinc-900">
              <Image
                src={recipe.image}
                alt={recipe.name}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 66vw"
              />
            </div>
          )}

          <div className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100 mb-4">Directions</h2>
            <ol className="space-y-4">
              {directions.map((step, idx) => (
                <li key={idx} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-violet-900/50 text-violet-300 flex items-center justify-center text-sm font-medium">
                    {idx + 1}
                  </span>
                  <p className="text-zinc-300 leading-relaxed pt-1">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-4 bg-zinc-800 border border-zinc-700 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-zinc-100 mb-4">
              Ingredients
            </h2>
            <ul className="space-y-2">
              {recipe.ingredients.map((ing, idx) => (
                <li key={idx} className="text-zinc-300 text-sm flex gap-2">
                  <span className="text-zinc-500">•</span>
                  <span>{ing}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-8 border-t border-zinc-800">
        <p className="text-xs text-zinc-500">
          Recipe ID: <code className="bg-zinc-800 px-1 rounded">{recipe.id}</code>
        </p>
      </div>
    </div>
  );
}
