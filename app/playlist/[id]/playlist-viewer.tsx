'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { VideoPlayer } from '@/components/VideoPlayer';
import { VideoGrid } from '@/components/VideoGrid';
import type { PlaylistWithVideos } from '@/lib/types';
import { getBestThumbnail } from '@/lib/utils';

interface PlaylistViewerProps {
  playlist: PlaylistWithVideos;
}

export function PlaylistViewer({ playlist }: PlaylistViewerProps) {
  const router = useRouter();
  const [endlessPlay, setEndlessPlay] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  const playlistThumbnail = getBestThumbnail(playlist.thumbnails);

  const handleVideoEnd = () => {
    if (endlessPlay && currentVideoIndex < playlist.videos.length - 1) {
      const nextIndex = currentVideoIndex + 1;
      setCurrentVideoIndex(nextIndex);
      // Scroll to top when switching videos
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (endlessPlay) {
      setCurrentVideoIndex(0);
    }
  }, [endlessPlay]);

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 mb-6"
          title="Back"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Playlist Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            {/* Playlist thumbnail */}
            {playlistThumbnail && (
              <div className="relative w-full sm:w-64 aspect-video rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0">
                <Image
                  src={playlistThumbnail}
                  alt={playlist.title}
                  fill
                  className="object-cover"
                  loading="eager"
                />
                <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 10h16M4 14h16M4 18h16"
                    />
                  </svg>
                  {playlist.video_count} videos
                </div>
              </div>
            )}

            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                {playlist.title}
              </h1>
              <Link
                href={`/channel/${playlist.channelSlug}`}
                className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
              >
                {playlist.channelName}
              </Link>
              {playlist.description && (
                <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                  {playlist.description}
                </p>
              )}
              <a
                href={playlist.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-3 text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                View on YouTube
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Endless Play Mode */}
        {endlessPlay && playlist.videos.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                Now Playing: {playlist.videos[currentVideoIndex]?.title}
              </h2>
              <button
                onClick={() => setEndlessPlay(false)}
                className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                Exit Endless Play
              </button>
            </div>
            <VideoPlayer
              videoId={playlist.videos[currentVideoIndex].id}
              onEnded={handleVideoEnd}
              playing
            />
            <div className="flex items-center gap-4 mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              <span>
                Video {currentVideoIndex + 1} of {playlist.videos.length}
              </span>
              {currentVideoIndex > 0 && (
                <button
                  onClick={() => setCurrentVideoIndex(prev => prev - 1)}
                  className="hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Previous
                </button>
              )}
              {currentVideoIndex < playlist.videos.length - 1 && (
                <button
                  onClick={() => setCurrentVideoIndex(prev => prev + 1)}
                  className="hover:text-zinc-900 dark:hover:text-zinc-100"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        )}

        {/* Videos Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
              {playlist.videos.length} Videos
            </h2>
            {!endlessPlay && playlist.videos.length > 0 && (
              <button
                onClick={() => setEndlessPlay(true)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Endless Play Mode
              </button>
            )}
          </div>

          {playlist.videos.length > 0 ? (
            <VideoGrid videos={playlist.videos} />
          ) : (
            <div className="text-center py-12 text-zinc-600 dark:text-zinc-400">
              <p>No videos found in this playlist.</p>
              <p className="text-sm mt-2">The videos may not be available in the database yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
