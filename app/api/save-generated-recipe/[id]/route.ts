import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/clients/supabaseServer';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Recipe ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient();

    const { data: recipe, error } = await supabase
      .from('content')
      .select('*')
      .eq('id', id)
      .eq('type', 'generated-recipe')
      .single();

    if (error || !recipe) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ recipe });
  } catch (error) {
    console.error('Error fetching recipe:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipe' },
      { status: 500 }
    );
  }
}
