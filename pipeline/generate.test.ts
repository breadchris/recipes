import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { VideoRecipes } from '../lib/types/admin';

// Store mock for access in tests
const mockCreate = vi.fn();

// Mock OpenAI with a proper class constructor
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

// Import after mocking
import { extractAllRecipes, estimateRecipeCountFromDescription, type VideoMetadata } from '../lib/admin/openai/client';

// Test fixtures
const mockMetadata: VideoMetadata = {
  id: '-35JXpiQ3EA',
  fulltitle: 'A Revolution in Meal Prepping',
  description: 'Test video with 10 recipes',
  webpage_url: 'https://www.youtube.com/watch?v=-35JXpiQ3EA',
  upload_date: '20251220',
  duration: 900,
};

const mockTranscript = `
[0:00] Welcome to our meal prep video
[1:36] Let's start with Pollo en Salsa Verde
[3:14] Next up is Turkey Chili
[5:58] Now for Tofu Chorizo
[8:13] Braised Cabbage is next
[9:34] Fajita Veggies
[10:30] Sweet Potato Plantain Mash
[11:53] Eggplant and Chickpea
[12:42] Cilantro Rice
[13:27] Black Beans
[14:47] Finally, Farro Rojo
`;

const createMockRecipe = (title: string): VideoRecipes['recipes'][0] => ({
  title,
  description: `Mock ${title} description`,
  prep_time_minutes: 10,
  cook_time_minutes: 20,
  total_time_minutes: 30,
  servings: 4,
  yield: '4 servings',
  difficulty: 'medium',
  cuisine_type: ['mexican'],
  meal_type: ['dinner'],
  dietary_tags: [],
  ingredients: [{ item: 'test ingredient', quantity: '1', unit: 'cup', notes: '' }],
  instructions: [{
    step: 1,
    text: 'Test instruction',
    timing_confidence: 'high' as const,
    timestamp_seconds: 0,
    keywords: { ingredients: [], techniques: [], equipment: [] },
    video_references: [],
  }],
  equipment: [],
  tags: [],
  tips: [],
});

