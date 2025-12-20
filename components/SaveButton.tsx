'use client';

import { useCookbookStore } from '@/lib/stores/cookbook';
import type { VideoWithChannel } from '@/lib/types';

interface SaveButtonProps {
  video: VideoWithChannel;
  className?: string;
  variant?: 'default' | 'compact';
  onSave?: () => void;
}

export default function SaveButton({ video, className = '', variant = 'default', onSave }: SaveButtonProps) {
  const isSaved = useCookbookStore((state) => state.isSaved(video.id));
  const saveVideo = useCookbookStore((state) => state.saveVideo);
  const removeVideo = useCookbookStore((state) => state.removeVideo);

  const handleToggle = () => {
    if (isSaved) {
      removeVideo(video.id);
    } else {
      saveVideo(video);
      onSave?.();
    }
  };

  const isCompact = variant === 'compact';

  return (
    <button
      onClick={handleToggle}
      className={`${isCompact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2'} rounded-lg font-medium transition-colors ${
        isSaved
          ? isCompact
            ? 'border border-green-600 text-green-600 dark:text-green-400 hover:bg-green-600 hover:text-white dark:hover:bg-green-600'
            : 'bg-green-600 hover:bg-green-700 text-white'
          : isCompact
            ? 'border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            : 'bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200'
      } ${className}`}
      aria-label={isSaved ? 'Remove from cookbook' : 'Save to cookbook'}
    >
      {isSaved ? (isCompact ? 'Saved' : 'Saved to Cookbook') : (isCompact ? 'Save' : 'Save to Cookbook')}
    </button>
  );
}
