import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import type { TagTaxonomy } from '@/lib/types/tags';

// Cache the taxonomy in memory
let cachedTaxonomy: TagTaxonomy | null = null;

export async function GET() {
  if (cachedTaxonomy) {
    return NextResponse.json(cachedTaxonomy);
  }

  try {
    const taxonomyPath = path.join(process.cwd(), 'data', 'tag-taxonomy.json');
    const taxonomyData = fs.readFileSync(taxonomyPath, 'utf-8');
    cachedTaxonomy = JSON.parse(taxonomyData);
    return NextResponse.json(cachedTaxonomy);
  } catch (error) {
    console.error('Failed to load tag taxonomy:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      path: path.join(process.cwd(), 'data', 'tag-taxonomy.json'),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: 'Failed to load tag taxonomy',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        endpoint: '/api/tags'
      },
      { status: 500 }
    );
  }
}
