/**
 * Prompt for cleaning/formatting video transcripts.
 * This transforms raw auto-generated captions into
 * an engaging, readable narrative for home cooks.
 */
export const DEFAULT_CLEAN_TRANSCRIPT_PROMPT = `Make this transcript engaging for a home cook. Keep the tone and words as close as possible to the original text, and only aim to organize the transcript so that it is legible to someone reading. Maintain all parts of speech the same (tone/audience).

After each section, include timestamps for where the section maps to in the video.

The transcript includes timestamps in [MM:SS] format. Use these to determine the start and end times for each section.

Description Timestamps:
{description_timestamps}

Use these description timestamps as hints for section boundaries - align your section breaks to match the recipe/topic transitions indicated by these timestamps when possible.

TIMESTAMP RULES:
- start_seconds and end_seconds MUST correspond to actual [MM:SS] timestamps in the transcript
- Do NOT interpolate or guess timestamps - only use times that appear in the transcript
- Each section's start_seconds should match the first [MM:SS] marker in that section's content
- Each section's end_seconds should match the last [MM:SS] marker before the next section begins
- If a section boundary falls between timestamps, use the nearest actual timestamp

IMPORTANT RULES:
1. Organize into logical sections (intro, prep, cooking steps, etc.)
2. Keep the speaker's original voice and personality
3. Each section should be roughly 30-120 seconds of video content
4. Section boundaries should align with natural topic transitions
5. Clean up filler words and false starts, but preserve meaning
6. Make it feel like reading along while watching the video

OUTPUT FORMAT (JSON only, no markdown):
{
  "sections": [
    {
      "id": "section-1",
      "start_seconds": 0,
      "end_seconds": 45,
      "heading": "Introduction",
      "text": "The cleaned narrative text for this section..."
    },
    {
      "id": "section-2",
      "start_seconds": 45,
      "end_seconds": 120,
      "heading": "Preparing the Ingredients",
      "text": "First, let's get our mise en place ready..."
    }
  ]
}

Each section must have a unique "id" field (e.g., "section-1", "section-2", etc.) that will be used to link recipe steps to transcript sections.

TRANSCRIPT:
{transcript}`;

/**
 * System prompt for transcript cleaning
 */
export const CLEAN_TRANSCRIPT_SYSTEM_PROMPT =
  'You are an expert editor who transforms raw video transcripts into engaging, readable content while preserving the original voice and all important details. Always output valid JSON only, no markdown code blocks.';
