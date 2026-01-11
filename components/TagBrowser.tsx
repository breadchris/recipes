'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { VideoWithChannel } from '@/lib/types';
import type { TagTaxonomy } from '@/lib/types/tags';

const PAGE_SIZE = 24;

interface TagBrowserProps {
  onResults: (
    results: VideoWithChannel[],
    selectedTags: string[],
    pagination: { hasMore: boolean; isLoadingMore: boolean; loadMore: () => void }
  ) => void;
}

export function TagBrowser({ onResults }: TagBrowserProps) {
  const [taxonomy, setTaxonomy] = useState<TagTaxonomy | null>(null);
  const [tagStats, setTagStats] = useState<Record<string, number>>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [categoriesExpanded, setCategoriesExpanded] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [accumulatedResults, setAccumulatedResults] = useState<VideoWithChannel[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Use refs to track current state for the loadMore callback
  const stateRef = useRef({ offset, accumulatedResults, hasMore, isLoadingMore, selectedTags });
  stateRef.current = { offset, accumulatedResults, hasMore, isLoadingMore, selectedTags };

  // Fetch taxonomy and stats on mount
  useEffect(() => {
    Promise.all([
      fetch('/api/tags').then(r => r.json()),
      fetch('/api/tags/stats').then(r => r.json())
    ]).then(([tax, stats]) => {
      setTaxonomy(tax);
      setTagStats(stats.tagStats || {});
    }).catch(err => {
      console.error('Failed to load tag data:', err);
    });
  }, []);

  // Stable loadMore handler that reads from ref
  const loadMore = useCallback(() => {
    const { offset: currentOffset, accumulatedResults: currentResults, hasMore: canLoadMore, isLoadingMore: loading, selectedTags: tags } = stateRef.current;

    if (loading || !canLoadMore || tags.length === 0) return;

    setIsLoadingMore(true);
    const newOffset = currentOffset + PAGE_SIZE;
    const searchParams = new URLSearchParams();
    searchParams.set('tags', tags.join(','));
    searchParams.set('limit', String(PAGE_SIZE));
    searchParams.set('offset', String(newOffset));

    fetch(`/api/browse?${searchParams}`)
      .then((res) => res.json())
      .then((data) => {
        const newResults = data || [];
        const combined = [...currentResults, ...newResults];
        setAccumulatedResults(combined);
        setOffset(newOffset);
        const moreAvailable = newResults.length === PAGE_SIZE;
        setHasMore(moreAvailable);
        onResults(combined, tags, {
          hasMore: moreAvailable,
          isLoadingMore: false,
          loadMore,
        });
      })
      .catch((err) => {
        console.error('Load more failed:', err);
      })
      .finally(() => setIsLoadingMore(false));
  }, [onResults]);

  // Search for matching recipes when selected tags change
  useEffect(() => {
    if (selectedTags.length === 0) {
      setAccumulatedResults([]);
      setOffset(0);
      setHasMore(false);
      onResults([], [], { hasMore: false, isLoadingMore: false, loadMore: () => {} });
      return;
    }

    setIsSearching(true);
    setOffset(0);
    const searchParams = new URLSearchParams();
    searchParams.set('tags', selectedTags.join(','));
    searchParams.set('limit', String(PAGE_SIZE));
    searchParams.set('offset', '0');

    fetch(`/api/browse?${searchParams}`)
      .then((res) => res.json())
      .then((data) => {
        const results = data || [];
        setAccumulatedResults(results);
        const moreAvailable = results.length === PAGE_SIZE;
        setHasMore(moreAvailable);
        onResults(results, selectedTags, {
          hasMore: moreAvailable,
          isLoadingMore: false,
          loadMore,
        });
      })
      .catch((err) => {
        console.error('Tag search failed:', err);
        setAccumulatedResults([]);
        setHasMore(false);
        onResults([], selectedTags, { hasMore: false, isLoadingMore: false, loadMore: () => {} });
      })
      .finally(() => setIsSearching(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTags.join(',')]);

  // Get tag name by ID
  const getTagName = useCallback((tagId: string): string => {
    if (!taxonomy) return tagId;
    for (const category of Object.values(taxonomy.categories)) {
      const tag = category.tags.find(t => t.id === tagId);
      if (tag) return tag.name;
    }
    return tagId;
  }, [taxonomy]);

  // Toggle tag selection
  const toggleTag = useCallback((tagId: string) => {
    setSelectedTags(prev => {
      const isRemoving = prev.includes(tagId);
      if (!isRemoving) {
        // Collapse categories when adding a tag
        setCategoriesExpanded(false);
      }
      return isRemoving
        ? prev.filter(t => t !== tagId)
        : [...prev, tagId];
    });
  }, []);

  // Remove tag
  const removeTag = (tagId: string) => {
    setSelectedTags(prev => prev.filter(t => t !== tagId));
  };

  if (!taxonomy) {
    return (
      <div className="text-center py-4 text-zinc-500 dark:text-zinc-400">
        Loading categories...
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Selected tags */}
      <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
        {selectedTags.map((tagId) => (
          <span
            key={tagId}
            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded-full text-sm"
          >
            {getTagName(tagId)}
            <button
              onClick={() => removeTag(tagId)}
              className="ml-1 hover:text-blue-600 dark:hover:text-blue-300"
            >
              x
            </button>
          </span>
        ))}
        {isSearching && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400 py-1">
            Searching...
          </span>
        )}
      </div>

      {/* Category browser */}
      {!categoriesExpanded ? (
        <button
          onClick={() => setCategoriesExpanded(true)}
          className="px-3 py-1 text-sm rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
        >
          Show categories
        </button>
      ) : (
        <div className="space-y-6">
          {Object.entries(taxonomy.categories).map(([categoryId, category]) => {
            // Filter out tags with 0 count
            const activeTags = category.tags.filter(tag => (tagStats[tag.id] || 0) > 0);
            if (activeTags.length === 0) return null;

            return (
              <div key={categoryId}>
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  {category.displayName}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {activeTags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`px-3 py-1 text-sm rounded-full transition-colors ${
                        selectedTags.includes(tag.id)
                          ? 'bg-blue-500 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
