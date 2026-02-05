import { openai } from '@ai-sdk/openai';
import { streamObject } from 'ai';
import { recipeSchema } from '@/lib/schemas/recipe';

const SYSTEM_PROMPT = `You are an expert recipe modifier. You will receive an existing recipe and a user request to modify it.

Your job is to intelligently update the recipe based on what the user asks. Common requests include:
- Ingredient substitutions ("I don't have X" → suggest alternative or remove)
- Dietary adjustments ("make it vegan", "make it gluten-free")
- Scaling ("double the recipe", "make it for 2 people")
- Flavor changes ("make it spicier", "less sweet")
- Simplification ("make it easier", "fewer ingredients")

Guidelines:
- Preserve the essence of the original recipe while making requested changes
- Update ALL affected parts (ingredients, instructions, tips, dietary tags)
- If removing an ingredient, also remove it from instructions
- If substituting, update quantities appropriately
- Recalculate prep/cook times if the change affects them
- Update dietary_tags accurately based on the modified recipe
- Keep the same format and level of detail as the original

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
    const { recipe, message } = await req.json();

    if (!recipe || !message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Recipe and message are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userPrompt = `Here is the current recipe:

${JSON.stringify(recipe, null, 2)}

User's modification request: "${message}"

Please modify the recipe according to the user's request and return the complete updated recipe.`;

    const result = streamObject({
      model: openai('gpt-4.1-nano'),
      schema: recipeSchema,
      output: 'object',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Error modifying recipe:', error);
    return new Response(JSON.stringify({ error: 'Failed to modify recipe' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
