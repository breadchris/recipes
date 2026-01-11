import { openai } from '@ai-sdk/openai';
import { streamObject } from 'ai';
import { recipeSchema } from '@/lib/schemas/recipe';

const SYSTEM_PROMPT = `You are an expert recipe creator. Generate detailed, accurate recipes based on the user's request.

Create recipes that are:
- Clear and easy to follow with step-by-step instructions
- Include precise measurements for all ingredients
- Have atomic instruction steps (one action per step)
- Include helpful tips when appropriate
- Consider dietary tags accurately:
  - "vegetarian" means absolutely NO meat, poultry, or fish
  - "vegan" means NO animal products (no meat, dairy, eggs, honey)
  - "gluten-free" means NO wheat, barley, rye, or gluten-containing ingredients
  - Only add dietary tags if the recipe truly qualifies

Format guidelines:
- Use common unit abbreviations (cups, tbsp, tsp, oz, lb, g)
- Break complex steps into multiple simple steps
- Include temperatures in both Fahrenheit and Celsius when relevant
- Estimate realistic prep and cook times`;

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = streamObject({
      model: openai('gpt-4o'),
      schema: recipeSchema,
      output: 'object',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Create a detailed recipe for: ${prompt}` },
      ],
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Error generating recipe:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate recipe' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
