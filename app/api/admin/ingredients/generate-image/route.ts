import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createServerSupabaseClient } from '@/lib/clients/supabaseServer';

const BUCKET_NAME = 'content';

function buildPrompt(ingredient: string): string {
  return `A clean watercolor illustration of a single ${ingredient}. Light pencil outlines with soft watercolor washes in the ingredient's true natural colors. Gentle color bleeding at edges. The ingredient should be clearly recognizable and the only subject — nothing else in the image. Plain white background. No text, no shadow, no border, no table, no surface, no other objects. Centered, simple, iconic.`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function POST(request: Request) {
  try {
    const { ingredient } = await request.json();

    if (!ingredient || typeof ingredient !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: ingredient' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Use direct OpenAI client (not OpenRouter — image gen not available via OpenRouter)
    const openai = new OpenAI({ apiKey });

    const prompt = buildPrompt(ingredient.trim());

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      return NextResponse.json(
        { error: 'No image returned from OpenAI' },
        { status: 500 }
      );
    }

    // Download the generated image
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to download generated image' },
        { status: 500 }
      );
    }

    const imageBuffer = new Uint8Array(await imageResponse.arrayBuffer());
    const slug = slugify(ingredient);
    const filePath = `ingredients/${slug}.png`;

    // Upload to Supabase Storage
    const supabase = createServerSupabaseClient();

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, imageBuffer, {
        contentType: 'image/png',
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload image to storage', details: uploadError.message },
        { status: 500 }
      );
    }

    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      image_url: publicUrl,
      ingredient: ingredient.trim(),
      slug,
    });
  } catch (error) {
    console.error('Error generating ingredient image:', error);
    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    );
  }
}

/**
 * GET - List previously generated ingredient images
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    const { data: files, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list('ingredients', {
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const images = (files || [])
      .filter(f => f.name.endsWith('.png'))
      .map(f => {
        const { data: { publicUrl } } = supabase.storage
          .from(BUCKET_NAME)
          .getPublicUrl(`ingredients/${f.name}`);
        return {
          name: f.name.replace('.png', '').replace(/-/g, ' '),
          slug: f.name.replace('.png', ''),
          url: publicUrl,
          created_at: f.created_at,
        };
      });

    return NextResponse.json({ images });
  } catch (error) {
    console.error('Error listing ingredient images:', error);
    return NextResponse.json({ error: 'Failed to list images' }, { status: 500 });
  }
}
