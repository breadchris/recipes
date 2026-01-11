'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { RecipeTypeIndex, RecipeTypeGroup, RecipeVariation } from '@/lib/recipe-grouping/types';

interface VideoDetails {
  id: string;
  title: string;
  channel_name: string | null;
  thumbnail: string;
}

export default function RecipeTypesPage() {
  const [data, setData] = useState<RecipeTypeIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [expandedVariation, setExpandedVariation] = useState<string | null>(null);
  const [videoDetails, setVideoDetails] = useState<Map<string, VideoDetails>>(new Map());
  const [loadingVideos, setLoadingVideos] = useState(false);

  // Load recipe type groups on mount
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/api/admin/recipe-types');
        if (!res.ok) throw new Error('Failed to load recipe types');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter and sort groups
  const sortedGroups = useMemo(() => {
    if (!data) return [];

    return Object.values(data.groups)
      .filter((group) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
          group.canonical_name.toLowerCase().includes(query) ||
          group.slug.includes(query) ||
          Object.values(group.variations).some((v) =>
            v.name.toLowerCase().includes(query)
          )
        );
      })
      .sort((a, b) => b.total_count - a.total_count);
  }, [data, searchQuery]);

  // Get the selected group data
  const selectedGroupData = useMemo(() => {
    if (!data || !selectedGroup) return null;
    return data.groups[selectedGroup] || null;
  }, [data, selectedGroup]);

  // Fetch video details when a variation is expanded
  async function fetchVideoDetails(videoIds: string[]) {
    // Filter out already loaded videos
    const newIds = videoIds.filter((id) => !videoDetails.has(id));
    if (newIds.length === 0) return;

    setLoadingVideos(true);
    try {
      const res = await fetch('/api/admin/recipe-types/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_ids: newIds }),
      });

      if (!res.ok) throw new Error('Failed to fetch video details');

      const json = await res.json();
      const newMap = new Map(videoDetails);
      for (const video of json.videos) {
        newMap.set(video.id, video);
      }
      setVideoDetails(newMap);
    } catch (err) {
      console.error('Error fetching video details:', err);
    } finally {
      setLoadingVideos(false);
    }
  }

  // Handle variation expansion
  function handleVariationClick(variationSlug: string, variation: RecipeVariation) {
    if (expandedVariation === variationSlug) {
      setExpandedVariation(null);
    } else {
      setExpandedVariation(variationSlug);
      fetchVideoDetails(variation.video_ids);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-zinc-600 border-t-zinc-300 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading recipe types...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
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
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">
          Recipe Type Browser
          <span className="ml-2 text-sm font-normal px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
            Experimental
          </span>
        </h1>
        <p className="text-zinc-400">
          Browse recipes organized by dish type. Compare how different chefs approach the same dish.
        </p>
        {data && (
          <div className="mt-2 text-sm text-zinc-500">
            {data.metadata.unique_groups} categories | {data.metadata.unique_variations} variations | {data.metadata.grouped_recipes} recipes ({Math.round((data.metadata.grouped_recipes / data.metadata.total_recipes) * 100)}% coverage)
          </div>
        )}
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full max-w-md px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
        />
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Category List */}
        <div className="lg:col-span-1">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <h2 className="text-sm font-medium text-zinc-300">
                Categories ({sortedGroups.length})
              </h2>
            </div>
            <div className="max-h-[calc(100vh-20rem)] overflow-y-auto">
              {sortedGroups.length === 0 ? (
                <div className="px-4 py-8 text-center text-zinc-500">
                  No categories match your search.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {sortedGroups.map((group) => (
                    <button
                      key={group.slug}
                      onClick={() => {
                        setSelectedGroup(group.slug);
                        setExpandedVariation(null);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-zinc-800 transition-colors ${
                        selectedGroup === group.slug
                          ? 'bg-violet-600/20 border-l-2 border-violet-500'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-200 font-medium">
                          {group.canonical_name}
                        </span>
                        <span className="text-sm text-zinc-500">
                          {group.total_count}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        {Object.keys(group.variations).length} variation{Object.keys(group.variations).length !== 1 ? 's' : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Variation Details */}
        <div className="lg:col-span-2">
          {selectedGroupData ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              {/* Group Header */}
              <div className="px-4 py-4 border-b border-zinc-800">
                <h2 className="text-xl font-bold text-zinc-100">
                  {selectedGroupData.canonical_name}
                </h2>
                <p className="text-sm text-zinc-400 mt-1">
                  {selectedGroupData.total_count} recipe{selectedGroupData.total_count !== 1 ? 's' : ''} across {Object.keys(selectedGroupData.variations).length} variation{Object.keys(selectedGroupData.variations).length !== 1 ? 's' : ''}
                </p>
              </div>

              {/* Variations List */}
              <div className="divide-y divide-zinc-800">
                {Object.entries(selectedGroupData.variations)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([slug, variation]) => (
                    <div key={slug}>
                      {/* Variation Header */}
                      <button
                        onClick={() => handleVariationClick(slug, variation)}
                        className={`w-full px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors ${
                          expandedVariation === slug ? 'bg-zinc-800/30' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`transition-transform ${expandedVariation === slug ? 'rotate-90' : ''}`}>
                              ▶
                            </span>
                            <span className="text-zinc-200 font-medium">
                              {variation.name}
                            </span>
                          </div>
                          <span className="text-sm px-2 py-0.5 bg-zinc-700 text-zinc-300 rounded">
                            {variation.count} recipe{variation.count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </button>

                      {/* Expanded Video List */}
                      {expandedVariation === slug && (
                        <div className="px-4 py-3 bg-zinc-950/50">
                          {loadingVideos && variation.video_ids.some((id) => !videoDetails.has(id)) ? (
                            <div className="flex items-center gap-2 text-zinc-400 py-2">
                              <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                              Loading videos...
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {variation.video_ids.map((videoId) => {
                                const video = videoDetails.get(videoId);
                                return (
                                  <Link
                                    key={videoId}
                                    href={`/admin/recipe/${videoId}`}
                                    className="flex gap-3 p-2 bg-zinc-900 border border-zinc-700 rounded-lg hover:border-zinc-600 hover:bg-zinc-800 transition-colors"
                                  >
                                    <div className="w-32 h-20 bg-zinc-800 rounded overflow-hidden flex-shrink-0">
                                      <Image
                                        src={video?.thumbnail || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
                                        alt={video?.title || videoId}
                                        width={128}
                                        height={80}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-zinc-200 line-clamp-2">
                                        {video?.title || videoId}
                                      </div>
                                      {video?.channel_name && (
                                        <div className="text-xs text-zinc-500 mt-1">
                                          {video.channel_name}
                                        </div>
                                      )}
                                    </div>
                                  </Link>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
              <div className="text-zinc-500 mb-2">
                Select a category to see variations
              </div>
              <p className="text-sm text-zinc-600">
                Click on a category in the left panel to explore different approaches to the same dish.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Ungrouped Section */}
      {data && data.ungrouped.count > 0 && (
        <div className="mt-8 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">
            Ungrouped Recipes ({data.ungrouped.count})
          </h3>
          <p className="text-xs text-zinc-500">
            These recipes couldn&apos;t be categorized into existing groups. They include unique dishes or videos that don&apos;t fit standard categories.
          </p>
        </div>
      )}
    </div>
  );
}
