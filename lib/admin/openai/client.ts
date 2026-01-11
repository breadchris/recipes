import OpenAI from 'openai';
import type { VideoRecipes, CleanedTranscript } from '@/lib/types/admin';
import { formatPrompt, SYSTEM_PROMPT } from './default-prompt';
import {
  DEFAULT_CLEAN_TRANSCRIPT_PROMPT,
  CLEAN_TRANSCRIPT_SYSTEM_PROMPT,
} from './clean-transcript-prompt';

/**
 * Video metadata structure for recipe extraction
 */
export interface VideoMetadata {
  id: string;
  fulltitle: string;
  description: string;
  webpage_url: string;
  upload_date: string;
  duration: number;
}

/**
 * Extract structured recipe from transcript using OpenAI GPT-4o
 */
export async function extractRecipeWithAI(
  metadata: VideoMetadata,
  transcriptText: string,
  promptTemplate: string,
  options?: { model?: string; temperature?: number }
): Promise<VideoRecipes | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const client = new OpenAI({ apiKey });

  const model = options?.model || 'gpt-4o';
  const temperature = options?.temperature ?? 0.3;

  // Parse description timestamps and format for prompt
  const timestamps = parseDescriptionTimestamps(metadata.description || '');
  const formattedTimestamps = formatDescriptionTimestamps(timestamps);

  // Format the prompt with metadata
  const prompt = formatPrompt(promptTemplate, {
    title: metadata.fulltitle || 'Unknown',
    video_url: metadata.webpage_url || '',
    video_id: metadata.id,
    upload_date: metadata.upload_date || '',
    description: metadata.description || '',
    transcript: transcriptText,
    description_timestamps: formattedTimestamps,
  });

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature,
      response_format: { type: 'json_object' },
      max_tokens: 16384,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    const recipeJson = JSON.parse(content);

    // Check if video has a recipe
    if (!recipeJson.has_recipe) {
      return null;
    }

    return recipeJson as VideoRecipes;
  } catch (error) {
    console.error('OpenAI API error:', error);
    throw error;
  }
}

/**
 * Generate a cleaned, readable transcript from raw transcript text using AI
 */
export async function generateCleanTranscript(
  transcriptText: string,
  options?: { model?: string; temperature?: number; prompt?: string; description?: string }
): Promise<CleanedTranscript | null> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const client = new OpenAI({ apiKey });

  const model = options?.model || 'gpt-4o';
  const temperature = options?.temperature ?? 0.3;
  const promptTemplate = options?.prompt || DEFAULT_CLEAN_TRANSCRIPT_PROMPT;

  // Parse and format description timestamps if description is provided
  const timestamps = parseDescriptionTimestamps(options?.description || '');
  const formattedTimestamps = formatDescriptionTimestamps(timestamps);

  const prompt = promptTemplate
    .replace('{description_timestamps}', formattedTimestamps)
    .replace('{transcript}', transcriptText);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: CLEAN_TRANSCRIPT_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature,
      response_format: { type: 'json_object' },
      max_tokens: 16384,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    const parsed = JSON.parse(content);

    if (!parsed.sections || !Array.isArray(parsed.sections)) {
      throw new Error('Invalid response format: missing sections array');
    }

    // Transform to CleanedTranscript format
    const cleanedTranscript: CleanedTranscript = {
      sections: parsed.sections.map(
        (
          section: {
            id?: string;
            start_seconds: number;
            end_seconds: number;
            heading?: string;
            text: string;
          },
          index: number
        ) => ({
          id: section.id || `section-${index + 1}`, // Use AI-generated ID or fallback
          startTime: section.start_seconds,
          endTime: section.end_seconds,
          heading: section.heading,
          text: section.text,
        })
      ),
      generated_at: new Date().toISOString(),
      model,
      prompt_used: promptTemplate,
    };

    return cleanedTranscript;
  } catch (error) {
    console.error('OpenAI API error (clean transcript):', error);
    throw error;
  }
}

/**
 * Generate recipe from a cleaned transcript (two-step generation)
 * This uses the cleaned transcript sections as context for more accurate step-to-section mapping,
 * but derives recipe steps from the original transcript for accuracy
 */
