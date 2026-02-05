import type { Playlist } from '@/lib/types';
import { PlaylistCard } from './PlaylistCard';

interface PlaylistGridProps {
  playlists: Playlist[];
}

export function PlaylistGrid({ playlists }: PlaylistGridProps) {
  if (playlists.length === 0) {
    return (
      <div className="text-center py-16 text-zinc-600 dark:text-zinc-400">
        No playlists found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {playlists.map((playlist) => (
        <PlaylistCard key={playlist.id} playlist={playlist} />
      ))}
    </div>
  );
}
