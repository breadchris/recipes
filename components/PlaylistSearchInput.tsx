'use client';

import { useState, useEffect, useRef } from 'react';
import type { Playlist } from '@/lib/types';

interface PlaylistSearchInputProps {
  onResults: (results: Playlist[]) => void;
  onLoadingChange: (loading: boolean) => void;
}

export function PlaylistSearchInput({ onResults, onLoadingChange }: PlaylistSearchInputProps) {
  const [query, setQuery] = useState('');
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
        const res = await fetch(`/api/playlist-search?${params}`);
        const data = await res.json();
        onResults(data);
      } catch (err) {
        console.error('Playlist search failed:', err);
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
  }, [query, onResults, onLoadingChange]);

  return (
    <div className="w-full">
      {/* Search input */}
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search playlists by name, creator, or topic..."
        className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
      />
      <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
        Search through curated playlists from your favorite cooking channels
      </p>
    </div>
  );
}
