import { notFound } from 'next/navigation';
import { ChannelViewer } from './channel-viewer';
import { getChannelBySlug } from '@/lib/dataLoader';

interface ChannelPageProps {
  params: Promise<{ channel: string }>;
}

// Enable ISR - revalidate cached pages every hour
export const revalidate = 3600;

// Skip static generation - pages will be generated on-demand and cached via ISR
export function generateStaticParams() {
  return [];
}

export default async function ChannelPage({ params }: ChannelPageProps) {
  const { channel } = await params;
  const channelData = await getChannelBySlug(channel);

  if (!channelData) {
    notFound();
  }

  return <ChannelViewer channel={channelData} />;
}
