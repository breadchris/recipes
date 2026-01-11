'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { VideoWithChannel } from '@/lib/types';
import { VideoGrid } from '@/components/VideoGrid';
// HIDDEN: cookbook - import { useCookbookStore } from '@/lib/stores/cookbook';
import { PantryModeInput } from '@/components/PantryModeInput';
import { VideoSearchInput } from '@/components/VideoSearchInput';
import { TagBrowser } from '@/components/TagBrowser';

type SearchMode = 'tags' | 'pantry' | 'video';

interface PaginationState {
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
}

export function SearchPage() {
  // Mode state - default to tags search
  const [searchMode, setSearchMode] = useState<SearchMode>('tags');

  // Tags mode state
  const [tagResults, setTagResults] = useState<VideoWithChannel[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagPagination, setTagPagination] = useState<PaginationState>({
    hasMore: false,
    isLoadingMore: false,
    loadMore: () => {},
  });

  // Pantry mode state
  const [pantryResults, setPantryResults] = useState<VideoWithChannel[]>([]);
  const [pantryIngredients, setPantryIngredients] = useState<string[]>([]);

  // Video search state
  const [videoResults, setVideoResults] = useState<VideoWithChannel[]>([]);
  const [isVideoSearching, setIsVideoSearching] = useState(false);

  // HIDDEN: cookbook - const savedVideosCount = useCookbookStore((state) => Object.keys(state.savedVideos).length);

  const handleTagResults = useCallback((
    results: VideoWithChannel[],
    tags: string[],
    pagination: PaginationState
  ) => {
    setTagResults(results);
    setSelectedTags(tags);
    setTagPagination(pagination);
  }, []);

  const handlePantryResults = useCallback((results: VideoWithChannel[], ingredients: string[]) => {
    setPantryResults(results);
    setPantryIngredients(ingredients);
  }, []);

  const handleVideoResults = useCallback((results: VideoWithChannel[]) => {
    setVideoResults(results);
  }, []);

  const handleVideoLoadingChange = useCallback((loading: boolean) => {
    setIsVideoSearching(loading);
  }, []);

  // Determine which results to show based on mode
  const currentResults = searchMode === 'tags'
    ? tagResults
    : searchMode === 'pantry'
      ? pantryResults
      : videoResults;
  const hasResults = currentResults.length > 0;

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
      {/* Centered search section */}
      <div className={`flex flex-col items-center justify-center transition-all duration-300 ${
        hasResults ? 'min-h-0 py-8' : 'min-h-screen'
      }`}>
        <div className="w-full max-w-2xl px-4">
          {/* About link */}
          <div className="mt-4 mb-4 md:absolute md:top-4 md:right-4 md:mt-0 md:mb-0 md:z-10 flex justify-end">
            <Link
              href="/about"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              About
            </Link>
          </div>

          {/* Header and mode switcher */}
          <div>
            <h1 className="text-2xl font-medium text-zinc-900 dark:text-zinc-100 text-center mb-2">
              {searchMode === 'tags'
                ? 'Browse by Category'
                : searchMode === 'pantry'
                  ? 'Use What I Have'
                  : 'Search Videos'}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center mb-2">
              {searchMode === 'tags'
                ? 'Find recipes by cuisine, protein, technique, and more'
                : searchMode === 'pantry'
                  ? 'Add ingredients you have and find matching recipes'
                  : 'Search for recipes by name, dish, or technique'}
            </p>

            {/* Mode switcher - subtle text links */}
            <div className="text-center mb-6 flex justify-center gap-3">
              {searchMode !== 'tags' && (
                <button
                  onClick={() => setSearchMode('tags')}
                  className="text-xs text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors underline underline-offset-2"
                >
                  browse by category
                </button>
              )}
              {searchMode !== 'pantry' && (
                <button
                  onClick={() => setSearchMode('pantry')}
                  className="text-xs text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors underline underline-offset-2"
                >
                  search by ingredients
                </button>
              )}
              {searchMode !== 'video' && (
                <button
                  onClick={() => setSearchMode('video')}
                  className="text-xs text-zinc-500 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors underline underline-offset-2"
                >
                  search by video title
                </button>
              )}
            </div>

            {/* Conditional input based on mode */}
            {searchMode === 'tags' ? (
              <TagBrowser onResults={handleTagResults} />
            ) : searchMode === 'pantry' ? (
              <PantryModeInput onResults={handlePantryResults} />
            ) : (
              <VideoSearchInput
                onResults={handleVideoResults}
                onLoadingChange={handleVideoLoadingChange}
              />
            )}
          </div>
        </div>
      </div>

      {/* Loading state for video search */}
      {searchMode === 'video' && isVideoSearching && !hasResults && (
        <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
          Searching...
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <div className="w-full max-w-7xl mx-auto px-4 pb-12">
          <VideoGrid
            videos={currentResults}
            showMatchBadge={searchMode === 'pantry'}
            userIngredients={searchMode === 'pantry' ? pantryIngredients : undefined}
            useRecipeTitle={searchMode !== 'video'}
          />

          {/* Load more button for tags mode */}
          {searchMode === 'tags' && tagPagination.hasMore && (
            <div className="flex justify-center mt-8">
              <button
                onClick={tagPagination.loadMore}
                disabled={tagPagination.isLoadingMore}
                className="px-6 py-2 text-sm font-medium rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {tagPagination.isLoadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
