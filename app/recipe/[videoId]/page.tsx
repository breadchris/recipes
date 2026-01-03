import { notFound } from 'next/navigation';
import { RecipeViewer } from './recipe-viewer';
import { getVideoById, getChannelBySlug, getAllVideos } from '@/lib/dataLoader';

interface RecipePageProps {
  params: Promise<{ videoId: string }>;
}

// Enable ISR - revalidate cached pages every hour
export const revalidate = 3600;

// Pre-generate top 500 recipes with the most views at build time
export async function generateStaticParams() {
  const videos = await getAllVideos();
  const topVideos = videos
    .filter(v => v.recipes?.length)
    .sort((a, b) => b.view_count - a.view_count)
    .slice(0, 500);
  return topVideos.map(v => ({ videoId: v.id }));
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { videoId } = await params;
  const video = await getVideoById(videoId);

  if (!video) {
    notFound();
  }

  // Only load the channel this video belongs to (using slug for filename lookup)
  const channel = await getChannelBySlug(video.channelSlug);
  if (!channel) {
    notFound();
  }

  const channelVideos = channel.entries.map(v => ({
    ...v,
    channelName: channel.channel,
    channelFollowers: channel.channel_follower_count,
  }));

  const currentIndex = channelVideos.findIndex(v => v.id === videoId);
  const previousVideo = currentIndex > 0 ? channelVideos[currentIndex - 1] : null;
  const nextVideo = currentIndex < channelVideos.length - 1 ? channelVideos[currentIndex + 1] : null;

  return (
    <RecipeViewer
      video={video}
      previousVideo={previousVideo}
      nextVideo={nextVideo}
    />
  );
}
