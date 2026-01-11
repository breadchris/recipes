'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { RecipeListItem, ChannelInfo } from '@/lib/types/admin';

export default function AdminPage() {
  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch channels and recipes in parallel
        const [channelsRes, recipesRes] = await Promise.all([
          fetch('/api/admin/channels'),
          fetch('/api/admin/recipes'),
        ]);

        if (!channelsRes.ok || !recipesRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const channelsData = await channelsRes.json();
        const recipesData = await recipesRes.json();

        setChannels(channelsData.channels || []);
        setRecipes(recipesData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredRecipes = recipes.filter((recipe) => {
    // Channel filter
    if (selectedChannel && recipe.channel_id !== selectedChannel) {
      return false;
    }
    // Text search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        recipe.title.toLowerCase().includes(query) ||
        recipe.video_id.toLowerCase().includes(query) ||
        (recipe.channel_name?.toLowerCase().includes(query) ?? false)
      );
    }
    return true;
  });

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
            onClick={() => window.location.reload()}
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

      <div className="mb-4 text-sm text-zinc-500">
        {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''} found
      </div>

      {filteredRecipes.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          {searchQuery ? 'No recipes match your search.' : 'No recipes available.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRecipes.map((recipe) => (
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
                <div className="flex-shrink-0">
                  {recipe.has_recipe ? (
                    <span className="px-2 py-1 text-xs bg-green-900/50 text-green-400 rounded">
                      Has Recipe
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
    </div>
  );
}