describe('extractAllRecipes', () => {
  beforeEach(() => {
    vi.stubEnv('OPENAI_API_KEY', 'test-api-key');
    mockCreate.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('should extract all recipes through multiple iterations', async () => {
    // First call: returns 2 recipes with has_more_recipes: true
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            has_recipe: true,
            has_more_recipes: true,
            video_id: mockMetadata.id,
            video_url: mockMetadata.webpage_url,
            upload_date: mockMetadata.upload_date,
            recipes: [
              createMockRecipe('Green Chicken in Salsa Verde'),
              createMockRecipe('Mexican Turkey Chili'),
            ],
          }),
        },
      }],
    });

    // Second call: returns 2 more recipes with has_more_recipes: true
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            has_recipe: true,
            has_more_recipes: true,
            video_id: mockMetadata.id,
            video_url: mockMetadata.webpage_url,
            upload_date: mockMetadata.upload_date,
            recipes: [
              createMockRecipe('Tofu Chorizo'),
              createMockRecipe('Braised Cabbage'),
            ],
          }),
        },
      }],
    });

    // Third call: returns remaining recipes with has_more_recipes: false
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            has_recipe: true,
            has_more_recipes: false,
            video_id: mockMetadata.id,
            video_url: mockMetadata.webpage_url,
            upload_date: mockMetadata.upload_date,
            recipes: [
              createMockRecipe('Fajita Veggies'),
              createMockRecipe('Cilantro Rice'),
            ],
          }),
        },
      }],
    });

    const result = await extractAllRecipes(
      mockMetadata,
      mockTranscript,
      'Test prompt {title} {transcript}',
      []
    );

    expect(result.iterations).toBe(3);
    expect(result.recipes.recipes.length).toBe(6);
    expect(result.recipes.has_recipe).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it('should deduplicate recipes returned in multiple iterations', async () => {
    // First call: returns 2 recipes
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            has_recipe: true,
            has_more_recipes: true,
            video_id: mockMetadata.id,
            video_url: mockMetadata.webpage_url,
            upload_date: mockMetadata.upload_date,
            recipes: [
              createMockRecipe('Green Chicken in Salsa Verde'),
              createMockRecipe('Mexican Turkey Chili'),
            ],
          }),
        },
      }],
    });

    // Second call: returns one duplicate and one new recipe
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            has_recipe: true,
            has_more_recipes: false,
            video_id: mockMetadata.id,
            video_url: mockMetadata.webpage_url,
            upload_date: mockMetadata.upload_date,
            recipes: [
              createMockRecipe('Green Chicken in Salsa Verde'), // Duplicate
              createMockRecipe('Tofu Chorizo'), // New
            ],
          }),
        },
      }],
    });

    const result = await extractAllRecipes(
      mockMetadata,
      mockTranscript,
      'Test prompt {title} {transcript}',
      []
    );

    expect(result.recipes.recipes.length).toBe(3);
    const titles = result.recipes.recipes.map(r => r.title);
    expect(titles).toEqual([
      'Green Chicken in Salsa Verde',
      'Mexican Turkey Chili',
      'Tofu Chorizo',
    ]);
  });

  it('should stop when has_more_recipes is false', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            has_recipe: true,
            has_more_recipes: false,
            video_id: mockMetadata.id,
            video_url: mockMetadata.webpage_url,
            upload_date: mockMetadata.upload_date,
            recipes: [createMockRecipe('Single Recipe')],
          }),
        },
      }],
    });

    const result = await extractAllRecipes(
      mockMetadata,
      mockTranscript,
      'Test prompt {title} {transcript}',
      []
    );

    expect(result.iterations).toBe(1);
    expect(result.recipes.recipes.length).toBe(1);
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('should stop when max iterations is reached', async () => {
    // Return different recipes each time to avoid deduplication stopping early
    let callCount = 0;
    mockCreate.mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        choices: [{
          message: {
            content: JSON.stringify({
              has_recipe: true,
              has_more_recipes: true,
              video_id: mockMetadata.id,
              video_url: mockMetadata.webpage_url,
              upload_date: mockMetadata.upload_date,
              recipes: [createMockRecipe(`Recipe ${callCount}`)],
            }),
          },
        }],
      });
    });

    const result = await extractAllRecipes(
      mockMetadata,
      mockTranscript,
      'Test prompt {title} {transcript}',
      [],
      { maxIterations: 3 }
    );

    expect(result.iterations).toBe(3);
    expect(mockCreate).toHaveBeenCalledTimes(3);
    expect(result.recipes.recipes.length).toBe(3);
  });

  it('should stop when all recipes are duplicates', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            has_recipe: true,
            has_more_recipes: true,
            video_id: mockMetadata.id,
            video_url: mockMetadata.webpage_url,
            upload_date: mockMetadata.upload_date,
            recipes: [createMockRecipe('Recipe One')],
          }),
        },
      }],
    });

    // Second call returns only duplicates
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            has_recipe: true,
            has_more_recipes: true,
            video_id: mockMetadata.id,
            video_url: mockMetadata.webpage_url,
            upload_date: mockMetadata.upload_date,
            recipes: [createMockRecipe('Recipe One')], // Duplicate
          }),
        },
      }],
    });

    const result = await extractAllRecipes(
      mockMetadata,
      mockTranscript,
      'Test prompt {title} {transcript}',
      []
    );

    expect(result.iterations).toBe(2);
    expect(result.recipes.recipes.length).toBe(1);
  });

  it('should include existing recipes in continuation prompt', async () => {
    const existingRecipes = [{ title: 'Existing Recipe' }];

    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            has_recipe: true,
            has_more_recipes: false,
            video_id: mockMetadata.id,
            video_url: mockMetadata.webpage_url,
            upload_date: mockMetadata.upload_date,
            recipes: [createMockRecipe('New Recipe')],
          }),
        },
      }],
    });

    // Use a prompt template that includes 'Transcript:\n' so continuation instruction is injected
    const promptWithTranscript = 'Test prompt {title}\n\nTranscript:\n{transcript}';

    await extractAllRecipes(
      mockMetadata,
      mockTranscript,
      promptWithTranscript,
      existingRecipes
    );

    // Verify the prompt includes existing recipe titles
    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages[1].content;
    expect(userMessage).toContain('ALREADY EXTRACTED RECIPES');
    expect(userMessage).toContain('Existing Recipe');
  });

  it('should handle no recipe response', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({
            has_recipe: false,
            has_more_recipes: false,
            video_id: mockMetadata.id,
            video_url: mockMetadata.webpage_url,
            upload_date: mockMetadata.upload_date,
            recipes: [],
          }),
        },
      }],
    });

    const result = await extractAllRecipes(
      mockMetadata,
      mockTranscript,
      'Test prompt {title} {transcript}',
      []
    );

    expect(result.iterations).toBe(1);
    expect(result.recipes.recipes.length).toBe(0);
    expect(result.recipes.has_recipe).toBe(false);
  });
});

describe('estimateRecipeCountFromDescription', () => {
  it('should count recipe timestamps correctly', () => {
    const description = `
00:00 - Intro
01:36 - Pollo en Salsa Verde
03:14 - Turkey Chili
05:58 - Tofu Chorizo
14:47 - Farro Rojo
15:41 - Final Meals
`;
    // Should count only actual recipes (4), not Intro (1) or Final Meals (1)
    expect(estimateRecipeCountFromDescription(description)).toBe(4);
  });

  it('should filter out common non-recipe segments', () => {
    const description = `
00:00 - Intro
01:00 - Recipe One
05:00 - Wheel of Frozen Foods
10:00 - Recipe Two
15:00 - Final Thoughts
20:00 - Outro
25:00 - Credits
`;
    // Should only count Recipe One and Recipe Two
    expect(estimateRecipeCountFromDescription(description)).toBe(2);
  });

  it('should handle descriptions without timestamps', () => {
    const description = 'This is a great video about cooking!';
    expect(estimateRecipeCountFromDescription(description)).toBe(0);
  });

  it('should handle em-dashes and regular dashes', () => {
    const description = `
01:00 - Recipe with dash
02:00 – Recipe with em-dash
`;
    expect(estimateRecipeCountFromDescription(description)).toBe(2);
  });
});
