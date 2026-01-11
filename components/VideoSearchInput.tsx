'use client';

import { useState, useEffect, useRef } from 'react';
import type { VideoWithChannel } from '@/lib/types';

interface VideoSearchInputProps {
  onResults: (results: VideoWithChannel[]) => void;
  onLoadingChange: (loading: boolean) => void;
}

export function VideoSearchInput({ onResults, onLoadingChange }: VideoSearchInputProps) {
  const [query, setQuery] = useState('');
  const [hasRecipeOnly, setHasRecipeOnly] = useState(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search effect
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      onResults([]);
      onLoadingChange(false);
      return;
    }

    onLoadingChange(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query });
        if (hasRecipeOnly) {
          params.set('hasRecipe', 'true');
        }
        const res = await fetch(`/api/search?${params}`);
        const data = await res.json();
        onResults(data);
      } catch (err) {
        console.error('Video search failed:', err);
        onResults([]);
      } finally {
        onLoadingChange(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, hasRecipeOnly, onResults, onLoadingChange]);

  return (
    <div className="w-full">
      {/* Search input */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search for recipes, dishes, techniques..."
        className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      />

      {/* Checkbox filter */}
      <label className="flex items-center gap-2 mt-3 cursor-pointer select-none">
        <button
          type="button"
          role="checkbox"
          aria-checked={hasRecipeOnly}
          onClick={() => setHasRecipeOnly(!hasRecipeOnly)}
          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            hasRecipeOnly
              ? 'bg-blue-500 dark:bg-blue-400 border-blue-500 dark:border-blue-400 text-white'
              : 'border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500'
          }`}
        >
          {hasRecipeOnly && (
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
        <span className="text-sm text-zinc-600 dark:text-zinc-400">
          Only show videos with recipes
        </span>
      </label>
    </div>
  );
}
