import { notFound } from 'next/navigation';
import { ChannelViewer } from './channel-viewer';
import { getChannelBySlug, getAllChannels } from '@/lib/dataLoader';

interface ChannelPageProps {
  params: Promise<{ channel: string }>;
}

// Enable ISR - revalidate cached pages every hour
export const revalidate = 3600;

// Skip static generation in Vercel builds to avoid OOM
// Channel pages will be generated on-demand and cached via ISR
export async function generateStaticParams() {
  if (process.env.VERCEL) {
    return [];
  }
  const channels = await getAllChannels();
  return channels.map(c => ({ channel: c.channelSlug }));
}

export default async function ChannelPage({ params }: ChannelPageProps) {
  const { channel } = await params;
  const channelData = await getChannelBySlug(channel);

  if (!channelData) {
    notFound();
  }

  return <ChannelViewer channel={channelData} />;
}
