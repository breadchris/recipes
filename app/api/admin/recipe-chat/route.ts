import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages, stepCountIs } from 'ai';
import { z } from 'zod';
import { searchVideos, browseVideos } from '@/lib/searchIndex';

const SYSTEM_PROMPT = `You are a helpful recipe finding assistant. Help users discover recipes from our video recipe collection based on their preferences, ingredients, dietary needs, or cravings.

When users describe what they want to cook:
1. Use the searchRecipes tool to find matching recipes by keywords
2. Use the browseByFilters tool to filter by tags like cuisine type, dietary restrictions, etc.
3. Present results conversationally - mention the recipe names and channels
4. Ask follow-up questions to refine suggestions if needed

IMPORTANT - When to offer recipe generation:
- If search returns 0-2 results, use the offerRecipeGeneration tool to offer creating a new AI-generated recipe
- If the user explicitly asks to "create", "generate", or "make up" a recipe, use offerRecipeGeneration immediately
- If the user wants a variation or inspired version of a recipe from results (e.g., "make that but vegetarian", "something like the carbonara but easier"), use offerRecipeGeneration with a descriptive title that captures the inspiration and modification
- Include the recipe concept as the title (e.g., "Vegetarian Carbonara-Style Pasta" or "Easy Thai Basil Chicken")
- When inspired by an existing recipe, include the inspirationId and inspirationTitle

Keep responses concise and friendly. When presenting search results, briefly describe what you found and let the user know they can click on any recipe card to see more details.

Available tags for filtering include:
- Cuisines: italian, mexican, asian, indian, mediterranean, american, french, japanese, chinese, thai
- Meal types: breakfast, lunch, dinner, snack, dessert, appetizer
- Dietary: vegetarian, vegan, gluten-free, dairy-free, keto, low-carb
- Difficulty: easy, medium, hard
- Time: quick (under 30 min), weeknight`;

export const maxDuration = 60;

export async function POST(req: Request) {
  let messageCount = 0;

  try {
    const { messages } = await req.json();
    messageCount = messages?.length || 0;

    console.log('[recipe-chat] Request received', {
      messageCount,
      timestamp: new Date().toISOString(),
    });

    if (!messages || !Array.isArray(messages)) {
      console.log('[recipe-chat] Invalid request: messages array missing');
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.log('[recipe-chat] Starting stream', {
      model: 'gpt-4.1-nano',
      toolsEnabled: ['searchRecipes', 'browseByFilters'],
      timestamp: new Date().toISOString(),
    });

    const result = streamText({
      model: openai('gpt-4.1-nano'),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(3),
      tools: {
        searchRecipes: {
          description: 'Search for recipes by name, ingredients, or description. Use this for general keyword searches.',
          inputSchema: z.object({
            query: z.string().describe('Search query - can be recipe name, ingredients, or description keywords'),
            limit: z.number().optional().default(6).describe('Number of results to return'),
          }),
          execute: async ({ query, limit }: { query: string; limit?: number }) => {
            const start = Date.now();
            console.log('[recipe-chat] Tool: searchRecipes started', { query, limit: limit || 6 });

            try {
              const results = await searchVideos(query, limit || 6, true);
              console.log('[recipe-chat] Tool: searchRecipes completed', {
                query,
                resultCount: results.length,
                duration: Date.now() - start,
              });

              return results.map(r => ({
                id: r.id,
                title: r.title,
                channelName: r.channelName,
                thumbnail: r.thumbnails?.[0]?.url,
                description: r.description?.slice(0, 200),
                duration: r.duration,
                viewCount: r.view_count,
              }));
            } catch (error) {
              console.error('[recipe-chat] Tool: searchRecipes failed', {
                query,
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - start,
              });
              throw error;
            }
          },
        },
        browseByFilters: {
          description: 'Browse recipes by tags like cuisine type, meal type, or dietary restrictions. Use this when users want to filter by category.',
          inputSchema: z.object({
            tags: z.array(z.string()).describe('Tags to filter by (e.g., ["italian", "vegetarian", "easy"])'),
            limit: z.number().optional().default(6).describe('Number of results to return'),
          }),
          execute: async ({ tags, limit }: { tags: string[]; limit?: number }) => {
            const start = Date.now();
            console.log('[recipe-chat] Tool: browseByFilters started', { tags, limit: limit || 6 });

            try {
              const results = await browseVideos({ tags, hasRecipeOnly: true }, limit || 6);
              console.log('[recipe-chat] Tool: browseByFilters completed', {
                tags,
                resultCount: results.length,
                duration: Date.now() - start,
              });

              return results.map(r => ({
                id: r.id,
                title: r.title,
                channelName: r.channelName,
                thumbnail: r.thumbnails?.[0]?.url,
                description: r.description?.slice(0, 200),
                duration: r.duration,
                viewCount: r.view_count,
              }));
            } catch (error) {
              console.error('[recipe-chat] Tool: browseByFilters failed', {
                tags,
                error: error instanceof Error ? error.message : String(error),
                duration: Date.now() - start,
              });
              throw error;
            }
          },
        },
        offerRecipeGeneration: {
          description: 'Offer to generate a new AI recipe when searches return 0-2 results, user explicitly asks to create/generate a recipe, or user wants a variation inspired by an existing recipe.',
          inputSchema: z.object({
            title: z.string().describe('The recipe title/concept to generate (e.g., "Vegetarian Carbonara-Style Pasta")'),
            reason: z.string().describe('Brief reason for offering generation (e.g., "no matching recipes found" or "inspired variation requested")'),
            inspirationId: z.string().optional().describe('Video ID of the recipe that inspired this, if any'),
            inspirationTitle: z.string().optional().describe('Title of the inspiring recipe, if any'),
          }),
          execute: async ({ title, reason, inspirationId, inspirationTitle }: { title: string; reason: string; inspirationId?: string; inspirationTitle?: string }) => {
            console.log('[recipe-chat] Tool: offerRecipeGeneration', { title, reason, inspirationId, inspirationTitle });
            return {
              type: 'generate-offer',
              title,
              reason,
              ...(inspirationId && { inspirationId }),
              ...(inspirationTitle && { inspirationTitle }),
            };
          },
        },
      },
    });

    console.log('[recipe-chat] Stream response created', {
      timestamp: new Date().toISOString(),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('[recipe-chat] Error', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      messageCount,
      timestamp: new Date().toISOString(),
    });
    return new Response(JSON.stringify({ error: 'Failed to process chat request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
