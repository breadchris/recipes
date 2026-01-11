import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// In-memory cache with TTL
const cache = new Map<string, { suggestions: string[]; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Clean up expired cache entries periodically
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of cache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const cacheKey = query.toLowerCase().trim();

  // Check cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ suggestions: cached.suggestions, cached: true });
  }

  // Clean up old entries occasionally
  if (cache.size > 100) {
    cleanupCache();
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const client = new OpenAI({ apiKey });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Faster and cheaper for autocomplete
      messages: [
        {
          role: 'system',
          content: `Generate 5 creative and appetizing recipe title suggestions based on the user's partial input.
The suggestions should be:
- Complete recipe titles (e.g., "Honey Garlic Glazed Salmon" not just "Salmon")
- Varied in cooking style and cuisine
- Practical and achievable for home cooks
Return a JSON object with a "suggestions" array containing exactly 5 strings.`,
        },
        { role: 'user', content: query },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 200,
      temperature: 0.8, // Some creativity for variety
    });

    const content = response.choices[0]?.message?.content || '{"suggestions":[]}';
    let suggestions: string[] = [];

    try {
      const parsed = JSON.parse(content);
      suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 5) : [];
    } catch {
      console.error('Failed to parse autocomplete response:', content);
      suggestions = [];
    }

    // Cache the result
    cache.set(cacheKey, { suggestions, timestamp: Date.now() });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error('Error fetching autocomplete suggestions:', error);
    return NextResponse.json({ suggestions: [] });
  }
}
