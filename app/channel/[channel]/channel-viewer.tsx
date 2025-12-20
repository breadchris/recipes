'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import { VideoPlayer } from '@/components/VideoPlayer';
import { VideoGrid } from '@/components/VideoGrid';
import type { Channel, VideoWithChannel } from '@/lib/types';
import { formatViewCount, getBestThumbnail } from '@/lib/utils';

interface ChannelViewerProps {
  channel: Channel;
}

export function ChannelViewer({ channel }: ChannelViewerProps) {
  const router = useRouter();
  const [endlessPlay, setEndlessPlay] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  const channelBanner = channel.thumbnails.find(t => t.id.includes('banner'))?.url;
  const channelAvatar = channel.thumbnails.find(t => t.id.includes('avatar'))?.url;

  const videosWithChannel: VideoWithChannel[] = channel.entries.map(video => ({
    ...video,
    channelName: channel.channel,
    channelFollowers: channel.channel_follower_count,
  }));

  const handleVideoEnd = () => {
    if (endlessPlay && currentVideoIndex < channel.entries.length - 1) {
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
          title="Back to search"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to search
        </button>

        {/* Channel Header */}
        <div className="mb-8">
          {channelBanner && (
            <div className="w-full h-32 sm:h-48 rounded-lg overflow-hidden mb-4 relative">
              <Image
                src={channelBanner}
                alt={`${channel.channel} banner`}
                fill
                className="object-cover"
                loading="lazy"
              />
            </div>
          )}

          <div className="flex items-start gap-4">
            {channelAvatar && (
              <div className="relative w-20 h-20">
                <Image
                  src={channelAvatar}
                  alt={channel.channel}
                  width={80}
                  height={80}
                  className="rounded-full"
                  loading="lazy"
                />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                {channel.channel}
              </h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                {formatViewCount(channel.channel_follower_count)} subscribers • {channel.entries.length} videos
              </p>
              {channel.description && (
                <div className="text-sm text-zinc-700 dark:text-zinc-300 prose prose-sm dark:prose-invert max-w-none prose-headings:text-zinc-900 dark:prose-headings:text-zinc-50 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-strong:text-zinc-900 dark:prose-strong:text-zinc-50 prose-code:text-zinc-900 dark:prose-code:text-zinc-50">
                  <ReactMarkdown>
                    {channel.description}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Endless Play Toggle */}
        <div className="mb-8 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4">
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-50 mb-1">
              Endless Play Mode
            </h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Auto-play videos from this channel sequentially
            </p>
          </div>
          <button
            onClick={() => setEndlessPlay(!endlessPlay)}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              endlessPlay
                ? 'bg-zinc-900 dark:bg-zinc-50 text-white dark:text-black'
                : 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 border border-zinc-300 dark:border-zinc-700'
            }`}
          >
            {endlessPlay ? 'Stop' : 'Start'}
          </button>
        </div>

        {/* Current Video Player (when endless play is on) */}
        {endlessPlay && (
          <div className="mb-8">
            <VideoPlayer
              videoId={channel.entries[currentVideoIndex].id}
              onEnded={handleVideoEnd}
              playing={true}
            />
            <div className="mt-4">
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">
                Now Playing ({currentVideoIndex + 1} of {channel.entries.length})
              </h2>
              <h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
                {channel.entries[currentVideoIndex].title}
              </h3>
              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => {
                    if (currentVideoIndex > 0) {
                      setCurrentVideoIndex(currentVideoIndex - 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  disabled={currentVideoIndex === 0}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 border border-zinc-300 dark:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => {
                    if (currentVideoIndex < channel.entries.length - 1) {
                      setCurrentVideoIndex(currentVideoIndex + 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  disabled={currentVideoIndex === channel.entries.length - 1}
                  className="px-4 py-2 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 border border-zinc-300 dark:border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* All Videos Grid */}
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-6">
            All Videos
          </h2>
          <VideoGrid videos={videosWithChannel} />
        </div>
      </div>
    </div>
  );
}
