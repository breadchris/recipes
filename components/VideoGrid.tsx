import type { VideoWithChannel } from '@/lib/types';
import { VideoCard } from './VideoCard';

interface VideoGridProps {
  videos: VideoWithChannel[];
  showSavedIndicator?: boolean;
}

export function VideoGrid({ videos, showSavedIndicator = false }: VideoGridProps) {
  if (videos.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-600 dark:text-zinc-400">
        No videos found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} showSavedIndicator={showSavedIndicator} />
      ))}
    </div>
  );
}
