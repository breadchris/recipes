import { notFound, redirect } from 'next/navigation';
import { getWikiData, getAllWikiPagePaths } from '@/lib/wiki/wikiLoader';
import { WikiViewer } from './wiki-viewer';

interface WikiPageProps {
  params: Promise<{ path?: string[] }>;
}

// Wiki ID configured via environment variable
const WIKI_ID = process.env.WIKI_ID || '';

// Enable ISR - revalidate cached pages every hour
export const revalidate = 3600;

// Pre-generate all wiki pages at build time
export async function generateStaticParams() {
  if (!WIKI_ID) return [];

  const paths = await getAllWikiPagePaths(WIKI_ID);
  return paths.map((pagePath) => ({
    path: pagePath.split('/'),
  }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: WikiPageProps) {
  const { path } = await params;
  const pagePath = path?.join('/') || 'index';

  if (!WIKI_ID) {
    return { title: 'Wiki' };
  }

  const wikiData = await getWikiData(WIKI_ID);
  const page = wikiData?.pages.get(pagePath);

  return {
    title: page?.title ? `${page.title} | Wiki` : 'Wiki',
    description: page?.title ? `${page.title} - Wiki documentation` : 'Wiki documentation',
  };
}

export default async function WikiPage({ params }: WikiPageProps) {
  const { path } = await params;

  // Redirect /wiki to /wiki/index
  if (!path || path.length === 0) {
    redirect('/wiki/index');
  }

  const pagePath = path.join('/');

  if (!WIKI_ID) {
    console.error('WIKI_ID environment variable not configured');
    notFound();
  }

  const wikiData = await getWikiData(WIKI_ID);
  if (!wikiData) {
    notFound();
  }

  const page = wikiData.pages.get(pagePath);
  if (!page) {
    notFound();
  }

  return (
    <WikiViewer
      page={page}
      pageTree={wikiData.pageTree}
      wikiTitle={wikiData.metadata.wiki_title}
      currentPath={pagePath}
    />
  );
}
