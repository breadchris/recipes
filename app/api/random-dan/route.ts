import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/clients/supabaseServer';
import type { CleanedTranscriptSection, CleanedTranscript } from '@/lib/types';

const RECIPES_GROUP_ID = '52f7d41b-490e-40d1-b5da-eb1d74ec2eae';

interface RandomSectionResponse {
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  section: CleanedTranscriptSection;
  totalSections: number;
  sectionIndex: number;
}

interface DanVideoRecord {
  metadata: {
    youtube_video_id: string;
    youtube_title: string;
    cleaned_transcript?: CleanedTranscript;
  };
}

/**
 * GET /api/random-dan
 * Get a random section from a random "What's Eating Dan?" video
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Query Supabase directly for "What's Eating Dan" videos with cleaned transcripts
    const { data, error } = await supabase
      .from('content')
      .select('metadata')
      .eq('group_id', RECIPES_GROUP_ID)
      .eq('type', 'text')
      .ilike('metadata->>youtube_title', '%What%Eating%Dan%')
      .not('metadata->cleaned_transcript', 'is', null);

    if (error) {
      console.error('Error querying Supabase:', error);
      return NextResponse.json(
        { error: 'Failed to query videos' },
        { status: 500 }
      );
    }

    // Filter for videos that have sections in their cleaned transcript
    const danVideos = (data as DanVideoRecord[]).filter(
      (record) => record.metadata?.cleaned_transcript?.sections?.length
    );

    if (danVideos.length === 0) {
      return NextResponse.json(
        { error: 'No Dan videos with cleaned transcripts found' },
        { status: 404 }
      );
    }

    // Pick a random video
    const randomVideoIndex = Math.floor(Math.random() * danVideos.length);
    const record = danVideos[randomVideoIndex];
    const { youtube_video_id, youtube_title, cleaned_transcript } = record.metadata;

    // Filter out conclusion sections
    const filteredSections = cleaned_transcript!.sections.filter(
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
      videoId: youtube_video_id,
      videoUrl: `https://www.youtube.com/watch?v=${youtube_video_id}`,
      videoTitle: youtube_title,
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
