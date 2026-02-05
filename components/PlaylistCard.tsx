'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Playlist } from '@/lib/types';
import { getBestThumbnail } from '@/lib/utils';

interface PlaylistCardProps {
  playlist: Playlist;
}

export function PlaylistCard({ playlist }: PlaylistCardProps) {
  const thumbnail = getBestThumbnail(playlist.thumbnails);

  return (
    <div className="flex flex-col gap-2">
      <Link href={`/playlist/${playlist.id}`} className="group">
        <div className="relative aspect-video bg-zinc-900 rounded-lg overflow-hidden">
          {thumbnail ? (
            <Image
              src={thumbnail}
              alt={playlist.title}
              width={336}
              height={188}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800">
              <svg
                className="w-12 h-12 text-zinc-600"
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
            </div>
          )}
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
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
      </Link>
      <div className="flex flex-col gap-1">
        <Link href={`/playlist/${playlist.id}`}>
          <h3 className="font-medium line-clamp-2 text-sm leading-tight hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
            {playlist.title}
          </h3>
        </Link>
        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <Link
            href={`/channel/${playlist.channelSlug}`}
            className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            {playlist.channelName}
          </Link>
        </div>
        {playlist.description && (
          <p className="text-xs text-zinc-500 dark:text-zinc-500 line-clamp-2">
            {playlist.description}
          </p>
        )}
      </div>
    </div>
  );
}
