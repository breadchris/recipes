import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import type { TagIndex } from '@/lib/types/tags';

// Cache the tag index in memory
let cachedIndex: TagIndex | null = null;

export async function GET() {
  if (cachedIndex) {
    return NextResponse.json({
      tagStats: cachedIndex.tagStats,
      meta: cachedIndex.meta,
    });
  }

  try {
    const indexPath = path.join(process.cwd(), 'data', 'tag-index.json');
    const indexData = fs.readFileSync(indexPath, 'utf-8');
    cachedIndex = JSON.parse(indexData);
    return NextResponse.json({
      tagStats: cachedIndex!.tagStats,
      meta: cachedIndex!.meta,
    });
  } catch (error) {
    console.error('Failed to load tag index:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      path: path.join(process.cwd(), 'data', 'tag-index.json'),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: 'Failed to load tag index',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        endpoint: '/api/tags/stats'
      },
      { status: 500 }
    );
  }
}
