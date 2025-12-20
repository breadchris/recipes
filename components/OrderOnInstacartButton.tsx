'use client';

import { useState } from 'react';
import type { Recipe } from '@/lib/types';

interface OrderOnInstacartButtonProps {
  recipe: Recipe;
  videoId?: string;
  className?: string;
}

export default function OrderOnInstacartButton({
  recipe,
  videoId,
  className = '',
}: OrderOnInstacartButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOrderOnInstacart = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/instacart/create-recipe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ recipe, videoId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create Instacart recipe page');
      }

      const result = await response.json();

      if (result.products_link_url) {
        window.open(result.products_link_url, '_blank', 'noopener,noreferrer');
      } else {
        setError('Failed to generate Instacart link');
      }
    } catch (err) {
      console.error('Error ordering on Instacart:', err);
      setError(err instanceof Error ? err.message : 'Failed to create Instacart recipe page');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        onClick={handleOrderOnInstacart}
        disabled={isLoading || !recipe.ingredients || recipe.ingredients.length === 0}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-green-500 text-green-600 dark:text-green-400 hover:bg-green-500 hover:text-white dark:hover:bg-green-500 dark:hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Get ingredients on Instacart"
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
            Loading...
          </>
        ) : (
          <>
            <img
              src="/instacart-carrot.svg"
              alt="Instacart"
              className="h-4 w-4"
            />
            Get ingredients
          </>
        )}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
