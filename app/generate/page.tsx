'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { experimental_useObject as useObject } from '@ai-sdk/react';
import { recipeSchema, type GeneratedRecipe } from '@/lib/schemas/recipe';
import { useRecipeProgressStore } from '@/lib/stores/recipeProgress';
import { useTimerStore } from '@/lib/stores/timerStore';
import { parseTimeString } from '@/lib/parseTimeString';
import RecipeTimer from '@/components/RecipeTimer';
import OrderOnInstacartButtonGenerated from '@/components/OrderOnInstacartButtonGenerated';
import { getRandomAdjective, getRandomCategory, getRandomWaitingPhrase, getRandomExampleQuestion } from '@/lib/recipe-suggestions';
import { RecentlyGeneratedRecipes } from '@/components/RecentlyGeneratedRecipes';
import type { GeneratedRecipeRecord } from '@/lib/types/generated-recipe';

function generateId(): string {
  return `gen-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Simplified RecipeDisplay for generated recipes
 */
export function GeneratedRecipeDisplay({
  recipe,
  generatedId,
  isLoading = false,
}: {
  recipe: Partial<GeneratedRecipe>;
  generatedId: string;
  isLoading?: boolean;
}) {
  const {
    toggleIngredient,
    toggleStep,
    isIngredientChecked,
    isStepCompleted,
    getProgress,
    resetProgress,
  } = useRecipeProgressStore();
  const startTimer = useTimerStore((state) => state.startTimer);

  const handleTimeClick = (e: React.MouseEvent, timeString: string, stepNumber: number) => {
    e.stopPropagation();
    const seconds = parseTimeString(timeString);
    if (seconds) {
      startTimer(stepNumber, 0, timeString, seconds);
    }
  };

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
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-6 space-y-8">
      {/* Title and Description */}
      {recipe.title && (
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mb-2">{recipe.title}</h2>
          {recipe.description && (
            <p className="text-zinc-600 dark:text-zinc-400">{recipe.description}</p>
          )}
        </div>
      )}

      {/* Metadata Badges */}
      {(recipe.prep_time_minutes || recipe.cook_time_minutes || recipe.servings || recipe.difficulty) && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {recipe.prep_time_minutes && (
            <div className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="text-zinc-500 dark:text-zinc-400">Prep</span> {formatTime(recipe.prep_time_minutes)}
            </div>
          )}
          {recipe.cook_time_minutes && (
            <div className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300">
              <span className="text-zinc-500 dark:text-zinc-400">Cook</span> {formatTime(recipe.cook_time_minutes)}
            </div>
          )}
          {recipe.servings && (
            <div className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300">
              {recipe.servings} servings
            </div>
          )}
          {recipe.difficulty && (
            <div className="px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-700 dark:text-zinc-300 capitalize">
              {recipe.difficulty}
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {(recipe.cuisine_type?.length || recipe.meal_type?.length || recipe.dietary_tags?.length) && (
        <div className="flex flex-wrap gap-2">
          {recipe.cuisine_type?.map((tag, i) => (
            <span key={`cuisine-${i}`} className="px-2 py-1 text-xs rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">
              {tag}
            </span>
          ))}
          {recipe.meal_type?.map((tag, i) => (
            <span key={`meal-${i}`} className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
              {tag}
            </span>
          ))}
          {recipe.dietary_tags?.map((tag, i) => (
            <span key={`diet-${i}`} className="px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Ingredients */}
      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide">
              Ingredients
            </h3>
            {!isLoading && recipe.title && (
              <OrderOnInstacartButtonGenerated recipe={recipe} />
            )}
          </div>
          {(() => {
            // Define category order (typical grocery store layout)
            const categoryOrder = [
              'Produce',
              'Bakery',
              'Meat & Seafood',
              'Dairy & Eggs',
              'Refrigerated',
              'Frozen',
              'Pantry',
              'Spices & Seasonings',
              'Oils & Vinegars',
              'Condiments & Sauces',
            ];

            // Group ingredients by category, preserving original indices
            const ingredientsWithIndex = recipe.ingredients!.map((ing, idx) => ({ ...ing, originalIndex: idx }));
            const grouped = ingredientsWithIndex.reduce((acc, ing) => {
              const cat = ing.category || 'Other';
              if (!acc[cat]) acc[cat] = [];
              acc[cat].push(ing);
              return acc;
            }, {} as Record<string, typeof ingredientsWithIndex>);

            // Sort categories by defined order, putting unknown categories at the end
            const sortedCategories = Object.keys(grouped).sort((a, b) => {
              const aIdx = categoryOrder.indexOf(a);
              const bIdx = categoryOrder.indexOf(b);
              if (aIdx === -1 && bIdx === -1) return a.localeCompare(b);
              if (aIdx === -1) return 1;
              if (bIdx === -1) return -1;
              return aIdx - bIdx;
            });

            return (
              <div className="space-y-4">
                {sortedCategories.map((category) => (
                  <div key={category}>
                    <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
                      {category}
                    </h4>
                    <ul className="space-y-2">
                      {grouped[category].map((ingredient) => {
                        const isChecked = isIngredientChecked(generatedId, ingredient.originalIndex, 0);
                        return (
                          <li
                            key={ingredient.originalIndex}
                            onClick={() => toggleIngredient(generatedId, ingredient.originalIndex, 0)}
                            className={`text-sm flex items-start cursor-pointer select-none transition-opacity ${
                              isChecked ? 'opacity-50' : 'opacity-100'
                            }`}
                          >
                            <span
                              className={`mr-2 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                isChecked
                                  ? 'bg-green-500 dark:bg-green-400 border-green-500 dark:border-green-400 text-white'
                                  : 'border-zinc-300 dark:border-zinc-600 text-transparent hover:border-zinc-400 dark:hover:border-zinc-500'
                              }`}
                            >
                              {isChecked && (
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </span>
                            <span className={isChecked ? 'line-through text-zinc-500 dark:text-zinc-500' : 'text-zinc-700 dark:text-zinc-300'}>
                              {ingredient.quantity && <span className="font-medium">{ingredient.quantity}</span>}
                              {ingredient.unit && <span className="font-medium"> {ingredient.unit}</span>}
                              {(ingredient.quantity || ingredient.unit) && ' '}
                              {ingredient.item}
                              {ingredient.notes && <span className="text-zinc-500 dark:text-zinc-400"> ({ingredient.notes})</span>}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Progress Bar */}
      {totalSteps > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500/70 dark:bg-green-400/70 transition-all duration-300"
              style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500 dark:text-zinc-500 whitespace-nowrap">
            {completedSteps}/{totalSteps}
          </span>
          {hasProgress && (
            <button
              onClick={() => resetProgress(generatedId, 0)}
              className="text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      )}

      {/* Instructions */}
      {recipe.instructions && recipe.instructions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide mb-3">
            Instructions
          </h3>
          <ol className="space-y-3">
            {recipe.instructions.map((instruction, index) => {
              const isCompleted = isStepCompleted(generatedId, instruction.step, 0);
              return (
                <li
                  key={instruction.step ?? index}
                  className={`text-sm flex items-start select-none transition-opacity ${
                    isCompleted ? 'opacity-50' : 'opacity-100'
                  }`}
                >
                  <span
                    onClick={() => toggleStep(generatedId, instruction.step, 0)}
                    className={`mr-3 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors cursor-pointer ${
                      isCompleted
                        ? 'bg-green-500 dark:bg-green-400 text-white'
                        : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-300 dark:hover:bg-zinc-600'
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
                    <span
                      onClick={() => toggleStep(generatedId, instruction.step, 0)}
                      className={`cursor-pointer ${isCompleted ? 'line-through text-zinc-500 dark:text-zinc-500' : 'text-zinc-700 dark:text-zinc-300'}`}
                    >
                      {instruction.text}
                    </span>
                    {/* Per-step ingredients */}
                    {instruction.keywords?.ingredients && instruction.keywords.ingredients.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {instruction.keywords.ingredients.map((ing, idx) => {
                          // Find matching ingredient in main list for linked toggling
                          const matchingIndex = ing?.item ? (recipe.ingredients?.findIndex(
                            recipeIng => recipeIng.item?.toLowerCase() === ing.item.toLowerCase()
                          ) ?? -1) : -1;
                          const isChecked = matchingIndex !== -1 && isIngredientChecked(generatedId, matchingIndex, 0);
                          return (
                            <li
                              key={`step-ing-${idx}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (matchingIndex !== -1) {
                                  toggleIngredient(generatedId, matchingIndex, 0);
                                }
                              }}
                              className={`text-xs flex items-start cursor-pointer transition-opacity ${isChecked ? 'opacity-50' : 'opacity-100'}`}
                            >
                              <span className={`mr-1.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                isChecked
                                  ? 'bg-green-500 dark:bg-green-400 border-green-500 dark:border-green-400 text-white'
                                  : 'border-zinc-300 dark:border-zinc-600 text-transparent hover:border-zinc-400 dark:hover:border-zinc-500'
                              }`}>
                                {isChecked && (
                                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </span>
                              <span className={isChecked ? 'line-through text-zinc-500 dark:text-zinc-500' : 'text-zinc-600 dark:text-zinc-400'}>
                                {ing.quantity && <span className="font-medium">{ing.quantity}</span>}
                                {ing.unit && <span className="font-medium"> {ing.unit}</span>}
                                {(ing.quantity || ing.unit) && ' '}
                                {ing.item}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {/* Measurements */}
                    {instruction.measurements && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {instruction.measurements.temperatures?.map((temp, idx) => (
                          <span
                            key={`temp-${idx}`}
                            className="px-1.5 py-0.5 text-xs rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800"
                          >
                            {temp}
                          </span>
                        ))}
                        {instruction.measurements.times?.map((time, idx) => (
                          <button
                            key={`time-${idx}`}
                            onClick={(e) => handleTimeClick(e, time, instruction.step)}
                            className="px-1.5 py-0.5 text-xs rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-200 dark:hover:bg-blue-800/50 hover:scale-105 transition-all cursor-pointer"
                            title="Click to start timer"
                          >
                            {time}
                          </button>
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
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide mb-3">
            Equipment
          </h3>
          <div className="flex flex-wrap gap-2">
            {recipe.equipment.map((item, index) => (
              <span key={index} className="text-sm text-zinc-700 dark:text-zinc-300">
                {item}
                {index < recipe.equipment!.length - 1 && <span className="text-zinc-400 dark:text-zinc-600 ml-2">•</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      {recipe.tips && recipe.tips.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide mb-3">
            Tips
          </h3>
          <ul className="space-y-2">
            {recipe.tips.map((tip, index) => (
              <li key={index} className="text-sm text-zinc-700 dark:text-zinc-300 flex">
                <span className="text-zinc-400 dark:text-zinc-500 mr-2">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Reusable recipe generator component
 * Can be embedded in other pages or used standalone
 */
export function RecipeGenerator({ embedded = false, rotatingPlaceholders = false, initialRecipeData }: { embedded?: boolean; rotatingPlaceholders?: boolean; initialRecipeData?: { recipe: GeneratedRecipe; generatedId: string; savedId: string; prompt?: string } }) {
  // Input state
  const [input, setInput] = useState(initialRecipeData?.prompt || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Animated placeholder state
  const [adjective, setAdjective] = useState(() => getRandomAdjective());
  const [category, setCategory] = useState(() => getRandomCategory());
  const [adjectiveFading, setAdjectiveFading] = useState(false);
  const [categoryFading, setCategoryFading] = useState(false);
  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Loading state rotating phrases
  const [waitingPhrase, setWaitingPhrase] = useState(() => getRandomWaitingPhrase());
  const [waitingPhraseFading, setWaitingPhraseFading] = useState(false);
  const waitingPhraseIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generation state
  const [generatedId, setGeneratedId] = useState<string | null>(initialRecipeData?.generatedId || null);
  const [hasGenerated, setHasGenerated] = useState(!!initialRecipeData);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(!!initialRecipeData);
  const [savedRecipeId, setSavedRecipeId] = useState<string | null>(initialRecipeData?.savedId || null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Modification state
  const [modificationInput, setModificationInput] = useState('');
  const [currentRecipe, setCurrentRecipe] = useState<Partial<GeneratedRecipe> | null>(initialRecipeData?.recipe || null);
  const [inputHidden, setInputHidden] = useState(false);

  // Preloaded recipe state (for viewing saved recipes without regenerating)
  const [preloadedRecipe, setPreloadedRecipe] = useState<GeneratedRecipe | null>(initialRecipeData?.recipe || null);

  // Recipe fade-in animation state
  const [recipeVisible, setRecipeVisible] = useState(false);

  // Refs
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-save refs
  const shouldAutoSaveRef = useRef(false);
  const shouldAutoSaveModRef = useRef(false);

  // Vercel AI SDK hook for streaming generation
  const { object: recipe, submit, isLoading, error, stop } = useObject({
    api: '/api/generate-recipe',
    schema: recipeSchema,
  });

  // Vercel AI SDK hook for streaming modifications
  const {
    object: modifiedRecipe,
    submit: submitModification,
    isLoading: isModifying,
  } = useObject({
    api: '/api/generate-recipe/modify',
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
      const res = await fetch(`/api/autocomplete-recipe?q=${encodeURIComponent(query)}`, {
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

  // Animated placeholder effect with staggered timing
  useEffect(() => {
    if (!rotatingPlaceholders || input.length > 0 || hasGenerated) {
      // Clear interval when not needed
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
      return;
    }

    // Animation cycle: 6 seconds total
    // 0s: Start adjective fade out
    // 0.3s: Change adjective, fade in
    // 1.5s: Start category fade out
    // 1.8s: Change category, fade in
    // 6s: Repeat
    const runAnimationCycle = () => {
      // Fade out adjective
      setAdjectiveFading(true);

      setTimeout(() => {
        setAdjective(getRandomAdjective());
        setAdjectiveFading(false);
      }, 300);

      // Fade out category after delay
      setTimeout(() => {
        setCategoryFading(true);

        setTimeout(() => {
          setCategory(getRandomCategory());
          setCategoryFading(false);
        }, 300);
      }, 1500);
    };

    // Run first cycle after a short delay
    const initialTimeout = setTimeout(runAnimationCycle, 2000);

    // Then repeat every 6 seconds
    animationIntervalRef.current = setInterval(runAnimationCycle, 6000);

    return () => {
      clearTimeout(initialTimeout);
      if (animationIntervalRef.current) {
        clearInterval(animationIntervalRef.current);
        animationIntervalRef.current = null;
      }
    };
  }, [rotatingPlaceholders, input.length, hasGenerated]);

  // Animated waiting phrase effect for loading state
  useEffect(() => {
    // Show rotating phrases only when loading and no recipe content is showing yet
    const hasRecipeContent = currentRecipe || preloadedRecipe || recipe;
    const shouldAnimate = isLoading && !hasRecipeContent;

    if (!shouldAnimate) {
      // Clear interval when not loading
      if (waitingPhraseIntervalRef.current) {
        clearInterval(waitingPhraseIntervalRef.current);
        waitingPhraseIntervalRef.current = null;
      }
      return;
    }

    // Animation cycle: 2.5 seconds
    const runAnimationCycle = () => {
      setWaitingPhraseFading(true);

      setTimeout(() => {
        setWaitingPhrase(getRandomWaitingPhrase());
        setWaitingPhraseFading(false);
      }, 300);
    };

    // Start first rotation after a delay
    const initialTimeout = setTimeout(runAnimationCycle, 2000);

    // Then repeat every 2.5 seconds
    waitingPhraseIntervalRef.current = setInterval(runAnimationCycle, 2500);

    return () => {
      clearTimeout(initialTimeout);
      if (waitingPhraseIntervalRef.current) {
        clearInterval(waitingPhraseIntervalRef.current);
        waitingPhraseIntervalRef.current = null;
      }
    };
  }, [isLoading, currentRecipe, preloadedRecipe, recipe]);

  // Handle generation
  const handleGenerate = useCallback((promptOverride?: string) => {
    const prompt = promptOverride ?? input;
    if (!prompt.trim() || isLoading) return;

    const newId = generateId();
    setGeneratedId(newId);
    setHasGenerated(true);
    setIsSaved(false);
    setSaveError(null);
    setShowSuggestions(false);
    setPreloadedRecipe(null); // Clear any preloaded recipe
    if (promptOverride) setInput(promptOverride);

    shouldAutoSaveRef.current = true;
    submit({ prompt });
  }, [input, isLoading, submit]);

  // Handle selecting a recently generated recipe
  const handleSelectRecentRecipe = useCallback((record: GeneratedRecipeRecord) => {
    const { recipe, generated_id, prompt } = record.metadata;
    setPreloadedRecipe(recipe as GeneratedRecipe);
    setGeneratedId(generated_id);
    setHasGenerated(true);
    setIsSaved(true); // It's already saved
    setSavedRecipeId(record.id);
    if (prompt) setInput(prompt);
  }, []);

  // Handle save
  const handleSave = useCallback(async () => {
    const recipeToSave = currentRecipe || recipe;
    if (!recipeToSave || !generatedId || isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const res = await fetch('/api/save-generated-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe: recipeToSave,
          generatedId,
          prompt: input,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsSaved(true);
        setSavedRecipeId(data.id);
        window.history.replaceState(null, '', `/generate/${data.id}`);
      } else {
        setSaveError(data.error || 'Failed to save recipe');
      }
    } catch (err) {
      setSaveError('Failed to save recipe');
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  }, [currentRecipe, recipe, generatedId, input, isSaving]);

  // Handle new recipe
  const handleNewRecipe = useCallback(() => {
    setInput('');
    setGeneratedId(null);
    setHasGenerated(false);
    setIsSaved(false);
    setSavedRecipeId(null);
    setSaveError(null);
    setPreloadedRecipe(null);
    setRecipeVisible(false);
    setCurrentRecipe(null);
    setModificationInput('');
    setInputHidden(false);
    stop();
    window.history.replaceState(null, '', '/generate');
    inputRef.current?.focus();
  }, [stop]);

  // Select suggestion - immediately start generation
  const handleSelectSuggestion = useCallback((suggestion: string) => {
    setShowSuggestions(false);
    handleGenerate(suggestion);
  }, [handleGenerate]);

  // Handle recipe modification
  const handleModifyRecipe = useCallback((message: string) => {
    if (!currentRecipe || isModifying) return;

    setModificationInput('');
    setIsSaved(false); // Mark as unsaved since we're modifying

    shouldAutoSaveModRef.current = true;
    // Use the useObject hook for streaming modifications
    submitModification({ recipe: currentRecipe, message });
  }, [currentRecipe, isModifying, submitModification]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (hasGenerated && currentRecipe && modificationInput.trim()) {
          handleModifyRecipe(modificationInput.trim());
        } else if (!hasGenerated) {
          handleGenerate();
        }
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    },
    [handleGenerate, handleModifyRecipe, hasGenerated, currentRecipe, modificationInput]
  );

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = () => setShowSuggestions(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Trigger fade-in animation when recipe appears
  useEffect(() => {
    if ((recipe || preloadedRecipe) && generatedId) {
      // Small delay to ensure DOM is ready, then fade in
      const timer = setTimeout(() => setRecipeVisible(true), 50);
      return () => clearTimeout(timer);
    } else {
      setRecipeVisible(false);
    }
  }, [recipe, preloadedRecipe, generatedId]);

  // Sync current recipe state when streaming completes or preloaded
  useEffect(() => {
    if (preloadedRecipe) {
      setCurrentRecipe(preloadedRecipe);
    } else if (recipe && !isLoading) {
      setCurrentRecipe(recipe as Partial<GeneratedRecipe>);
    }
  }, [recipe, preloadedRecipe, isLoading]);

  // Sync modified recipe during and after modification (show partial updates)
  useEffect(() => {
    if (modifiedRecipe) {
      setCurrentRecipe(modifiedRecipe as Partial<GeneratedRecipe>);
    }
  }, [modifiedRecipe]);

  // Auto-save after generation completes
  useEffect(() => {
    if (!shouldAutoSaveRef.current || isLoading || !recipe || !(recipe as any).title || !generatedId) return;
    shouldAutoSaveRef.current = false;

    const doSave = async () => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const res = await fetch('/api/save-generated-recipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipe, generatedId, prompt: input }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setIsSaved(true);
          setSavedRecipeId(data.id);
          window.history.replaceState(null, '', `/generate/${data.id}`);
        }
      } catch (err) {
        console.error('Auto-save error:', err);
      } finally {
        setIsSaving(false);
      }
    };
    doSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, recipe, generatedId]);

  // Auto-save after modification completes
  useEffect(() => {
    if (!shouldAutoSaveModRef.current || isModifying || !modifiedRecipe || !(modifiedRecipe as any).title || !generatedId) return;
    shouldAutoSaveModRef.current = false;

    const doSave = async () => {
      setIsSaving(true);
      setSaveError(null);
      try {
        const res = await fetch('/api/save-generated-recipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recipe: modifiedRecipe, generatedId, prompt: input }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setIsSaved(true);
          setSavedRecipeId(data.id);
          window.history.replaceState(null, '', `/generate/${data.id}`);
        }
      } catch (err) {
        console.error('Auto-save error:', err);
      } finally {
        setIsSaving(false);
      }
    };
    doSave();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModifying, modifiedRecipe, generatedId]);

  // Example question placeholder for modification input
  const [exampleQuestion, setExampleQuestion] = useState(() => getRandomExampleQuestion());

  // Reset example question when a new recipe is generated
  useEffect(() => {
    if (generatedId) {
      setExampleQuestion(getRandomExampleQuestion());
    }
  }, [generatedId]);

  // Container styles differ based on embedded vs standalone
  const containerClass = embedded
    ? 'flex flex-col h-full'
    : 'h-[calc(100vh-3.5rem)] flex flex-col';

  // Determine which recipe to display
  const displayRecipe = currentRecipe || preloadedRecipe || recipe;

  return (
    <div className={containerClass}>
      <RecipeTimer />
      {/* BEFORE GENERATION: Centered input */}
      {!hasGenerated && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8">
          <div className="w-full max-w-2xl">
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder={rotatingPlaceholders ? '' : 'What recipe would you like to create?'}
                disabled={isLoading}
                className="w-full px-4 py-4 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-lg text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />

              {/* Animated placeholder overlay */}
              {rotatingPlaceholders && input.length === 0 && (
                <div className="absolute inset-0 flex items-center px-4 pointer-events-none">
                  <span className="text-lg text-zinc-400 dark:text-zinc-500">
                    Try a{' '}
                    <span
                      className={`text-violet-500 dark:text-violet-400 font-medium transition-opacity duration-300 ${
                        adjectiveFading ? 'opacity-0' : 'opacity-100'
                      }`}
                    >
                      {adjective}
                    </span>{' '}
                    <span
                      className={`text-amber-600 dark:text-amber-400 font-medium transition-opacity duration-300 ${
                        categoryFading ? 'opacity-0' : 'opacity-100'
                      }`}
                    >
                      {category}
                    </span>
                    ...
                  </span>
                </div>
              )}

              {/* Loading indicator for autocomplete */}
              {loadingSuggestions && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <div className="w-5 h-5 border-2 border-zinc-300 dark:border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
                </div>
              )}

              {/* Autocomplete dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 w-full mt-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden shadow-xl">
                  {suggestions.map((suggestion, i) => (
                    <li
                      key={i}
                      onClick={() => handleSelectSuggestion(suggestion)}
                      className="px-4 py-3 text-zinc-900 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 cursor-pointer transition-colors border-b border-zinc-200 dark:border-zinc-700 last:border-b-0"
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Hint text */}
            <p className="text-center text-zinc-500 text-sm mt-3">
              Press Enter to generate • Start typing for suggestions
            </p>
            <RecentlyGeneratedRecipes
              visible={input.length === 0}
              onSelectRecipe={handleSelectRecentRecipe}
            />
          </div>
        </div>
      )}

      {/* AFTER GENERATION: Recipe with sticky bottom input */}
      {hasGenerated && (
        <>
          {/* Scrollable recipe content area */}
          <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-32">
            <div className="max-w-4xl mx-auto pt-6">
              {/* Action buttons at top */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <button
                  onClick={handleNewRecipe}
                  className="px-4 py-2 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors"
                >
                  New Recipe
                </button>
                {displayRecipe && !isSaved && (
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !(displayRecipe as Partial<GeneratedRecipe>).title}
                    className="px-4 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSaving ? 'Saving...' : 'Save Recipe'}
                  </button>
                )}
                {isSaved && (
                  <div className="flex items-center gap-2">
                    <span className="px-4 py-2 text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Saved
                    </span>
                    {savedRecipeId && (
                      <Link
                        href={`/generate/${savedRecipeId}`}
                        className="px-3 py-1.5 text-xs bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors"
                        title="View saved recipe"
                      >
                        View saved recipe →
                      </Link>
                    )}
                  </div>
                )}
                {saveError && (
                  <span className="text-sm text-red-500 dark:text-red-400">{saveError}</span>
                )}
              </div>

              {/* Loading State */}
              {isLoading && !displayRecipe && (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-2 border-zinc-300 dark:border-zinc-600 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-zinc-500 dark:text-zinc-400 capitalize">
                    <span className={`transition-opacity duration-300 ${waitingPhraseFading ? 'opacity-0' : 'opacity-100'}`}>
                      {waitingPhrase}
                    </span>
                    ...
                  </p>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400">
                  <p className="font-medium">Error generating recipe</p>
                  <p className="text-sm mt-1">{error.message}</p>
                </div>
              )}

              {/* Recipe Display */}
              {displayRecipe && generatedId && (
                <div className={`transition-opacity duration-500 ${recipeVisible ? 'opacity-100' : 'opacity-0'}`}>
                  {(isLoading || isModifying) && (
                    <div className="mb-4 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                      <div className="w-4 h-4 border-2 border-zinc-300 dark:border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
                      <span className="text-sm">{isModifying ? 'Updating recipe...' : 'Generating...'}</span>
                    </div>
                  )}
                  <GeneratedRecipeDisplay
                    recipe={displayRecipe as Partial<GeneratedRecipe>}
                    generatedId={generatedId}
                    isLoading={(isLoading && !preloadedRecipe) || isModifying}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Sticky bottom input for modifications */}
          {!inputHidden ? (
            <div className="fixed bottom-0 left-0 right-0 pb-4 px-4 sm:px-8 transition-all duration-300">
              <div className="max-w-2xl mx-auto">
                <div className="relative">
                  <input
                    type="text"
                    value={modificationInput}
                    onChange={(e) => setModificationInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={exampleQuestion}
                    disabled={isModifying || isLoading}
                    className="w-full px-4 py-4 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-lg text-zinc-900 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed pr-12"
                  />
                  {(isModifying || isLoading) ? (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <div className="w-5 h-5 border-2 border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
                    </div>
                  ) : (
                    <button
                      onClick={() => setInputHidden(true)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                      title="Hide input"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setInputHidden(false)}
              className="fixed bottom-4 right-20 p-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-full shadow-lg transition-all duration-300 hover:scale-105 z-40"
              title="Modify recipe"
            >
              <svg className="w-5 h-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function GenerateRecipePage() {
  return <RecipeGenerator embedded={false} />;
}
