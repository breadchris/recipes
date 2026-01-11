/**
 * Default prompt for recipe extraction from video transcripts.
 * This prompt is used for:
 * - Migrating legacy recipes (as the original prompt)
 * - Pre-filling the prompt editor in the UI
 * - Regenerating recipes when no custom prompt is provided
 */
export const DEFAULT_RECIPE_PROMPT = `Extract structured recipes from this cooking video transcript.

Video Title: {title}
Video URL: {video_url}
Upload Date: {upload_date}
Description: {description}

Description Timestamps:
{description_timestamps}

Use these description timestamps to:
- Identify when each recipe starts in the video
- Set accurate timestamp_seconds for the first step of each recipe
- Ensure all listed recipes (non-[non-recipe] entries) are extracted

The transcript includes timestamps in [MM:SS] format (e.g., [0:30] means 30 seconds, [5:45] means 5 minutes 45 seconds).

IMPORTANT: Some videos contain MULTIPLE recipes (e.g., "3 Easy Pasta Dishes", "5 Ways to Cook Eggs"). Extract ALL recipes shown in the video as separate entries in the recipes array.

DO NOT extract the following as recipes:
- Video segments that are not actual recipes (e.g., "Intro", "Outro", "Final Meals", "Wheel of...", "Conclusion")
- Sponsor segments or promotional content
- Brief mentions of condiments/sauces without actual cooking instructions
- Equipment demonstrations or product reviews
- Segments that describe a process but don't result in a dish (e.g., "Wheel of Frozen Foods" selection process)

A valid recipe MUST have:
- At least 2-3 ingredients with quantities
- At least 2-3 cooking/preparation steps
- An actual food dish as the end result

CRITICAL: If there are more recipes in the video that you haven't extracted yet (due to response length limits or other constraints), set "has_more_recipes": true. Otherwise, set "has_more_recipes": false.

Please analyze the transcript and extract for EACH recipe:
1. Recipe title (the specific dish name)
2. Complete ingredient list with quantities and units
3. Step-by-step instructions with timestamps and keywords for each step
4. Prep time, cook time, total time (estimate from video)
5. Servings/yield
6. Tags (cuisine type, meal type, dietary restrictions, etc.)
   DIETARY TAG RULES - STRICTLY FOLLOW THESE:
   - "vegetarian": ONLY if NO meat, poultry, or fish. Eggs and dairy are OK.
   - "vegan": ONLY if NO animal products (no meat, dairy, eggs, honey)
   - "gluten-free": ONLY if NO wheat, barley, rye, or gluten-containing ingredients
   - "dairy-free": ONLY if NO milk, cheese, butter, cream, or dairy products
   - NEVER use "can be vegetarian" - a recipe either IS vegetarian or it ISN'T
   - NEVER tag a recipe as vegetarian/vegan if ingredients include: beef, chicken, pork, bacon, sausage, fish, seafood, turkey, lamb, duck, ham, prosciutto, or ANY meat
   - Review the ingredient list BEFORE assigning dietary tags
7. Difficulty level (easy/medium/hard)
8. Required equipment

CRITICAL: Each instruction step must be a single, atomic action. Do NOT combine multiple distinct tasks into one step.
BAD: "Boil water and add salt for pasta and vegetables. Prep vegetables: shell peas and fava beans, cut asparagus and carrots."
GOOD: Separate steps:
  - Step 1: "Bring a large pot of water to a boil"
  - Step 2: "Add salt to the boiling water"
  - Step 3: "Shell the peas and fava beans"
  - Step 4: "Cut the asparagus into 2-inch pieces"
  - Step 5: "Slice the carrots into thin rounds"
If a step in the transcript covers multiple actions, break them into separate instruction steps with the same or close timestamps.

For each instruction step:
- section_id (OPTIONAL): The ID of the cleaned transcript section this step corresponds to (e.g., "section-1", "section-2"). Multiple steps can reference the same section.
- timestamp_seconds (OPTIONAL): The timestamp (in seconds) when this step begins. Include when confidence is "high" or "medium".
- end_time_seconds (OPTIONAL): The timestamp (in seconds) when this step ends.
- timing_confidence: REQUIRED field - must be one of:
  - "high": Transcript explicitly shows the chef performing this exact step at a specific timestamp
  - "medium": Timestamp can be reasonably inferred from context (sequential ingredient mentions, transition phrases, implied actions)
  - "low": Step is mentioned but exact timing is unclear
  - "none": Step is derived from recipe but not referenced in transcript
- keywords: Identify keywords that would help find that step in the video:
  - ingredients: Full ingredient objects used in this step with the amounts needed for THIS step specifically. Use the same schema as recipe-level ingredients:
    { "item": "ingredient name", "quantity": "amount for this step", "unit": "measurement unit", "notes": "optional" }
    If a step uses only part of a recipe ingredient (e.g., recipe needs 2 cups flour but step uses 1 cup), specify the step amount.
  - techniques: cooking techniques used (e.g., sear, fold, whisk, chop, simmer)
  - equipment: equipment used in that step
- measurements: Extract important numbers from each step:
  - temperatures: cooking temperatures mentioned (e.g., "350°F", "medium-high heat", "180°C")
  - amounts: specific quantities used in this step (e.g., "2 cups", "1 tablespoon", "a pinch")
  - times: duration or timing cues (e.g., "5 minutes", "until golden brown", "2-3 hours")

If this video does NOT contain any recipes (e.g., it's an interview, Q&A, or non-cooking content), respond with {"has_recipe": false, "has_more_recipes": false, "recipes": []}.

Return ONLY a valid JSON object with this exact structure (use snake_case for all keys):
{
  "has_recipe": true,
  "has_more_recipes": false,
  "video_id": "{video_id}",
  "video_url": "{video_url}",
  "upload_date": "{upload_date}",
  "recipes": [
    {
      "title": "Recipe Name",
      "description": "Brief description of the dish",
      "prep_time_minutes": 15,
      "cook_time_minutes": 30,
      "total_time_minutes": 45,
      "servings": 4,
      "yield": "4 servings",
      "difficulty": "medium",
      "cuisine_type": ["american", "comfort food"],
      "meal_type": ["dinner", "main course"],
      "dietary_tags": ["vegetarian", "gluten-free"],
      "ingredients": [
        {
          "item": "ingredient name",
          "quantity": "2",
          "unit": "cups",
          "notes": "optional preparation notes"
        }
      ],
      "instructions": [
        {
          "step": 1,
          "text": "Heat oil in a large skillet over medium-high heat",
          "section_id": "section-1",
          "timing_confidence": "high",
          "timestamp_seconds": 45,
          "end_time_seconds": 90,
          "keywords": {
            "ingredients": [
              {"item": "oil", "quantity": "2", "unit": "tablespoons", "notes": ""}
            ],
            "techniques": ["heat"],
            "equipment": ["skillet"]
          },
          "measurements": {
            "temperatures": ["medium-high heat"],
            "amounts": ["2 tablespoons"],
            "times": []
          }
        },
        {
          "step": 2,
          "text": "Crack one egg into a mixing bowl",
          "section_id": "section-2",
          "timing_confidence": "medium",
          "timestamp_seconds": 95,
          "end_time_seconds": 100,
          "keywords": {
            "ingredients": [
              {"item": "egg", "quantity": "1", "unit": "", "notes": ""}
            ],
            "techniques": ["crack"],
            "equipment": ["mixing bowl"]
          },
          "measurements": {
            "temperatures": [],
            "amounts": ["1 egg"],
            "times": []
          }
        },
        {
          "step": 3,
          "text": "Season the chicken with salt and pepper",
          "timing_confidence": "none",
          "keywords": {
            "ingredients": [
              {"item": "chicken", "quantity": "1", "unit": "pound", "notes": ""},
              {"item": "salt", "quantity": "1", "unit": "teaspoon", "notes": ""},
              {"item": "pepper", "quantity": "1/2", "unit": "teaspoon", "notes": ""}
            ],
            "techniques": ["season"],
            "equipment": []
          },
          "measurements": {
            "temperatures": [],
            "amounts": ["1 teaspoon salt", "1/2 teaspoon pepper"],
            "times": []
          }
        }
      ],
      "equipment": ["skillet", "mixing bowl", "whisk"],
      "tags": ["quick", "weeknight", "family-friendly"],
      "tips": ["Optional cooking tips or variations"]
    }
  ]
}

Transcript:
{transcript}`;

/**
 * System prompt for recipe extraction
 */
export const SYSTEM_PROMPT =
  "You are an expert recipe extractor. Extract structured recipe data from cooking video transcripts. Always use snake_case for JSON keys per the project's JSON naming convention.";

/**
 * Format the prompt with video metadata
 */
export function formatPrompt(
  template: string,
  metadata: {
    title: string;
    video_url: string;
    video_id: string;
    upload_date: string;
    description: string;
    transcript: string;
    description_timestamps?: string;
  }
): string {
  return template
    .replace('{title}', metadata.title)
    .replace('{video_url}', metadata.video_url)
    .replace('{video_id}', metadata.video_id)
    .replace('{upload_date}', metadata.upload_date)
    .replace('{description}', metadata.description.slice(0, 1500))
    .replace('{description_timestamps}', metadata.description_timestamps || 'No timestamps found in video description.')
    .replace('{transcript}', metadata.transcript);
}
