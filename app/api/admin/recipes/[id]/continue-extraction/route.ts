import { NextRequest, NextResponse } from 'next/server';
import { loadVideoMetadata, loadRawVtt } from '@/lib/admin/data/file-io';
import { parseVttToTimestampedText } from '@/lib/admin/data/vtt-parser';
import { extractAllRecipes } from '@/lib/admin/openai/client';
import { DEFAULT_RECIPE_PROMPT } from '@/lib/admin/openai/default-prompt';
import {
  saveNewVersion,
  loadCurrentVersion,
  getAvailableVersionNumbers,
} from '@/lib/admin/data/recipe-versions';
import type { ContinueExtractionRequest, ContinueExtractionResponse } from '@/lib/types/admin';

/**
 * POST /api/admin/recipes/[id]/continue-extraction
 * Continue extracting recipes from a video until all are found.
 * Makes multiple API calls and merges results.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const body = (await request.json()) as ContinueExtractionRequest;

    const prompt = body.prompt || DEFAULT_RECIPE_PROMPT;
    const model = body.model || 'gpt-4o';
    const temperature = body.temperature ?? 0.3;
    const maxIterations = body.maxIterations ?? 10;

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

    // Get existing recipes from current version (if any)
    const currentVersion = await loadCurrentVersion(videoId);
    const existingRecipes = currentVersion?.recipe?.recipes || [];

    console.log(`[Continue Extraction] Starting for ${videoId} with ${existingRecipes.length} existing recipes`);

    // Extract all recipes (continuation loop)
    const { recipes, iterations } = await extractAllRecipes(
      {
        id: metadata.id,
        fulltitle: metadata.fulltitle || metadata.title || videoId,
        description: metadata.description || '',
        webpage_url: metadata.webpage_url || `https://www.youtube.com/watch?v=${videoId}`,
        upload_date: metadata.upload_date || '',
        duration: metadata.duration || 0,
      },
      transcriptText,
      prompt,
      existingRecipes,
      { model, temperature, maxIterations }
    );

    // Save as new version
    const version = await saveNewVersion(videoId, recipes, {
      created_at: new Date().toISOString(),
      prompt_used: prompt,
      model,
      temperature,
      generation_type: 'continuation',
    });

    console.log(`[Continue Extraction] Complete: ${recipes.recipes.length} recipes in ${iterations} iterations`);

    const response: ContinueExtractionResponse = {
      success: true,
      version,
      version_info: {
        version,
        created_at: new Date().toISOString(),
        prompt_used: prompt,
        model,
        temperature,
        generation_type: 'continuation',
      },
      recipe: recipes,
      iterations,
      recipesExtracted: recipes.recipes.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in continue-extraction:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to continue extraction',
      },
      { status: 500 }
    );
  }
}
