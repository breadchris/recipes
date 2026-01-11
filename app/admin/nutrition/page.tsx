'use client';

import { useState } from 'react';
import { NutritionCard } from '@/components/admin/NutritionCard';

export interface NutritionResult {
  id: string;
  fdcId: number;
  description: string;
  category: string;
  dataType: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  saturated_fat_g: number;
  portions: string;
}

export default function NutritionAdminPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NutritionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalFound, setTotalFound] = useState(0);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/nutrition/search?q=${encodeURIComponent(query)}&limit=50`
      );
      const data = await res.json();
      setResults(data.hits || []);
      setTotalFound(data.found || 0);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setTotalFound(0);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100 mb-2">Nutrition Search</h1>
        <p className="text-zinc-400">
          Search the USDA FoodData Central database for nutrition information.
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search foods (e.g., chicken breast, rice, olive oil)"
            className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3 bg-violet-600 text-white rounded-lg hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {totalFound > 0 && (
        <div className="mb-4 text-sm text-zinc-500">
          Showing {results.length} of {totalFound} results
        </div>
      )}

      {results.length === 0 && !loading && query && (
        <div className="text-center py-12 text-zinc-500">
          No foods found matching &quot;{query}&quot;
        </div>
      )}

      <div className="space-y-4">
        {results.map((food) => (
          <NutritionCard key={food.id} food={food} />
        ))}
      </div>
    </div>
  );
}
