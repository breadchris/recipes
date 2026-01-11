import { NextResponse } from 'next/server';
import { getAllVideos } from '@/lib/dataLoader';
import type { CleanedTranscriptSection } from '@/lib/types';

interface RandomSectionResponse {
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  section: CleanedTranscriptSection;
  totalSections: number;
  sectionIndex: number;
}

/**
 * GET /api/random-dan
 * Get a random section from a random "What's Eating Dan?" video
 */
export async function GET() {
  try {
    const videos = await getAllVideos();

    // Filter for Dan videos with cleaned transcripts
    const danVideos = videos.filter((v) => {
      const isDanVideo = /What.*Eating.*Dan/i.test(v.title);
      const hasSections = v.cleaned_transcript?.sections?.length;
      return isDanVideo && hasSections;
    });

    if (danVideos.length === 0) {
      return NextResponse.json(
        { error: 'No Dan videos with cleaned transcripts found' },
        { status: 404 }
      );
    }

    // Pick a random video
    const randomVideoIndex = Math.floor(Math.random() * danVideos.length);
    const video = danVideos[randomVideoIndex];

    // Filter out conclusion sections
    const filteredSections = video.cleaned_transcript!.sections.filter(
      (section) => !section.heading?.toLowerCase().includes('conclusion')
    );

    if (filteredSections.length === 0) {
      return NextResponse.json(
        { error: 'No non-conclusion sections found' },
        { status: 404 }
      );
    }

    // Pick a random section
    const randomSectionIndex = Math.floor(Math.random() * filteredSections.length);
    const section = filteredSections[randomSectionIndex];

    const response: RandomSectionResponse = {
      videoId: video.id,
      videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
      videoTitle: video.title,
      section,
      totalSections: filteredSections.length,
      sectionIndex: randomSectionIndex,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error getting random Dan section:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get random section' },
      { status: 500 }
    );
  }
}