export async function generateRecipeFromCleanedTranscript(
  metadata: VideoMetadata,
  cleanedTranscript: CleanedTranscript,
  originalTranscript: string,
  promptTemplate: string,
  options?: { model?: string; temperature?: number }
): Promise<VideoRecipes | null> {
  // Add section context to the prompt
  const sectionContext = `
CLEANED TRANSCRIPT SECTIONS:
The transcript has been organized into the following sections. When extracting recipe steps, reference the appropriate section_id for each step based on timing:

${cleanedTranscript.sections.map((s) => `- ${s.id}: "${s.heading || 'Untitled'}" (${formatSeconds(s.startTime)} - ${formatSeconds(s.endTime)})`).join('\n')}

`;

  // Inject section context before the transcript
  const modifiedPrompt = promptTemplate.replace(
    'Transcript:\n{transcript}',
    `${sectionContext}\nTranscript:\n{transcript}`
  );

  return extractRecipeWithAI(metadata, originalTranscript, modifiedPrompt, options);
}

/**
 * Helper to format seconds as MM:SS
 */
function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parsed timestamp from video description
 */
export interface DescriptionTimestamp {
  seconds: number;
  label: string;
  isRecipe: boolean;
}

/**
 * Parse timestamps from video description into structured data.
 * Handles formats like "00:00 - Label", "1:30 - Label", "1:30:45 - Label"
 */
export function parseDescriptionTimestamps(description: string): DescriptionTimestamp[] {
  // Match patterns like "00:00 - Label", "1:30 - Label", or "1:30:45 - Label"
  // Supports both - and – (en dash)
  const timestampPattern = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*[-–]\s*([^\n]+)/g;
  const matches = [...description.matchAll(timestampPattern)];

  // Patterns for non-recipe entries
  const nonRecipePatterns = /^(intro|outro|final|wheel|conclusion|thanks|subscribe|end|credits|sponsor|music|disclaimer|closing|opening)/i;

  return matches.map(match => {
    const hours = match[3] ? parseInt(match[1], 10) : 0;
    const minutes = match[3] ? parseInt(match[2], 10) : parseInt(match[1], 10);
    const seconds = match[3] ? parseInt(match[3], 10) : parseInt(match[2], 10);
    const label = match[4].trim();

    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    const isRecipe = !nonRecipePatterns.test(label);

    return {
      seconds: totalSeconds,
      label,
      isRecipe,
    };
  });
}

/**
 * Format description timestamps for inclusion in AI prompts
 */
export function formatDescriptionTimestamps(timestamps: DescriptionTimestamp[]): string {
  if (timestamps.length === 0) {
    return 'No timestamps found in video description.';
  }

  const lines = timestamps.map(ts => {
    const mins = Math.floor(ts.seconds / 60);
    const secs = ts.seconds % 60;
    const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
    const suffix = ts.isRecipe ? '' : ' [non-recipe]';
    return `- ${timeStr} (${ts.seconds}s) - ${ts.label}${suffix}`;
  });

  return `The video description indicates these sections:\n${lines.join('\n')}`;
}

/**
 * Estimate the number of recipes in a video based on timestamps in the description.
 * Looks for patterns like "00:00 - Recipe Name" or "1:30 - Recipe Name"
 * Filters out common non-recipe segments like "Intro", "Outro", "Final Meals", etc.
 */
export function estimateRecipeCountFromDescription(description: string): number {
  const timestamps = parseDescriptionTimestamps(description);
  return timestamps.filter(ts => ts.isRecipe).length;
}

/**
 * Continue extracting recipes from a video that has more unextracted recipes.
 * Makes multiple API calls until has_more_recipes is false or max iterations reached.
 */
