import { NextResponse } from 'next/server';
import { typesenseClient, TAG_STATS_COLLECTION_NAME } from '@/lib/typesense';

interface TagStatsResponse {
  tagStats: Record<string, number>;
  meta: {
    totalTags: number;
  };
}

// Cache the tag stats in memory
let cachedStats: TagStatsResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 3600000; // 1 hour in milliseconds

async function fetchTagStats(): Promise<TagStatsResponse> {
  // Check if cache is still valid
  if (cachedStats && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedStats;
  }

  try {
    // Fetch all tags from Typesense
    const searchResult = await typesenseClient
      .collections(TAG_STATS_COLLECTION_NAME)
      .documents()
      .search({
        q: '*',
        query_by: 'tag',
        per_page: 250,
        sort_by: 'count:desc',
      });

    // Build tag stats object
    const tagStats: Record<string, number> = {};
    for (const hit of searchResult.hits || []) {
      const doc = hit.document as { tag: string; count: number };
      tagStats[doc.tag] = doc.count;
    }

    const stats: TagStatsResponse = {
      tagStats,
      meta: {
        totalTags: Object.keys(tagStats).length,
      },
    };

    // Update cache
    cachedStats = stats;
    cacheTimestamp = Date.now();

    return stats;
  } catch (error) {
    console.error('Error fetching tag stats from Typesense:', error);
    throw error;
  }
}

export async function GET() {
  try {
    const stats = await fetchTagStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to load tag stats:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      {
        error: 'Failed to load tag stats',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        endpoint: '/api/tags/stats'
      },
      { status: 500 }
    );
  }
}
