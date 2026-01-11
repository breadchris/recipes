import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/clients/supabaseServer';
import type { SaveGeneratedRecipeRequest, GeneratedRecipeMetadata } from '@/lib/types/generated-recipe';

const GENERATED_RECIPES_GROUP = 'generated-recipes';
// Admin-generated content uses a placeholder UUID since there's no auth in admin
const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000000';

export async function POST(request: Request) {
  try {
    const body: SaveGeneratedRecipeRequest = await request.json();
    const { recipe, generatedId, prompt } = body;

    if (!recipe || !generatedId) {
      return NextResponse.json(
        { error: 'Missing required fields: recipe, generatedId' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Get or create the generated-recipes group
    let { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id')
      .eq('name', GENERATED_RECIPES_GROUP)
      .single();

    if (groupError || !group) {
      // Create the group if it doesn't exist
      const { data: newGroup, error: createError } = await supabase
        .from('groups')
        .insert({ name: GENERATED_RECIPES_GROUP })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating group:', createError);
        return NextResponse.json(
          { error: 'Failed to create or find recipe group' },
          { status: 500 }
        );
      }
      group = newGroup;
    }

    // Build metadata
    const metadata: GeneratedRecipeMetadata = {
      generated_id: generatedId,
      recipe,
      created_at: new Date().toISOString(),
      model: 'gpt-4o',
      prompt,
    };

    // Insert the generated recipe
    const { data, error } = await supabase
      .from('content')
      .insert({
        type: 'generated-recipe',
        data: recipe.title,
        group_id: group.id,
        user_id: ADMIN_USER_ID,
        metadata,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error saving recipe:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: data.id,
    });
  } catch (error) {
    console.error('Error in save-generated-recipe:', error);
    return NextResponse.json(
      { error: 'Failed to save recipe' },
      { status: 500 }
    );
  }
}

/**
 * GET - List all saved generated recipes
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Get group ID
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id')
      .eq('name', GENERATED_RECIPES_GROUP)
      .single();

    if (groupError || !group) {
      return NextResponse.json({ recipes: [] });
    }

    // Get all generated recipes
    const { data: recipes, error } = await supabase
      .from('content')
      .select('*')
      .eq('group_id', group.id)
      .eq('type', 'generated-recipe')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching recipes:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ recipes: recipes || [] });
  } catch (error) {
    console.error('Error in get generated recipes:', error);
    return NextResponse.json({ error: 'Failed to fetch recipes' }, { status: 500 });
  }
}
