'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { RecipeListItem, ChannelInfo, PaginatedRecipeListResponse } from '@/lib/types/admin';

const ITEMS_PER_PAGE = 50;

export default function AdminPage() {
  // Data state
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);

  // Pagination state
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');

  // Loading state
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to page 1 on search change
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when channel changes
  useEffect(() => {
    setPage(1);
  }, [selectedChannel]);

  // Fetch channels on mount
  useEffect(() => {
    async function fetchChannels() {
      try {
        const res = await fetch('/api/admin/channels');
        if (!res.ok) throw new Error('Failed to fetch channels');
        const data = await res.json();
        setChannels(data.channels || []);
      } catch (err) {
        console.error('Error fetching channels:', err);
      }
    }
    fetchChannels();
  }, []);

  // Fetch recipes when page, search, or channel changes
  const fetchRecipes = useCallback(async () => {
    setLoadingPage(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: ITEMS_PER_PAGE.toString(),
      });

      if (debouncedSearch) {
        params.set('search', debouncedSearch);
      }
      if (selectedChannel) {
        params.set('channel', selectedChannel);
      }

      const res = await fetch(`/api/admin/recipes?${params}`);
      if (!res.ok) throw new Error('Failed to fetch recipes');

      const data: PaginatedRecipeListResponse = await res.json();

      setRecipes(data.items);
      setTotalPages(data.totalPages);
      setTotalItems(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recipes');
    } finally {
      setLoading(false);
      setLoadingPage(false);
    }
  }, [page, debouncedSearch, selectedChannel]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  // Pagination helpers
  const startItem = totalItems === 0 ? 0 : (page - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(page * ITEMS_PER_PAGE, totalItems);

  const goToPage = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('ellipsis');

      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (page < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }

    return pages;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading recipes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => fetchRecipes()}
            className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg hover:bg-zinc-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Recipe Admin</h1>
        <p className="text-zinc-400">
          View and edit recipe data. This panel is only available in development.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-6 flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by title, video ID, or channel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
          />
        </div>
        <div className="w-64">
          <select
            value={selectedChannel}
            onChange={(e) => setSelectedChannel(e.target.value)}
            className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
          >
            <option value="">All Channels ({channels.length})</option>
            {channels.map((channel) => (
              <option key={channel.channel_id} value={channel.channel_id}>
                {channel.channel_name} ({channel.video_count})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results count and loading indicator */}
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-zinc-500">
          {loadingPage ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
              Loading...
            </span>
          ) : (
            <>
              {totalItems === 0
                ? 'No recipes found'
                : `Showing ${startItem}-${endItem} of ${totalItems.toLocaleString()} recipes`}
            </>
          )}
        </div>
      </div>

      {/* Recipe List */}
      {recipes.length === 0 && !loadingPage ? (
        <div className="text-center py-12 text-zinc-500">
          {debouncedSearch || selectedChannel
            ? 'No recipes match your filters.'
            : 'No recipes available.'}
        </div>
      ) : (
        <div className="space-y-2">
          {recipes.map((recipe) => (
            <Link
              key={recipe.video_id}
              href={`/admin/recipe/${recipe.video_id}`}
              className="block p-4 bg-zinc-800 border border-zinc-700 rounded-lg hover:border-zinc-600 hover:bg-zinc-750 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-zinc-200 truncate">{recipe.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-zinc-500 font-mono">{recipe.video_id}</p>
                    {recipe.channel_name && (
                      <>
                        <span className="text-zinc-600">·</span>
                        <p className="text-sm text-zinc-400">{recipe.channel_name}</p>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0 flex gap-2">
                  {recipe.has_transcript ? (
                    <span className="px-2 py-1 text-xs bg-blue-900/50 text-blue-400 rounded">
                      Transcript
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-zinc-700 text-zinc-400 rounded">
                      No Transcript
                    </span>
                  )}
                  {recipe.has_recipe ? (
                    <span className="px-2 py-1 text-xs bg-green-900/50 text-green-400 rounded">
                      Recipe
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-zinc-700 text-zinc-400 rounded">
                      No Recipe
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page === 1 || loadingPage}
            className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>

          <div className="flex items-center gap-1">
            {getPageNumbers().map((pageNum, idx) =>
              pageNum === 'ellipsis' ? (
                <span key={`ellipsis-${idx}`} className="px-2 text-zinc-500">
                  ...
                </span>
              ) : (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  disabled={loadingPage}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    page === pageNum
                      ? 'bg-zinc-600 text-zinc-100'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  {pageNum}
                </button>
              )
            )}
          </div>

          <button
            onClick={() => goToPage(page + 1)}
            disabled={page === totalPages || loadingPage}
            className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
