import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// Cache the lookup data in memory
let lookupCache: Record<string, unknown> | null = null;

async function getLookupData(): Promise<Record<string, unknown>> {
  if (lookupCache) return lookupCache;

  const gzPath = path.join(process.cwd(), 'data/scraped-recipes-lookup.json.gz');
  const jsonPath = path.join(process.cwd(), 'data/scraped-recipes-lookup.json');

  if (fs.existsSync(gzPath)) {
    const compressed = fs.readFileSync(gzPath);
    const decompressed = zlib.gunzipSync(compressed);
    lookupCache = JSON.parse(decompressed.toString());
  } else if (fs.existsSync(jsonPath)) {
    const data = fs.readFileSync(jsonPath, 'utf-8');
    lookupCache = JSON.parse(data);
  } else {
    throw new Error('Scraped recipes lookup file not found');
  }

  return lookupCache!;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);

  try {
    const lookup = await getLookupData();
    const recipe = lookup[decodedId];

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recipe not found', id: decodedId },
        { status: 404 }
      );
    }

    return NextResponse.json(recipe);
  } catch (error) {
    console.error(`Failed to fetch scraped recipe [${decodedId}]:`, error);
    return NextResponse.json(
      { error: 'Failed to load recipe', id: decodedId },
      { status: 500 }
    );
  }
}
