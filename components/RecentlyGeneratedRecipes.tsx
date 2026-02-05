'use client';

import { useState, useEffect, useRef } from 'react';
import type { GeneratedRecipeRecord } from '@/lib/types/generated-recipe';

interface RecentlyGeneratedRecipesProps {
  /** Whether to show the component (hide when user is typing) */
  visible: boolean;
  /** Callback when a recipe is selected */
  onSelectRecipe: (record: GeneratedRecipeRecord) => void;
}

export function RecentlyGeneratedRecipes({
  visible,
  onSelectRecipe,
}: RecentlyGeneratedRecipesProps) {
  const [recipes, setRecipes] = useState<GeneratedRecipeRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const cycleIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch recent recipes on mount
  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const res = await fetch('/api/save-generated-recipe?limit=5');
        const data = await res.json();
        if (data.recipes && data.recipes.length > 0) {
          setRecipes(data.recipes);
        }
      } catch (err) {
        console.error('Error fetching recent recipes:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecipes();
  }, []);

  // Cycling animation
  useEffect(() => {
    if (!visible || recipes.length <= 1) {
      if (cycleIntervalRef.current) {
        clearInterval(cycleIntervalRef.current);
        cycleIntervalRef.current = null;
      }
      return;
    }

    const runCycle = () => {
      // Start fade out
      setIsFading(true);

      // After fade completes, change recipe and fade in
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % recipes.length);
        setIsFading(false);
      }, 500);
    };

    // Start cycling after initial delay
    const initialTimeout = setTimeout(() => {
      runCycle();
      cycleIntervalRef.current = setInterval(runCycle, 7000);
    }, 5000);

    return () => {
      clearTimeout(initialTimeout);
      if (cycleIntervalRef.current) {
        clearInterval(cycleIntervalRef.current);
        cycleIntervalRef.current = null;
      }
    };
  }, [visible, recipes.length]);

  const currentRecipe = recipes[currentIndex];
  const recipe = currentRecipe?.metadata?.recipe;
  const shouldShow = visible && !isLoading && recipes.length > 0 && recipe;

  return (
    <div
      className={`mt-6 text-center transition-all duration-500 overflow-hidden ${
        shouldShow
          ? 'opacity-100 max-h-24'
          : 'opacity-0 max-h-0 pointer-events-none'
      }`}
    >
      <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">
        Recently created
      </p>
      <button
        onClick={() => onSelectRecipe(currentRecipe)}
        className={`group transition-opacity duration-500 max-w-md mx-auto block ${
          isFading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <span className="text-sm text-zinc-600 dark:text-zinc-400 group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors">
          {recipe?.title}
        </span>
        {recipe?.description && (
          <span className="block text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-1">
            {recipe?.description}
          </span>
        )}
      </button>
    </div>
  );
}
