import { NextRequest, NextResponse } from 'next/server';
import { loadRawVtt, loadVideoMetadata } from '@/lib/admin/data/file-io';
import { parseVttToTimestampedText } from '@/lib/admin/data/vtt-parser';
import { generateCleanTranscript } from '@/lib/admin/openai/client';
import {
  loadCurrentVersion,
  updateCurrentVersion,
} from '@/lib/admin/data/recipe-versions';
import type { CleanedTranscript } from '@/lib/types/admin';

interface CleanTranscriptRequest {
  prompt?: string;
  model?: string;
  temperature?: number;
}

interface CleanTranscriptResponse {
  success: boolean;
  cleaned_transcript?: CleanedTranscript;
  error?: string;
}

/**
 * GET /api/admin/recipes/[id]/clean-transcript
 * Get the existing cleaned transcript for a video
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;

    const currentVersion = await loadCurrentVersion(videoId);
    if (!currentVersion) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    const cleanedTranscript = currentVersion.recipe.cleaned_transcript;

    return NextResponse.json({
      success: true,
      cleaned_transcript: cleanedTranscript || null,
    });
  } catch (error) {
    console.error('Error loading cleaned transcript:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load cleaned transcript',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/recipes/[id]/clean-transcript
 * Generate a cleaned transcript using AI
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const body = (await request.json()) as CleanTranscriptRequest;

    // Load transcript
    const rawVtt = await loadRawVtt(videoId);
    if (!rawVtt) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }

    // Load video metadata to get description for timestamp hints
    const metadata = await loadVideoMetadata(videoId);

    // Parse transcript to timestamped text
    const transcriptText = parseVttToTimestampedText(rawVtt);

    // Generate cleaned transcript with AI
    const cleanedTranscript = await generateCleanTranscript(transcriptText, {
      model: body.model,
      temperature: body.temperature,
      prompt: body.prompt,
      description: metadata?.description,
    });

    if (!cleanedTranscript) {
      return NextResponse.json(
        { error: 'Failed to generate cleaned transcript' },
        { status: 500 }
      );
    }

    // Update the recipe with the cleaned transcript
    const updated = await updateCurrentVersion(videoId, (recipe) => ({
      ...recipe,
      cleaned_transcript: cleanedTranscript,
    }));

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to save cleaned transcript' },
        { status: 500 }
      );
    }

    const response: CleanTranscriptResponse = {
      success: true,
      cleaned_transcript: cleanedTranscript,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error generating cleaned transcript:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate cleaned transcript',
      },
      { status: 500 }
    );
  }
}
