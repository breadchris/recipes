'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useCookbookStore } from '@/lib/stores/cookbook';
import { VideoGrid } from '@/components/VideoGrid';
import type { VideoWithChannel } from '@/lib/types';

export default function CookbookClient() {
  const savedVideosRecord = useCookbookStore((state) => state.savedVideos);
  const exportCookbook = useCookbookStore((state) => state.exportCookbook);
  const importCookbook = useCookbookStore((state) => state.importCookbook);
  const clearCookbook = useCookbookStore((state) => state.clearCookbook);

  const [searchQuery, setSearchQuery] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowActionsMenu(false);
      }
    };

    if (showActionsMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showActionsMenu]);

  // Convert savedVideos object to sorted array
  const savedVideos = useMemo(() => {
    return Object.values(savedVideosRecord).sort((a, b) => b.savedAt - a.savedAt);
  }, [savedVideosRecord]);

  // Filter saved videos based on search query
  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) {
      return savedVideos;
    }

    const query = searchQuery.toLowerCase();
    return savedVideos.filter(
      ({ video, notes }) =>
        video.title.toLowerCase().includes(query) ||
        video.description.toLowerCase().includes(query) ||
        video.channelName.toLowerCase().includes(query) ||
        notes.toLowerCase().includes(query)
    );
  }, [savedVideos, searchQuery]);

  const handleExport = () => {
    const jsonString = exportCookbook();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cookbook-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      setImportError('');
      importCookbook(importText);
      setShowImport(false);
      setImportText('');
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Invalid cookbook format');
    }
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear your entire cookbook? This cannot be undone.')) {
      clearCookbook();
    }
  };

  const videos: VideoWithChannel[] = filteredVideos.map((sv) => sv.video);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-6"
        >
          ← Back to search
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">My Cookbook</h1>
          <p className="text-gray-600 dark:text-gray-400">
            {savedVideos.length} {savedVideos.length === 1 ? 'recipe' : 'recipes'} saved
          </p>
        </div>

        {/* Search and Actions */}
        <div className="mb-6 space-y-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search saved recipes, notes, or channels..."
            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {/* Actions Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowActionsMenu(!showActionsMenu)}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium text-sm flex items-center gap-2"
            >
              <span>Manage</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showActionsMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 py-1 z-20">
                <button
                  onClick={() => {
                    handleExport();
                    setShowActionsMenu(false);
                  }}
                  disabled={savedVideos.length === 0}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Cookbook
                </button>
                <button
                  onClick={() => {
                    setShowImport(!showImport);
                    setShowActionsMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  {showImport ? 'Cancel Import' : 'Import Cookbook'}
                </button>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                <button
                  onClick={() => {
                    handleClear();
                    setShowActionsMenu(false);
                  }}
                  disabled={savedVideos.length === 0}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* Import Section */}
          {showImport && (
            <div className="p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Paste your cookbook JSON below:
              </label>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder='{"savedVideos": {...}, "version": "1.0"}'
                className="w-full min-h-[150px] p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm"
              />
              {importError && (
                <p className="text-red-600 dark:text-red-400 text-sm">{importError}</p>
              )}
              <button
                onClick={handleImport}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium transition-colors"
              >
                Import
              </button>
            </div>
          )}
        </div>

        {/* Results */}
        {searchQuery && filteredVideos.length > 0 && (
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            Found {filteredVideos.length} {filteredVideos.length === 1 ? 'result' : 'results'}
          </p>
        )}

        {savedVideos.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📖</div>
            <h2 className="text-2xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
              Your cookbook is empty
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Start saving recipes by clicking the "Save to Cookbook" button on any recipe page
            </p>
            <a
              href="/"
              className="inline-block px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
            >
              Browse Recipes
            </a>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-2xl font-semibold mb-2 text-gray-800 dark:text-gray-200">
              No results found
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Try a different search term
            </p>
          </div>
        ) : (
          <VideoGrid videos={videos} showSavedIndicator={true} />
        )}
      </div>
    </div>
  );
}
