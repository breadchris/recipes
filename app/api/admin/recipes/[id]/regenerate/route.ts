import { NextRequest, NextResponse } from 'next/server';
import { loadVideoMetadata, loadRawVtt } from '@/lib/admin/data/file-io';
import { parseVttToTimestampedText } from '@/lib/admin/data/vtt-parser';
import { extractRecipeWithAI } from '@/lib/admin/openai/client';
import { DEFAULT_RECIPE_PROMPT } from '@/lib/admin/openai/default-prompt';
import {
  saveNewVersion,
  loadCurrentVersion,
  normalizeRecipe,
  getAvailableVersionNumbers,
} from '@/lib/admin/data/recipe-versions';
import type { RegenerateRequest, RegenerateResponse } from '@/lib/types/admin';

/**
 * POST /api/admin/recipes/[id]/regenerate
 * Regenerate a recipe using AI
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

    // Extract recipe with AI
    const recipe = await extractRecipeWithAI(
      {
        id: metadata.id,
        fulltitle: metadata.fulltitle || metadata.title || videoId,
        description: metadata.description || '',
        webpage_url: metadata.webpage_url || `https://www.youtube.com/watch?v=${videoId}`,
        upload_date: metadata.upload_date || '',
        duration: metadata.duration || 0,
      },
      transcriptText + notesPromptAddition,
      prompt,
      { model, temperature }
    );

    if (!recipe) {
      return NextResponse.json(
        { error: 'No recipe could be extracted from this video' },
        { status: 400 }
      );
    }

    // Save as new version
    const version = await saveNewVersion(videoId, recipe, {
      created_at: new Date().toISOString(),
      prompt_used: prompt,
      model,
      temperature,
      generation_type: 'regenerated',
    });

    const availableVersions = await getAvailableVersionNumbers(videoId);

    const response: RegenerateResponse = {
      success: true,
      version,
      version_info: {
        version,
        created_at: new Date().toISOString(),
        prompt_used: prompt,
        model,
        temperature,
        generation_type: 'regenerated',
      },
      recipe,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error regenerating recipe:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to regenerate recipe',
      },
      { status: 500 }
    );
  }
}
