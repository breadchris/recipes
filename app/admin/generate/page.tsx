'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { recipeSchema, type GeneratedRecipe } from '@/lib/schemas/recipe';
import { useRecipeProgressStore } from '@/lib/stores/recipeProgress';

function generateId(): string {
  return `gen-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Simplified RecipeDisplay for generated recipes
 */
function GeneratedRecipeDisplay({
  recipe,
  generatedId,
}: {
  recipe: Partial<GeneratedRecipe>;
  generatedId: string;
}) {
  const {
    toggleIngredient,
    toggleStep,
    isIngredientChecked,
    isStepCompleted,
    getProgress,
    resetProgress,
  } = useRecipeProgressStore();

  const progress = getProgress(generatedId, 0);
  const totalSteps = recipe.instructions?.length || 0;
  const completedSteps = progress.completedSteps.length;
  const hasProgress = progress.checkedIngredients.length > 0 || completedSteps > 0;

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`;
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-6 space-y-8">
      {/* Title and Description */}
      {recipe.title && (
        <div>
          <h2 className="text-2xl font-bold text-zinc-50 mb-2">{recipe.title}</h2>
          {recipe.description && (
            <p className="text-zinc-400">{recipe.description}</p>
          )}
        </div>
      )}

      {/* Metadata Badges */}
      {(recipe.prep_time_minutes || recipe.cook_time_minutes || recipe.servings || recipe.difficulty) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {recipe.prep_time_minutes && (
            <div className="px-3 py-2 rounded-lg bg-zinc-800 text-sm text-zinc-300">
              <span className="text-zinc-500">Prep</span> {formatTime(recipe.prep_time_minutes)}
            </div>
          )}
          {recipe.cook_time_minutes && (
            <div className="px-3 py-2 rounded-lg bg-zinc-800 text-sm text-zinc-300">
              <span className="text-zinc-500">Cook</span> {formatTime(recipe.cook_time_minutes)}
            </div>
          )}
          {recipe.servings && (
            <div className="px-3 py-2 rounded-lg bg-zinc-800 text-sm text-zinc-300">
              {recipe.servings} servings
            </div>
          )}
          {recipe.difficulty && (
            <div className="px-3 py-2 rounded-lg bg-zinc-800 text-sm text-zinc-300 capitalize">
              {recipe.difficulty}
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {(recipe.cuisine_type?.length || recipe.meal_type?.length || recipe.dietary_tags?.length) && (
        <div className="flex flex-wrap gap-2">
          {recipe.cuisine_type?.map((tag, i) => (
            <span key={`cuisine-${i}`} className="px-2 py-1 text-xs rounded-full bg-violet-900/50 text-violet-300">
              {tag}
            </span>
          ))}
          {recipe.meal_type?.map((tag, i) => (
            <span key={`meal-${i}`} className="px-2 py-1 text-xs rounded-full bg-blue-900/50 text-blue-300">
              {tag}
            </span>
          ))}
          {recipe.dietary_tags?.map((tag, i) => (
            <span key={`diet-${i}`} className="px-2 py-1 text-xs rounded-full bg-green-900/50 text-green-300">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Ingredients */}
      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-50 uppercase tracking-wide mb-3">
            Ingredients
          </h3>
          <ul className="space-y-2">
            {recipe.ingredients.map((ingredient, index) => {
              const isChecked = isIngredientChecked(generatedId, index, 0);
              return (
                <li
                  key={index}
                  onClick={() => toggleIngredient(generatedId, index, 0)}
                  className={`text-sm flex items-start cursor-pointer select-none transition-opacity ${
                    isChecked ? 'opacity-50' : 'opacity-100'
                  }`}
                >
                  <span
                    className={`mr-2 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      isChecked
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-zinc-600 text-transparent hover:border-zinc-500'
                    }`}
                  >
                    {isChecked && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className={isChecked ? 'line-through text-zinc-500' : 'text-zinc-300'}>
                    {ingredient.quantity && <span className="font-medium">{ingredient.quantity}</span>}
                    {ingredient.unit && <span className="font-medium"> {ingredient.unit}</span>}
                    {(ingredient.quantity || ingredient.unit) && ' '}
                    {ingredient.item}
                    {ingredient.notes && <span className="text-zinc-500"> ({ingredient.notes})</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Progress Bar */}
      {totalSteps > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500/70 transition-all duration-300"
              style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 whitespace-nowrap">
            {completedSteps}/{totalSteps}
          </span>
          {hasProgress && (
            <button
              onClick={() => resetProgress(generatedId, 0)}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* Instructions */}
      {recipe.instructions && recipe.instructions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-50 uppercase tracking-wide mb-3">
            Instructions
          </h3>
          <ol className="space-y-3">
            {recipe.instructions.map((instruction, index) => {
              const isCompleted = isStepCompleted(generatedId, instruction.step, 0);
              return (
                <li
                  key={instruction.step ?? index}
                  onClick={() => toggleStep(generatedId, instruction.step, 0)}
                  className={`text-sm flex items-start cursor-pointer select-none transition-opacity ${
                    isCompleted ? 'opacity-50' : 'opacity-100'
                  }`}
                >
                  <span
                    className={`mr-3 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : 'bg-zinc-700 text-zinc-50 hover:bg-zinc-600'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      instruction.step
                    )}
                  </span>
                  <div className="flex-1">
                    <span className={isCompleted ? 'line-through text-zinc-500' : 'text-zinc-300'}>
                      {instruction.text}
                    </span>
                    {/* Per-step ingredients */}
                    {instruction.keywords?.ingredients && instruction.keywords.ingredients.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {instruction.keywords.ingredients.map((ing, idx) => (
                          <li
                            key={`step-ing-${idx}`}
                            className="text-xs flex items-start text-zinc-400"
                          >
                            <span className="text-green-500 mr-1.5">•</span>
                            <span>
                              {ing.quantity && <span className="font-medium">{ing.quantity}</span>}
                              {ing.unit && <span className="font-medium"> {ing.unit}</span>}
                              {(ing.quantity || ing.unit) && ' '}
                              {ing.item}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {/* Measurements */}
                    {instruction.measurements && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {instruction.measurements.temperatures?.map((temp, idx) => (
                          <span
                            key={`temp-${idx}`}
                            className="px-1.5 py-0.5 text-xs rounded bg-orange-900/30 text-orange-300 border border-orange-800"
                          >
                            {temp}
                          </span>
                        ))}
                        {instruction.measurements.times?.map((time, idx) => (
                          <span
                            key={`time-${idx}`}
                            className="px-1.5 py-0.5 text-xs rounded bg-blue-900/30 text-blue-300 border border-blue-800"
                          >
                            {time}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Equipment */}
      {recipe.equipment && recipe.equipment.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-50 uppercase tracking-wide mb-3">
            Equipment
          </h3>
          <div className="flex flex-wrap gap-2">
            {recipe.equipment.map((item, index) => (
              <span key={index} className="text-sm text-zinc-300">
                {item}
                {index < recipe.equipment!.length - 1 && <span className="text-zinc-600 ml-2">•</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {recipe.tips && recipe.tips.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-50 uppercase tracking-wide mb-3">
            Tips
          </h3>
          <ul className="space-y-2">
            {recipe.tips.map((tip, index) => (
              <li key={index} className="text-sm text-zinc-300 flex">
                <span className="text-zinc-500 mr-2">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function GenerateRecipePage() {
  // Input state
  const [input, setInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Generation state
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Vercel AI SDK hook for streaming
  const { object: recipe, submit, isLoading, error, stop } = useObject({
    api: '/api/admin/generate-recipe',
    schema: recipeSchema,
  });

  // Fetch autocomplete suggestions
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoadingSuggestions(true);

    try {
      const res = await fetch(`/api/admin/autocomplete-recipe?q=${encodeURIComponent(query)}`, {
        signal: abortControllerRef.current.signal,
      });
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setShowSuggestions(true);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Autocomplete error:', err);
      }
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  // Debounced autocomplete
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!hasGenerated && input.length >= 2) {
      debounceRef.current = setTimeout(() => fetchSuggestions(input), 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input, hasGenerated, fetchSuggestions]);

  // Handle generation
  const handleGenerate = useCallback(() => {
    if (!input.trim() || isLoading) return;

    const newId = generateId();
    setGeneratedId(newId);
    setHasGenerated(true);
    setIsSaved(false);
    setSaveError(null);
    setShowSuggestions(false);

    submit({ prompt: input });
  }, [input, isLoading, submit]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!recipe || !generatedId || isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/admin/save-generated-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe,
          generatedId,
          prompt: input,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsSaved(true);
        setSavedRecipeId(data.id);
      } else {
        setSaveError(data.error || 'Failed to save recipe');
      }
    } catch (err) {
      setSaveError('Failed to save recipe');
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [recipe, generatedId, input, isSaving]);

  // Handle new recipe
  const handleNewRecipe = useCallback(() => {
    setInput('');
    setGeneratedId(null);
    setHasGenerated(false);
    setIsSaved(false);
    setSavedRecipeId(null);
    setSaveError(null);
    stop();
    inputRef.current?.focus();
  }, [stop]);

  // Select suggestion
  const handleSelectSuggestion = useCallback((suggestion: string) => {
    setInput(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleGenerate();
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    },
    [handleGenerate]
  );

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  return (
    <div className={`min-h-[calc(100vh-3.5rem)] flex flex-col ${hasGenerated ? 'items-center pt-8' : 'items-center justify-center'} px-4 sm:px-8`}>
      {/* Input Section */}
      <div className={`w-full max-w-2xl transition-all duration-300 ${hasGenerated ? 'mb-8' : ''}`}>
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && !hasGenerated && setShowSuggestions(true)}
            placeholder="What recipe would you like to create?"
            disabled={isLoading}
            className="w-full px-4 py-4 bg-zinc-800 border border-zinc-700 rounded-xl text-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />

          {/* Loading indicator for autocomplete */}
          {loadingSuggestions && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
            </div>
          )}

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && !hasGenerated && (
            <ul className="absolute z-10 w-full mt-2 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden shadow-xl">
              {suggestions.map((suggestion, i) => (
                <li
                  key={i}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  className="px-4 py-3 text-zinc-200 hover:bg-zinc-700 cursor-pointer transition-colors border-b border-zinc-700 last:border-b-0"
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Hint text */}
        {!hasGenerated && (
          <p className="text-center text-zinc-500 text-sm mt-3">
            Press Enter to generate • Start typing for suggestions
          </p>
        )}

        {/* Action buttons when generated */}
        {hasGenerated && (
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={handleNewRecipe}
              className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
            >
              New Recipe
            </button>
            {recipe && !isSaved && (
              <button
                onClick={handleSave}
                disabled={isSaving || !recipe.title}
                className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save Recipe'}
              </button>
            )}
            {isSaved && (
              <div className="flex items-center gap-2">
                <span className="px-4 py-2 text-sm text-green-400 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Saved
                </span>
                {savedRecipeId && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(savedRecipeId);
                    }}
                    className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded transition-colors font-mono"
                    title="Click to copy ID"
                  >
                    ID: {savedRecipeId.slice(0, 8)}...
                  </button>
                )}
              </div>
            )}
            {saveError && (
              <span className="text-sm text-red-400">{saveError}</span>
            )}
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && !recipe && (
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-zinc-600 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-zinc-400">Generating recipe...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="w-full max-w-2xl bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
          <p className="font-medium">Error generating recipe</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      )}

      {/* Recipe Display */}
      {recipe && generatedId && (
        <div className="w-full max-w-4xl pb-8">
          {isLoading && (
            <div className="mb-4 flex items-center gap-2 text-zinc-400">
              <div className="w-4 h-4 border-2 border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
              <span className="text-sm">Generating...</span>
            </div>
          )}
          <GeneratedRecipeDisplay recipe={recipe as Partial<GeneratedRecipe>} generatedId={generatedId} />
        </div>
      )}
    </div>
  );
}
