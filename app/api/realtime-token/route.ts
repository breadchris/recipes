import { NextResponse } from 'next/server';

interface RecipeContext {
  title: string;
  ingredients: Array<{
    quantity?: string;
    unit?: string;
    item: string;
    notes?: string;
  }>;
  instructions: Array<{
    step: number;
    text: string;
  }>;
  currentStep: number;
  completedSteps: number[];
  prepTime?: number;
  cookTime?: number;
  tips?: string[];
}

function buildRecipeAssistantInstructions(context: RecipeContext): string {
  const ingredientsList = context.ingredients
    .map(
      (ing, idx) =>
        `${idx + 1}. ${ing.quantity || ''} ${ing.unit || ''} ${ing.item}${ing.notes ? ` (${ing.notes})` : ''}`
    )
    .join('\n');

  const instructionsList = context.instructions
    .map((inst) => {
      const status = context.completedSteps.includes(inst.step)
        ? '[COMPLETED]'
        : inst.step === context.currentStep
          ? '[CURRENT]'
          : '';
      return `Step ${inst.step} ${status}: ${inst.text}`;
    })
    .join('\n');

  return `You are a friendly, expert cooking assistant helping someone cook "${context.title}".

## Your Personality
- Warm, encouraging, and patient like a supportive friend in the kitchen
- Speak naturally and conversationally, not robotically
- Keep responses concise for cooking context (usually 1-3 sentences)
- Use casual time references like "about 5 minutes" rather than technical terms

## Current Recipe Context
**Recipe:** ${context.title}
**Current Step:** ${context.currentStep} of ${context.instructions.length}
**Completed Steps:** ${context.completedSteps.length > 0 ? context.completedSteps.join(', ') : 'None yet'}
${context.prepTime ? `**Prep Time:** ${context.prepTime} min` : ''}
${context.cookTime ? `**Cook Time:** ${context.cookTime} min` : ''}

## Ingredients
${ingredientsList}

## Instructions
${instructionsList}

${context.tips && context.tips.length > 0 ? `## Chef Tips\n${context.tips.join('\n')}` : ''}

## Your Capabilities
1. **Read steps aloud** - When asked, read the current or any specific step clearly
2. **Answer questions** - About ingredients, techniques, substitutions, timing
3. **Navigate** - Help user go to next/previous steps or jump to specific steps
4. **Manage timers** - Start timers when user requests or when appropriate for the step
5. **Track progress** - Mark steps as complete when user indicates they're done
6. **Provide tips** - Offer cooking tips, substitution suggestions, or technique guidance

## Important Guidelines
- Always refer to specific measurements from the recipe (don't guess)
- If unsure about something not in the recipe, say so honestly
- When reading steps, speak at a moderate pace suitable for someone actively cooking
- Proactively offer to start a timer when you read a step that mentions time
- After reading a step, briefly pause then ask if they have questions or are ready to continue
- Keep responses brief - this is for hands-free cooking, not a lecture`;
}

function getRecipeAssistantTools() {
  return [
    {
      type: 'function',
      name: 'navigate_to_step',
      description: 'Navigate to a specific step in the recipe',
      parameters: {
        type: 'object',
        properties: {
          step: {
            type: 'number',
            description: 'The step number to navigate to (1-indexed)',
          },
        },
        required: ['step'],
      },
    },
    {
      type: 'function',
      name: 'mark_step_complete',
      description: 'Mark a step as completed',
      parameters: {
        type: 'object',
        properties: {
          step: {
            type: 'number',
            description: 'The step number to mark as complete',
          },
        },
        required: ['step'],
      },
    },
    {
      type: 'function',
      name: 'start_timer',
      description: 'Start a cooking timer',
      parameters: {
        type: 'object',
        properties: {
          label: {
            type: 'string',
            description: 'Display label for the timer (e.g., "Sear chicken")',
          },
          seconds: {
            type: 'number',
            description: 'Timer duration in seconds',
          },
        },
        required: ['label', 'seconds'],
      },
    },
    {
      type: 'function',
      name: 'read_ingredients',
      description: 'Read out the full ingredient list',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  ];
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OPENAI_API_KEY is not configured' }, { status: 500 });
    }

    const { recipeContext } = (await req.json()) as { recipeContext: RecipeContext };

    if (!recipeContext || !recipeContext.title) {
      return NextResponse.json({ error: 'Recipe context is required' }, { status: 400 });
    }

    // Create a realtime session with OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'alloy',
        instructions: buildRecipeAssistantInstructions(recipeContext),
        tools: getRecipeAssistantTools(),
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI Realtime API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to create realtime session', details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      ephemeralToken: data.client_secret?.value,
      expiresAt: data.client_secret?.expires_at,
    });
  } catch (error) {
    console.error('Error creating realtime session:', error);
    return NextResponse.json(
      { error: 'Failed to create realtime session' },
      { status: 500 }
    );
  }
}
