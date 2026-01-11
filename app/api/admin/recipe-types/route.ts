import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * GET /api/admin/recipe-types
 * Returns the recipe type groups data for browsing
 */
export async function GET() {
  try {
    const dataPath = path.join(process.cwd(), 'data', 'recipe-type-groups.json');
    const data = await fs.readFile(dataPath, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    console.error('Error loading recipe types:', error);
    return NextResponse.json(
      { error: 'Failed to load recipe types' },
      { status: 500 }
    );
  }
}
