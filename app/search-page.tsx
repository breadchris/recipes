'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import type { VideoWithChannel } from '@/lib/types';
import { VideoGrid } from '@/components/VideoGrid';
import { VideoCard } from '@/components/VideoCard';
import { useCookbookStore } from '@/lib/stores/cookbook';

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snacks',
  dinner: 'Dinner',
  dessert: 'Desserts'
};

export function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [searchResults, setSearchResults] = useState<VideoWithChannel[]>([]);
  const [suggestions, setSuggestions] = useState<VideoWithChannel[]>([]);
  const [mealType, setMealType] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [hasRecipeOnly, setHasRecipeOnly] = useState(searchParams.get('hasRecipe') !== 'false');
  const savedVideosCount = useCookbookStore((state) => Object.keys(state.savedVideos).length);

  // Fetch suggestions on mount based on user's local time
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const hour = new Date().getHours();
        const response = await fetch(`/api/suggestions?hour=${hour}`);
        const data = await response.json();
        setSuggestions(data.suggestions);
        setMealType(data.mealType);
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
      } finally {
        setIsLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, []);

  // Debounced search and URL sync
  useEffect(() => {
    // Update URL params
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set('q', searchQuery.trim());
    if (!hasRecipeOnly) params.set('hasRecipe', 'false');
    const newUrl = params.toString() ? `/?${params}` : '/';
    router.replace(newUrl, { scroll: false });

    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(async () => {
      try {
        const apiParams = new URLSearchParams({ q: searchQuery });
        if (hasRecipeOnly) {
          apiParams.set('hasRecipe', 'true');
        }
        const response = await fetch(`/api/search?${apiParams}`);
        const data = await response.json();
        setSearchResults(data);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, hasRecipeOnly, router]);

  const handleSuggestionClick = (suggestion: VideoWithChannel) => {
    router.push(`/recipe/${suggestion.id}`);
  };

  const showSuggestions = !searchQuery.trim() && suggestions.length > 0;
  const showResults = searchQuery.trim().length > 0;

  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col">
      {/* Centered search section */}
      <div className={`flex flex-col items-center justify-center transition-all duration-300 ${
        showResults ? 'min-h-0 py-8' : 'min-h-screen'
      }`}>
        <div className="w-full max-w-2xl px-4">
          {/* Cookbook link - subtle styling, below search on mobile, top-right on desktop */}
          <div className="mt-4 mb-4 md:absolute md:top-4 md:right-4 md:mt-0 md:mb-0 md:z-10 flex justify-end">
            <Link
              href="/cookbook"
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              My Cookbook
              {savedVideosCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-xs">
                  {savedVideosCount}
                </span>
              )}
            </Link>
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Search recipes, channels..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-6 py-4 text-lg rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
              >
                ✕
              </button>
            )}
          </div>

          <button
            onClick={() => setHasRecipeOnly(!hasRecipeOnly)}
            className={`mt-3 px-3 py-1 text-xs rounded-full transition-colors ${
              hasRecipeOnly
                ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Has recipe
          </button>

          {isSearching && (
            <p className="mt-3 text-sm text-center text-zinc-600 dark:text-zinc-400">
              Searching...
            </p>
          )}

          {showResults && !isSearching && (
            <p className="mt-3 text-sm text-center text-zinc-600 dark:text-zinc-400">
              {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
            </p>
          )}
        </div>

        {/* Meal suggestions */}
        {showSuggestions && (
          <div className="w-full max-w-6xl px-4 mt-12">
            {isLoadingSuggestions ? (
              <p className="text-center text-zinc-600 dark:text-zinc-400">
                Loading suggestions...
              </p>
            ) : (
              <>
                <h2 className="text-center text-xl font-medium text-zinc-900 dark:text-zinc-50 mb-6">
                  {MEAL_TYPE_LABELS[mealType] || 'Suggested for you'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {suggestions.map((video) => (
                    <div
                      key={video.id}
                      onClick={() => handleSuggestionClick(video)}
                      className="cursor-pointer"
                    >
                      <VideoCard video={video} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Search results */}
      {showResults && (
        <div className="w-full max-w-7xl mx-auto px-4 pb-12">
          <VideoGrid videos={searchResults} />
        </div>
      )}
    </div>
  );
}
