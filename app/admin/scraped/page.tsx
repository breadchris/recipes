'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface ScrapedRecipe {
  id: string;
  name: string;
  source: string;
  source_domain: string;
  image: string;
  tags: string[];
  time_minutes: number;
}

interface FacetValue {
  value: string;
  count: number;
}

interface SearchResponse {
  results: ScrapedRecipe[];
  total: number;
  page: number;
  per_page: number;
  facets?: {
    source_domain?: FacetValue[];
    tags?: FacetValue[];
  };
}

const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  'americastestkitchen.com': "America's Test Kitchen",
  'cooking.nytimes.com': 'NYT Cooking',
  'epicurious.com': 'Epicurious',
  'joshuaweissman.com': 'Joshua Weissman',
};

export default function ScrapedRecipesPage() {
  const [recipes, setRecipes] = useState<ScrapedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [sourceFacets, setSourceFacets] = useState<FacetValue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);

  const fetchRecipes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery) {
        params.set('q', searchQuery);
      }
      if (selectedSource) {
        params.set('source', selectedSource);
      }
      params.set('page', page.toString());
      params.set('per_page', perPage.toString());

      const res = await fetch(`/api/admin/scraped?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch scraped recipes');
      }

      const data: SearchResponse = await res.json();
      setRecipes(data.results);
      setTotal(data.total);
      if (data.facets?.source_domain) {
        setSourceFacets(data.facets.source_domain);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedSource, page, perPage]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchRecipes();
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Scraped Recipes</h1>
        <p className="text-zinc-400">
          Browse and search recipes scraped from external sources.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6 flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search recipes by name or ingredients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>
        <div className="w-64">
          <select
            value={selectedSource}
            onChange={(e) => {
              setSelectedSource(e.target.value);
              setPage(1);
            }}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          >
            <option value="">All Sources</option>
            {sourceFacets.map((facet) => (
              <option key={facet.value} value={facet.value}>
                {SOURCE_DISPLAY_NAMES[facet.value] || facet.value} ({facet.count.toLocaleString()})
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
        >
          Search
        </button>
      </form>

      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-zinc-500">
          {total.toLocaleString()} recipe{total !== 1 ? 's' : ''} found
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700"
            >
              Previous
            </button>
            <span className="text-sm text-zinc-400">
              Page {page} of {totalPages.toLocaleString()}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-400">Loading recipes...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchRecipes}
              className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg hover:bg-zinc-600 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          {searchQuery ? 'No recipes match your search.' : 'No recipes available.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((recipe) => (
            <Link
              key={recipe.id}
              href={`/admin/scraped/${encodeURIComponent(recipe.id)}`}
              className="block bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden hover:border-zinc-600 hover:bg-zinc-750 transition-colors"
            >
              <div className="aspect-video bg-zinc-900 relative">
                {recipe.image ? (
                  <Image
                    src={recipe.image}
                    alt={recipe.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-600">
                    No Image
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-medium text-zinc-200 line-clamp-2 mb-2">
                  {recipe.name}
                </h3>
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-2 py-0.5 bg-zinc-700 text-zinc-300 rounded text-xs">
                    {SOURCE_DISPLAY_NAMES[recipe.source_domain] || recipe.source_domain}
                  </span>
                  {recipe.time_minutes > 0 && (
                    <span className="text-zinc-500">
                      {recipe.time_minutes} min
                    </span>
                  )}
                </div>
                {recipe.tags && recipe.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {recipe.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-1.5 py-0.5 bg-violet-900/30 text-violet-400 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {recipe.tags.length > 3 && (
                      <span className="text-xs text-zinc-500">
                        +{recipe.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}

      {!loading && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700"
          >
            Previous
          </button>
          <span className="text-sm text-zinc-400 px-4">
            Page {page} of {totalPages.toLocaleString()}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
