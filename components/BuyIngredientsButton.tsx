'use client';

import { useState } from 'react';
import type { Ingredient } from '@/lib/types';

interface BuyIngredientsButtonProps {
  ingredients: Ingredient[];
  className?: string;
}

interface SearchResult {
  cartUrl: string | null;
  matchedCount: number;
  unmatchedCount: number;
  matched: Array<{
    ingredient: string;
    product: {
      asin: string;
      title: string;
      price?: string;
    };
  }>;
  unmatched: string[];
}

export default function BuyIngredientsButton({
  ingredients,
  className = '',
}: BuyIngredientsButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBuyIngredients = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/amazon/search-ingredients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ingredients }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to search ingredients');
      }

      const result: SearchResult = await response.json();

      if (result.cartUrl) {
        // Open Amazon cart in a new tab
        window.open(result.cartUrl, '_blank', 'noopener,noreferrer');

        if (result.unmatchedCount > 0) {
          setError(
            `${result.matchedCount} items added. ${result.unmatchedCount} not found: ${result.unmatched.slice(0, 3).join(', ')}${result.unmatched.length > 3 ? '...' : ''}`
          );
        }
      } else {
        setError('No products found for these ingredients');
      }
    } catch (err) {
      console.error('Error buying ingredients:', err);
      setError(err instanceof Error ? err.message : 'Failed to search ingredients');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        onClick={handleBuyIngredients}
        disabled={isLoading || ingredients.length === 0}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-amber-500 text-amber-600 dark:text-amber-400 hover:bg-amber-500 hover:text-white dark:hover:bg-amber-500 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Buy ingredients on Amazon"
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Searching...
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
              />
            </svg>
            Buy on Amazon
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          {error}
        </p>
      )}
    </div>
  );
}