export async function extractAllRecipes(
  metadata: VideoMetadata,
  transcriptText: string,
  promptTemplate: string,
  existingRecipes: { title: string }[],
  options?: { model?: string; temperature?: number; maxIterations?: number }
): Promise<{ recipes: VideoRecipes; iterations: number }> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  const client = new OpenAI({ apiKey });

  const model = options?.model || 'gpt-4o';
  const temperature = options?.temperature ?? 0.3;
  const maxIterations = options?.maxIterations ?? 10;
  const maxRecipes = 50;

  // Parse and format description timestamps
  const timestamps = parseDescriptionTimestamps(metadata.description || '');
  const formattedTimestamps = formatDescriptionTimestamps(timestamps);

  // Estimate expected recipe count from description timestamps
  const estimatedRecipeCount = timestamps.filter(ts => ts.isRecipe).length;
  if (estimatedRecipeCount > 0) {
    console.log(`[Continuation] Estimated ${estimatedRecipeCount} recipes from description timestamps`);
  }

  // Start with existing recipes
  const allRecipes = [...existingRecipes] as VideoRecipes['recipes'];
  let hasMoreRecipes = true;
  let iterations = 0;

  while (hasMoreRecipes && iterations < maxIterations && allRecipes.length < maxRecipes) {
    iterations++;

    // Build continuation prompt
    const extractedTitles = allRecipes.map((r) => r.title);
    const continuationInstruction = extractedTitles.length > 0
      ? `\n\nALREADY EXTRACTED RECIPES (DO NOT extract these again):\n${extractedTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\nContinue extracting the NEXT recipes from this video that have NOT been extracted yet. Start with recipe #${extractedTitles.length + 1}.\n\nIMPORTANT: Include ALL dishes mentioned in the video, including side dishes (like rice, beans, vegetables), accompaniments, and components. Each distinct dish with its own preparation steps should be a separate recipe. Check the video description for timestamps - each timestamp typically indicates a separate recipe.\n`
      : '';

    // Format the prompt with metadata and continuation instruction
    const prompt = formatPrompt(promptTemplate, {
      title: metadata.fulltitle || 'Unknown',
      video_url: metadata.webpage_url || '',
      video_id: metadata.id,
      upload_date: metadata.upload_date || '',
      description: metadata.description || '',
      transcript: transcriptText,
      description_timestamps: formattedTimestamps,
    }).replace(
      'Transcript:\n',
      `${continuationInstruction}Transcript:\n`
    );

    console.log(`[Continuation] Iteration ${iterations}, extracted so far: ${allRecipes.length}`);

    try {
      const response = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        temperature,
        response_format: { type: 'json_object' },
        max_tokens: 16384,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      const recipeJson = JSON.parse(content) as VideoRecipes;

      // Check if we got any new recipes
      if (!recipeJson.has_recipe || !recipeJson.recipes || recipeJson.recipes.length === 0) {
        console.log(`[Continuation] No new recipes found in iteration ${iterations}`);
        hasMoreRecipes = false;
        break;
      }

      // Filter out duplicates (by title)
      const existingTitlesLower = new Set(allRecipes.map((r) => r.title.toLowerCase()));
      const newRecipes = recipeJson.recipes.filter(
        (r) => !existingTitlesLower.has(r.title.toLowerCase())
      );

      if (newRecipes.length === 0) {
        console.log(`[Continuation] All recipes in iteration ${iterations} were duplicates`);
        hasMoreRecipes = false;
        break;
      }

      console.log(`[Continuation] Found ${newRecipes.length} new recipes in iteration ${iterations}`);
      allRecipes.push(...newRecipes);

      // Check if there are more recipes to extract
      // Override AI's decision if we haven't reached the estimated count from timestamps
      const aiSaysMore = recipeJson.has_more_recipes === true;
      const belowEstimate = estimatedRecipeCount > 0 && allRecipes.length < estimatedRecipeCount;
      hasMoreRecipes = aiSaysMore || belowEstimate;

      if (!aiSaysMore && belowEstimate) {
        console.log(`[Continuation] AI says no more recipes, but only ${allRecipes.length}/${estimatedRecipeCount} extracted - forcing continuation`);
      }

    } catch (error) {
      console.error(`[Continuation] Error in iteration ${iterations}:`, error);
      throw error;
    }
  }

  console.log(`[Continuation] Complete: ${allRecipes.length} total recipes in ${iterations} iterations`);

  // Build final result
  const finalRecipes: VideoRecipes = {
    has_recipe: allRecipes.length > 0,
    has_more_recipes: hasMoreRecipes && allRecipes.length >= maxRecipes,
    video_id: metadata.id,
    video_url: metadata.webpage_url || `https://www.youtube.com/watch?v=${metadata.id}`,
    upload_date: metadata.upload_date || '',
    recipes: allRecipes,
  };

  return { recipes: finalRecipes, iterations };
}
