'use client';

import Link from 'next/link';
import Image from 'next/image';
// HIDDEN: cookbook - import { useCookbookStore } from '@/lib/stores/cookbook';
import type { VideoWithChannel } from '@/lib/types';
import { formatDuration, formatViewCount, getBestThumbnail } from '@/lib/utils';

// Extended video type with match data from pantry search
export interface VideoWithMatch extends VideoWithChannel {
  matchScore?: number;
  matchedIngredients?: string[];
  totalIngredients?: number;
  missingIngredients?: string[];
}

interface VideoCardProps {
  video: VideoWithMatch;
  showSavedIndicator?: boolean;
  showMatchBadge?: boolean;
  useRecipeTitle?: boolean;
}

export function VideoCard({ video, showSavedIndicator = false, showMatchBadge = false, useRecipeTitle = false }: VideoCardProps) {
  const thumbnail = getBestThumbnail(video.thumbnails);
  // HIDDEN: cookbook - const isSaved = useCookbookStore((state) => state.isSaved(video.id));

  // Calculate match display
  const hasMatchData = showMatchBadge && video.matchScore !== undefined;
  const matchLabel = hasMatchData
    ? `${video.matchedIngredients?.length || 0}/${video.totalIngredients || 0}`
    : null;

  return (
    <div className="flex flex-col gap-2">
      <Link href={`/recipe/${video.id}`} className="group">
        <div className="relative aspect-video bg-zinc-900 rounded-lg overflow-hidden">
          <Image
            src={thumbnail}
            alt={video.title}
            width={336}
            height={188}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
            {formatDuration(video.duration)}
          </div>
          {/* HIDDEN: cookbook - saved indicator badge
          {showSavedIndicator && isSaved && (
            <div className="absolute top-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded font-medium shadow-lg">
              ✓ Saved
            </div>
          )}
          */}
          {hasMatchData && (
            <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded font-medium shadow-lg flex items-center gap-1">
              <span className="text-blue-200">✓</span>
              <span>{matchLabel} ingredients</span>
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-col gap-1">
        <Link href={`/recipe/${video.id}`}>
          <h3 className="font-medium line-clamp-2 text-sm leading-tight hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
            {useRecipeTitle && video.recipeTitle ? video.recipeTitle : video.title}
          </h3>
        </Link>
        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <Link
            href={`/channel/${video.channelSlug}`}
            className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            {video.channelName}
          </Link>
          <span>{formatViewCount(video.view_count)} views</span>
        </div>
      </div>
    </div>
  );
}
