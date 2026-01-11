import { NextRequest, NextResponse } from 'next/server';
import { loadVideoMetadata, loadRawVtt } from '@/lib/admin/data/file-io';
import { parseVttToTimestampedText } from '@/lib/admin/data/vtt-parser';
import {
  generateCleanTranscript,
  generateRecipeFromCleanedTranscript,
} from '@/lib/admin/openai/client';
import { DEFAULT_RECIPE_PROMPT } from '@/lib/admin/openai/default-prompt';
import {
  saveNewVersion,
  loadCurrentVersion,
  normalizeRecipe,
} from '@/lib/admin/data/recipe-versions';
import type { RegenerateRequest, TwoStageRegenerateResponse } from '@/lib/types/admin';

/**
 * POST /api/admin/recipes/[id]/regenerate-2stage
 * Regenerate a recipe using the 2-stage process:
 * 1. Generate cleaned transcript with section IDs
 * 2. Generate recipe with section_id references
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const body = (await request.json()) as RegenerateRequest;

    const prompt = body.prompt || DEFAULT_RECIPE_PROMPT;
    const model = body.model || 'gpt-4o';
    const temperature = body.temperature ?? 0.3;

    // Load video metadata
    const metadata = await loadVideoMetadata(videoId);
    if (!metadata) {
      return NextResponse.json(
        { error: 'Video metadata not found' },
        { status: 404 }
      );
    }

    // Load transcript
    const rawVtt = await loadRawVtt(videoId);
    if (!rawVtt) {
      return NextResponse.json(
        { error: 'Transcript not found' },
        { status: 404 }
      );
    }

    // Parse transcript to timestamped text
    const transcriptText = parseVttToTimestampedText(rawVtt);

    // Get step notes from current version to include in prompt
    const currentVersion = await loadCurrentVersion(videoId);
    let notesPromptAddition = '';

    if (currentVersion) {
      const normalized = normalizeRecipe(currentVersion.recipe);
      const notes: string[] = [];

      for (const recipe of normalized.recipes) {
        if (!recipe.instructions) continue;
        for (const instruction of recipe.instructions) {
          if (instruction.notes) {
            notes.push(`Step ${instruction.step}: ${instruction.notes}`);
          }
        }
      }

      if (notes.length > 0) {
        notesPromptAddition = `\n\nIMPORTANT NOTES FROM MANUAL REVIEW:\n${notes.join('\n')}\nPlease incorporate these corrections in the regenerated recipe.`;
      }
    }

    // Stage 1: Generate cleaned transcript with section IDs
    const cleanedTranscript = await generateCleanTranscript(transcriptText, {
      model,
      temperature,
      description: metadata.description,
    });

    if (!cleanedTranscript) {
      return NextResponse.json(
        { error: 'Failed to generate cleaned transcript' },
        { status: 500 }
      );
    }

    // Stage 2: Generate recipe from cleaned transcript with section_id references
    const videoMetadata = {
      id: metadata.id,
      fulltitle: metadata.fulltitle || metadata.title || videoId,
      description: metadata.description || '',
      webpage_url: metadata.webpage_url || `https://www.youtube.com/watch?v=${videoId}`,
      upload_date: metadata.upload_date || '',
      duration: metadata.duration || 0,
    };

    // Append notes to the prompt if available
    const finalPrompt = notesPromptAddition
      ? prompt + notesPromptAddition
      : prompt;

    const recipe = await generateRecipeFromCleanedTranscript(
      videoMetadata,
      cleanedTranscript,
      transcriptText,
      finalPrompt,
      { model, temperature }
    );

    if (!recipe) {
      return NextResponse.json(
        { error: 'No recipe could be extracted from this video' },
        { status: 400 }
      );
    }

    // Attach the cleaned transcript to the recipe
    recipe.cleaned_transcript = cleanedTranscript;

    // Save as new version
    const version = await saveNewVersion(videoId, recipe, {
      created_at: new Date().toISOString(),
      prompt_used: prompt,
      model,
      temperature,
      generation_type: 'regenerated-2stage',
    });

    const response: TwoStageRegenerateResponse = {
      success: true,
      version,
      version_info: {
        version,
        created_at: new Date().toISOString(),
        prompt_used: prompt,
        model,
        temperature,
        generation_type: 'regenerated-2stage',
      },
      recipe,
      cleaned_transcript: cleanedTranscript,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in 2-stage regeneration:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to regenerate recipe',
      },
      { status: 500 }
    );
  }
}
