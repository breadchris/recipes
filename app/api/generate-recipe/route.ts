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
- Estimate realistic prep and cook times

IMPORTANT - Categorize each ingredient by grocery store section using exactly these category names:
- "Produce" - Fresh fruits, vegetables, fresh herbs (cilantro, basil, parsley)
- "Meat & Seafood" - Beef, chicken, pork, fish, shellfish, ground meat
- "Dairy & Eggs" - Milk, cheese, butter, cream, eggs, yogurt, sour cream
- "Bakery" - Bread, rolls, tortillas, pita, baked goods
- "Pantry" - Flour, sugar, rice, pasta, canned goods, dried beans, nuts, broth
- "Spices & Seasonings" - Salt, pepper, dried herbs, spice blends, bay leaves
- "Oils & Vinegars" - Cooking oils, olive oil, sesame oil, vinegars
- "Condiments & Sauces" - Soy sauce, hot sauce, mustard, mayo, ketchup, fish sauce
- "Frozen" - Frozen vegetables, frozen fruits, frozen proteins
- "Refrigerated" - Tofu, fresh pasta, deli meats, hummus, kimchi

IMPORTANT - For EACH instruction step, include step-specific ingredients:
- In the "keywords.ingredients" field, list the ingredients used in that specific step
- Include the quantity, unit, and item for each ingredient used in that step
- This helps users see exactly what ingredients they need for each step
- Example: For "Add 2 tablespoons butter to the pan", include {quantity: "2", unit: "tablespoons", item: "butter"} in keywords.ingredients`;

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
      model: openai('gpt-4.1-nano'),
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
