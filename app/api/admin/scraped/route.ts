import { NextRequest, NextResponse } from 'next/server';
import { typesenseClient, SCRAPED_COLLECTION_NAME } from '@/lib/typesense';

export interface ScrapedRecipeResult {
  id: string;
  name: string;
  source: string;
  source_domain: string;
  image: string;
  directions: string;
  ingredients: string[];
  tags: string[];
  video: string;
  yield: string;
  time_minutes: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q') || '*';
  const page = parseInt(searchParams.get('page') || '1');
  const perPage = parseInt(searchParams.get('per_page') || '50');
  const sourceDomain = searchParams.get('source');

  try {
    let filterBy = '';
    if (sourceDomain) {
      filterBy = `source_domain:=${sourceDomain}`;
    }

    const searchResult = await typesenseClient
      .collections(SCRAPED_COLLECTION_NAME)
      .documents()
      .search({
        q: query,
        query_by: 'name',
        filter_by: filterBy || undefined,
        sort_by: query === '*' ? 'name:asc' : '_text_match:desc',
        page,
        per_page: perPage,
        facet_by: 'source_domain',
        max_facet_values: 20,
      });

    const results: ScrapedRecipeResult[] = (searchResult.hits || []).map((hit) => {
      const doc = hit.document as Record<string, unknown>;
      return {
        id: doc.id as string,
        name: doc.name as string,
        source: doc.source as string,
        source_domain: doc.source_domain as string,
        image: doc.image as string,
        directions: doc.directions as string,
        ingredients: doc.ingredients as string[],
        tags: doc.tags as string[],
        video: doc.video as string,
        yield: doc.yield as string,
        time_minutes: doc.time_minutes as number,
      };
    });

    const facets = searchResult.facet_counts?.reduce(
      (acc, facet) => {
        acc[facet.field_name] = facet.counts.map((c) => ({
          value: c.value,
          count: c.count,
        }));
        return acc;
      },
      {} as Record<string, { value: string; count: number }[]>
    );

    return NextResponse.json({
      results,
      total: searchResult.found,
      page,
      per_page: perPage,
      facets,
    });
  } catch (error) {
    console.error('Scraped recipe search error:', error);
    return NextResponse.json(
      { error: 'Failed to search scraped recipes' },
      { status: 500 }
    );
  }
}
