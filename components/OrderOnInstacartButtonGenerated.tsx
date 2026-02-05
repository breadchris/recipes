'use client';

import { useState } from 'react';
import type { GeneratedRecipe } from '@/lib/schemas/recipe';

interface OrderOnInstacartButtonGeneratedProps {
  recipe: Partial<GeneratedRecipe>;
  className?: string;
}

export default function OrderOnInstacartButtonGenerated({
  recipe,
  className = '',
}: OrderOnInstacartButtonGeneratedProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOrderOnInstacart = async () => {
    if (!recipe.ingredients || recipe.ingredients.length === 0) return;

    setIsLoading(true);
    setError(null);

    // Open window synchronously to avoid popup blocker on mobile Safari
    const newWindow = window.open('about:blank', '_blank');

    try {
      // Convert GeneratedRecipe ingredients to the format expected by the API
      const ingredients = recipe.ingredients.map((ing) => ({
        item: ing.item,
        quantity: ing.quantity,
        unit: ing.unit,
        notes: ing.notes ?? undefined,
      }));

      const response = await fetch('/api/instacart/create-shopping-list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: recipe.title || 'Generated Recipe',
          ingredients,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create Instacart shopping list');
      }

      const result = await response.json();

      if (result.products_link_url && newWindow) {
        newWindow.location.href = result.products_link_url;
      } else if (!newWindow && result.products_link_url) {
        // Fallback if window was still blocked
        window.location.href = result.products_link_url;
      } else {
        newWindow?.close();
        setError('Failed to generate Instacart link');
      }
    } catch (err) {
      console.error('Error ordering on Instacart:', err);
      newWindow?.close();
      setError(err instanceof Error ? err.message : 'Failed to create Instacart shopping list');
    } finally {
      setIsLoading(false);
    }
  };

  const hasIngredients = recipe.ingredients && recipe.ingredients.length > 0;

  return (
    <div className={className}>
      <button
        onClick={handleOrderOnInstacart}
        disabled={isLoading || !hasIngredients}
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
