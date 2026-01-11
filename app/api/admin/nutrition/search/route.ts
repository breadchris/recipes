import { NextRequest, NextResponse } from 'next/server';
import { typesenseAdminClient } from '@/lib/typesense';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '';
  const category = searchParams.get('category');
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!query.trim()) {
    return NextResponse.json({ hits: [], found: 0 });
  }

  try {
    const typesenseParams: Record<string, unknown> = {
      q: query,
      query_by: 'description',
      per_page: limit,
      num_typos: 2,
      prefix: true,
      // Prioritize whole/raw ingredients over processed foods
      sort_by: 'is_raw:desc,_text_match:desc',
    };

    if (category) {
      typesenseParams.filter_by = `category:=${category}`;
    }

    const results = await typesenseAdminClient
      .collections('nutrition')
      .documents()
      .search(typesenseParams);

    return NextResponse.json({
      hits: results.hits?.map((h) => h.document) || [],
      found: results.found,
    });
  } catch (error) {
    console.error('Nutrition search error:', error);
    return NextResponse.json(
      { error: 'Search failed', hits: [], found: 0 },
      { status: 500 }
    );
  }
}
