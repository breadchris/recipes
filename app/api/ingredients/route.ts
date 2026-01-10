import { NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

// Cache the ingredient index in memory
let cachedIndex: any = null;

export async function GET() {
  if (cachedIndex) {
    return NextResponse.json(cachedIndex);
  }

  try {
    const indexPath = path.join(process.cwd(), 'data', 'ingredient-index.json');
    const indexData = fs.readFileSync(indexPath, 'utf-8');
    cachedIndex = JSON.parse(indexData);
    return NextResponse.json(cachedIndex);
  } catch (error) {
    console.error('Failed to load ingredient index:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      path: path.join(process.cwd(), 'data', 'ingredient-index.json'),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: 'Failed to load ingredient index',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        endpoint: '/api/ingredients'
      },
      { status: 500 }
    );
  }
}
