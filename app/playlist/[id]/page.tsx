import { notFound } from 'next/navigation';
import { PlaylistViewer } from './playlist-viewer';
import { getPlaylistWithVideos, getAllPlaylists } from '@/lib/dataLoader';

interface PlaylistPageProps {
  params: Promise<{ id: string }>;
}

// Enable ISR - revalidate cached pages every hour
export const revalidate = 3600;

// Skip static generation in Vercel builds to avoid OOM
// Playlist pages will be generated on-demand and cached via ISR
export async function generateStaticParams() {
  if (process.env.VERCEL) {
    return [];
  }
  const playlists = await getAllPlaylists();
  return playlists.map(p => ({ id: p.id }));
}

export default async function PlaylistPage({ params }: PlaylistPageProps) {
  const { id } = await params;
  const playlist = await getPlaylistWithVideos(id);

  if (!playlist) {
    notFound();
  }

  return <PlaylistViewer playlist={playlist} />;
}
