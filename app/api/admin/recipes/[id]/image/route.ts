import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/clients/supabaseServer';

const RECIPES_GROUP_ID = '52f7d41b-490e-40d1-b5da-eb1d74ec2eae';
const BUCKET_NAME = 'content';

/**
 * POST /api/admin/recipes/[id]/image
 * Upload an image for a recipe to Supabase Storage
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const supabase = createServerSupabaseClient();

    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    // Get the content record to verify it exists
    const { data: contentRecord, error: fetchError } = await supabase
      .from('content')
      .select('id, metadata')
      .eq('group_id', RECIPES_GROUP_ID)
      .filter('metadata->>youtube_video_id', 'eq', videoId)
      .single();

    if (fetchError || !contentRecord) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Use content UUID for folder and filename
    const extension = file.name.split('.').pop() || 'jpg';
    const filePath = `${contentRecord.id}/${contentRecord.id}.${extension}`;

    // Convert File to ArrayBuffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Delete any existing images for this content first
    const { data: existingFiles } = await supabase.storage
      .from(BUCKET_NAME)
      .list(contentRecord.id);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => `${contentRecord.id}/${f.name}`);
      await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);
    }

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload image', details: uploadError.message },
        { status: 500 }
      );
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    // Update the content record with the image URL
    const updatedMetadata = {
      ...contentRecord.metadata,
      recipe_image_url: publicUrl,
    };

    const { error: updateError } = await supabase
      .from('content')
      .update({ metadata: updatedMetadata })
      .eq('id', contentRecord.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to save image URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      image_url: publicUrl,
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/recipes/[id]/image
 * Remove the image for a recipe
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const supabase = createServerSupabaseClient();

    // Get the content record
    const { data: contentRecord, error: fetchError } = await supabase
      .from('content')
      .select('id, metadata')
      .eq('group_id', RECIPES_GROUP_ID)
      .filter('metadata->>youtube_video_id', 'eq', videoId)
      .single();

    if (fetchError || !contentRecord) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Delete all images for this content from storage
    const { data: existingFiles } = await supabase.storage
      .from(BUCKET_NAME)
      .list(contentRecord.id);

    if (existingFiles && existingFiles.length > 0) {
      const filesToDelete = existingFiles.map(f => `${contentRecord.id}/${f.name}`);
      await supabase.storage.from(BUCKET_NAME).remove(filesToDelete);
    }

    // Remove the image URL from metadata
    const { recipe_image_url: _, ...restMetadata } = contentRecord.metadata as Record<string, unknown>;

    const { error: updateError } = await supabase
      .from('content')
      .update({ metadata: restMetadata })
      .eq('id', contentRecord.id);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to remove image URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/recipes/[id]/image
 * Get the current image URL for a recipe
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: videoId } = await params;
    const supabase = createServerSupabaseClient();

    const { data: contentRecord, error: fetchError } = await supabase
      .from('content')
      .select('metadata')
      .eq('group_id', RECIPES_GROUP_ID)
      .filter('metadata->>youtube_video_id', 'eq', videoId)
      .single();

    if (fetchError || !contentRecord) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    const metadata = contentRecord.metadata as Record<string, unknown>;
    const imageUrl = metadata?.recipe_image_url as string | undefined;

    return NextResponse.json({
      image_url: imageUrl || null,
    });
  } catch (error) {
    console.error('Error getting image:', error);
    return NextResponse.json(
      { error: 'Failed to get image' },
      { status: 500 }
    );
  }
}
