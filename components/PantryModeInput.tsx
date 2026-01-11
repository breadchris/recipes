'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { VideoWithChannel } from '@/lib/types';

interface IngredientIndex {
  ingredients: string[];
  counts: Record<string, number>;
  categories: {
    proteins: string[];
    vegetables: string[];
    pantryStaples: string[];
    other: string[];
  };
}

interface PantryModeInputProps {
  onResults: (results: VideoWithChannel[], ingredients: string[]) => void;
}

export function PantryModeInput({ onResults }: PantryModeInputProps) {
  const [ingredientIndex, setIngredientIndex] = useState<IngredientIndex | null>(null);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Load ingredient index on mount
  useEffect(() => {
    fetch('/api/ingredients')
      .then((res) => res.json())
      .then((data) => setIngredientIndex(data))
      .catch((err) => console.error('Failed to load ingredient index:', err));
  }, []);

  // Search for matching recipes when ingredients change
  useEffect(() => {
    if (selectedIngredients.length === 0) {
      onResults([], []);
      return;
    }

    setIsSearching(true);
    const searchParams = new URLSearchParams();
    searchParams.set('ingredients', selectedIngredients.join(','));

    fetch(`/api/pantry-search?${searchParams}`)
      .then((res) => res.json())
      .then((data) => {
        onResults(data.results || [], selectedIngredients);
      })
      .catch((err) => {
        console.error('Pantry search failed:', err);
        onResults([], selectedIngredients);
      })
      .finally(() => setIsSearching(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIngredients.join(',')]);

  // Filter suggestions based on input
  useEffect(() => {
    if (!ingredientIndex || !inputValue.trim()) {
      setSuggestions([]);
      return;
    }

    const query = inputValue.toLowerCase().trim();
    const filtered = ingredientIndex.ingredients
      .filter(
        (ing) =>
          ing.includes(query) &&
          !selectedIngredients.includes(ing)
      )
      .slice(0, 8); // Limit to 8 suggestions

    setSuggestions(filtered);
    setHighlightedIndex(-1);
  }, [inputValue, ingredientIndex, selectedIngredients]);

  // Handle adding an ingredient
  const addIngredient = useCallback((ingredient: string) => {
    const normalized = ingredient.toLowerCase().trim();
    if (normalized && !selectedIngredients.includes(normalized)) {
      setSelectedIngredients((prev) => [...prev, normalized]);
    }
    setInputValue('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, [selectedIngredients]);

  // Handle removing an ingredient
  const removeIngredient = (ingredient: string) => {
    setSelectedIngredients((prev) => prev.filter((i) => i !== ingredient));
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && suggestions[highlightedIndex]) {
        addIngredient(suggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        addIngredient(inputValue);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    } else if (e.key === 'Backspace' && !inputValue && selectedIngredients.length > 0) {
      // Remove last ingredient on backspace if input is empty
      removeIngredient(selectedIngredients[selectedIngredients.length - 1]);
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="w-full">
      {/* Selected ingredients */}
      <div className="flex flex-wrap gap-2 mb-3 min-h-[32px]">
        {selectedIngredients.map((ingredient) => (
          <span
            key={ingredient}
            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded-full text-sm"
          >
            {ingredient}
            <button
              onClick={() => removeIngredient(ingredient)}
              className="ml-1 hover:text-blue-600 dark:hover:text-blue-300"
            >
              ×
            </button>
          </span>
        ))}
        {isSearching && (
          <span className="text-sm text-zinc-500 dark:text-zinc-400 py-1">
            Searching...
          </span>
        )}
      </div>

      {/* Input with autocomplete */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedIngredients.length === 0
              ? "Type an ingredient (e.g., chicken, garlic)..."
              : "Add another ingredient..."
          }
          className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
        />

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            ref={suggestionsRef}
            className="absolute z-20 w-full mt-1 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-300 dark:border-zinc-700 shadow-lg max-h-64 overflow-y-auto"
          >
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                onClick={() => addIngredient(suggestion)}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors ${
                  index === highlightedIndex
                    ? 'bg-zinc-100 dark:bg-zinc-700'
                    : ''
                }`}
              >
                <span className="text-zinc-900 dark:text-zinc-100">
                  {suggestion}
                </span>
                {ingredientIndex && (
                  <span className="ml-2 text-zinc-500 dark:text-zinc-400 text-xs">
                    ({ingredientIndex.counts[suggestion]} recipes)
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick add suggestions for common ingredients */}
      {selectedIngredients.length === 0 && ingredientIndex && (
        <div className="mt-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
            Popular ingredients:
          </p>
          <div className="flex flex-wrap gap-2">
            {['chicken', 'garlic', 'onion', 'eggs', 'butter', 'pasta', 'rice', 'beef']
              .filter((ing) => ingredientIndex.ingredients.includes(ing))
              .map((ingredient) => (
                <button
                  key={ingredient}
                  onClick={() => addIngredient(ingredient)}
                  className="px-3 py-1 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  + {ingredient}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
