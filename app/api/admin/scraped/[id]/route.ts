import { NextRequest, NextResponse } from 'next/server';
import { typesenseClient, SCRAPED_COLLECTION_NAME } from '@/lib/typesense';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  try {
    const doc = await typesenseClient
      .collections(SCRAPED_COLLECTION_NAME)
      .documents(decodedId)
      .retrieve();

    return NextResponse.json(doc);
  } catch (error: any) {
    if (error.httpStatus === 404) {
      return NextResponse.json(
        { error: 'Recipe not found', id: decodedId },
        { status: 404 }
      );
    }

    console.error(`Failed to fetch scraped recipe [${decodedId}]:`, error);
    return NextResponse.json(
      { error: 'Failed to load recipe', id: decodedId },
      { status: 500 }
    );
  }
}
