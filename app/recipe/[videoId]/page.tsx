import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { RecipeViewerWrapper } from './recipe-viewer-wrapper';
import { getVideoById } from '@/lib/dataLoader';

interface RecipePageProps {
  params: Promise<{ videoId: string }>;
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return 'http://localhost:3000';
}

export async function generateMetadata({ params }: RecipePageProps): Promise<Metadata> {
  const { videoId } = await params;
  const baseUrl = getBaseUrl();
  const ogImageUrl = `${baseUrl}/api/og/recipe/${videoId}`;

  // Skip heavy data loading during Vercel build to avoid OOM
  // Runtime requests will still get full metadata via ISR
  if (process.env.VERCEL && process.env.NEXT_PHASE === 'phase-production-build') {
    return {
      title: 'Recipe',
      openGraph: {
        type: 'article',
        siteName: 'Recipes',
        images: [{ url: ogImageUrl, width: 1200, height: 630 }],
      },
      twitter: {
        card: 'summary_large_image',
        images: [ogImageUrl],
      },
    };
  }

  const video = await getVideoById(videoId);

  if (!video) {
    return { title: 'Recipe Not Found' };
  }

  const recipe = video.recipes?.[0];
  const title = recipe?.title || video.title;

  // Build description with recipe details
  const descriptionParts: string[] = [];
  if (recipe?.description) {
    descriptionParts.push(recipe.description);
  }
  if (recipe?.total_time_minutes) {
    descriptionParts.push(`${recipe.total_time_minutes} min`);
  }
  if (recipe?.servings) {
    descriptionParts.push(`${recipe.servings} servings`);
  }
  if (recipe?.difficulty) {
    descriptionParts.push(recipe.difficulty);
  }
  const description = descriptionParts.length > 0
    ? descriptionParts.join(' • ')
    : `Watch ${video.channelName} make ${title}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Recipes',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

// Enable ISR - revalidate cached pages every hour
export const revalidate = 3600;

// Skip static generation - pages will be generated on-demand and cached via ISR
export function generateStaticParams() {
  return [];
}

export default async function RecipePage({ params }: RecipePageProps) {
  const { videoId } = await params;
  const video = await getVideoById(videoId);

  if (!video) {
    notFound();
  }

  return (
    <RecipeViewerWrapper video={video} />
  );
}
