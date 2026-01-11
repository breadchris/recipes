'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ReactMarkdown from 'react-markdown';

type LayoutMode = 'stacked' | 'side-by-side';
import { VideoPlayer, VideoPlayerHandle } from '@/components/VideoPlayer';
// HIDDEN: cookbook - import SaveButton from '@/components/SaveButton';
// HIDDEN: cookbook - import NotesEditor from '@/components/NotesEditor';
import BuyIngredientsButton from '@/components/BuyIngredientsButton';
import OrderOnInstacartButton from '@/components/OrderOnInstacartButton';
// HIDDEN: cookbook - import { useCookbookStore } from '@/lib/stores/cookbook';
import { useRecipeProgressStore } from '@/lib/stores/recipeProgress';
import { useFeatureFlagsStore } from '@/lib/stores/featureFlags';
import { useTimerStore } from '@/lib/stores/timerStore';
import type { VideoWithChannel, Recipe, CleanedTranscript, Instruction, Ingredient } from '@/lib/types';
import { TranscriptTab } from '@/components/TranscriptTab';
import { extractMeasurements } from '@/lib/extractMeasurements';
import { parseTimeString } from '@/lib/parseTimeString';
import RecipeTimer from '@/components/RecipeTimer';
import { getEquipmentAffiliateUrl } from '@/lib/equipmentAffiliateLinks';
import { ExternalLink, Play } from 'lucide-react';

interface RecipeViewerProps {
  video: VideoWithChannel;
  previousVideo: VideoWithChannel | null;
  nextVideo: VideoWithChannel | null;
}

function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${mins} min`;
}

function LayoutToggle({ layout, onToggle }: { layout: LayoutMode; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="hidden lg:flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      title={layout === 'stacked' ? 'Switch to side-by-side view' : 'Switch to stacked view'}
    >
      {layout === 'stacked' ? (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M4.5 9h15m-15 6h15" />
          </svg>
          Side by side
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
          Stacked
        </>
      )}
    </button>
  );
}

interface RecipeDisplayProps {
  recipe: Recipe;
  videoId: string;
  recipeIndex?: number;
  onActivateAndSeek?: (seconds: number) => void;
  cleanedTranscript?: CleanedTranscript;
}

function RecipeDisplay({ recipe, videoId, recipeIndex = 0, onActivateAndSeek, cleanedTranscript }: RecipeDisplayProps) {
  const {
    toggleIngredient,
    toggleStep,
    isIngredientChecked,
    isStepCompleted,
    getProgress,
    resetProgress,
  } = useRecipeProgressStore();
  const startTimer = useTimerStore((state) => state.startTimer);
  const showBuyButton = useFeatureFlagsStore((state) => state.flags.showBuyButton);
  const showInstacartButton = useFeatureFlagsStore((state) => state.flags.showInstacartButton);

  const handleTimeClick = (e: React.MouseEvent, timeString: string, stepNumber: number) => {
    e.stopPropagation();
    const seconds = parseTimeString(timeString);
    if (seconds) {
      startTimer(stepNumber, recipeIndex, timeString, seconds);
    }
  };

  const progress = getProgress(videoId, recipeIndex);
  const totalSteps = recipe.instructions?.length || 0;
  const completedSteps = progress.completedSteps.length;
  const hasProgress = progress.checkedIngredients.length > 0 || completedSteps > 0;

  // Group instructions by section_id or timestamp, preserving order
  const groupedInstructions = useMemo(() => {
    if (!recipe.instructions) return [];

    // Helper to find section by timestamp
    const findSectionByTimestamp = (timestamp: number | undefined) => {
      if (timestamp == null || !cleanedTranscript?.sections) return null;
      return cleanedTranscript.sections.find(
        s => timestamp >= s.startTime && timestamp < s.endTime
      )?.id ?? null;
    };

    const groups: { sectionId: string | null; instructions: Instruction[] }[] = [];
    let currentSectionId: string | null | undefined = undefined;

    for (const instruction of recipe.instructions) {
      // Use section_id if available, otherwise match by timestamp
      const sectionId = instruction.section_id ?? findSectionByTimestamp(instruction.timestamp_seconds);
      if (sectionId !== currentSectionId) {
        groups.push({ sectionId, instructions: [instruction] });
        currentSectionId = sectionId;
      } else {
        groups[groups.length - 1].instructions.push(instruction);
      }
    }
    return groups;
  }, [recipe.instructions, cleanedTranscript?.sections]);

  // Group ingredients by section_id or timestamp, preserving order
  const groupedIngredients = useMemo(() => {
    if (!recipe.ingredients) return [];

    // Helper to find section by timestamp
    const findSectionByTimestamp = (timestamp: number | undefined) => {
      if (timestamp == null || !cleanedTranscript?.sections) return null;
      return cleanedTranscript.sections.find(
        s => timestamp >= s.startTime && timestamp < s.endTime
      )?.id ?? null;
    };

    const groups: { sectionId: string | null; ingredients: (typeof recipe.ingredients[0] & { originalIndex: number })[] }[] = [];
    let currentSectionId: string | null | undefined = undefined;

    recipe.ingredients.forEach((ingredient, index) => {
      const sectionId = findSectionByTimestamp(ingredient.timestamp_seconds);
      if (sectionId !== currentSectionId) {
        groups.push({ sectionId, ingredients: [{ ...ingredient, originalIndex: index }] });
        currentSectionId = sectionId;
      } else {
        groups[groups.length - 1].ingredients.push({ ...ingredient, originalIndex: index });
      }
    });
    return groups;
  }, [recipe.ingredients, cleanedTranscript?.sections]);

  // Map ingredients to steps - handles both new structured format and legacy keyword matching
  const getIngredientsForStep = useMemo(() => {
    return (instruction: Instruction): { ingredient: Ingredient; originalIndex: number }[] => {
      if (!recipe.ingredients) return [];

      // Get step ingredients from instruction (if available)
      const stepIngredients = instruction.keywords?.ingredients ?? [];
      if (stepIngredients.length === 0) return [];

      // Check if new structured format (array of objects) or legacy format (array of strings)
      const isStructuredFormat = stepIngredients.length > 0 &&
        typeof stepIngredients[0] === 'object' &&
        stepIngredients[0] !== null;

      if (isStructuredFormat) {
        // New format: ingredients are already full objects with quantity/unit
        // Return them directly (originalIndex = -1 since they're step-specific)
        return (stepIngredients as Ingredient[]).map((ing, idx) => ({
          ingredient: ing,
          originalIndex: -1  // Step-specific ingredient, not linked to recipe-level index
        }));
      }

      // Legacy format: match by name (case-insensitive partial match)
      const keywordStrings = stepIngredients as unknown as string[];
      return recipe.ingredients
        .map((ing, idx) => ({ ingredient: ing, originalIndex: idx }))
        .filter(({ ingredient }) => {
          const itemLower = ingredient.item.toLowerCase();
          return keywordStrings.some(keyword =>
            itemLower.includes(keyword.toLowerCase()) ||
            keyword.toLowerCase().includes(itemLower)
          );
        });
    };
  }, [recipe.ingredients]);

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 sm:p-6 space-y-8">
      {/* Recipe Metadata Badges */}
      {(recipe.prep_time_minutes || recipe.cook_time_minutes || recipe.servings || recipe.difficulty) && (
        <div className="grid grid-cols-2 gap-2">
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

      {/* Ingredients */}
      {recipe.ingredients && recipe.ingredients.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide">
              Ingredients
            </h3>
            <div className="flex gap-2">
              {showBuyButton && <BuyIngredientsButton ingredients={recipe.ingredients} />}
              {showInstacartButton && <OrderOnInstacartButton recipe={recipe} videoId={videoId} />}
            </div>
          </div>
          <div className="space-y-3">
            {groupedIngredients.map((group, groupIndex) => {
              const section = cleanedTranscript?.sections.find(s => s.id === group.sectionId);
              return (
                <div key={groupIndex}>
                  {section?.heading && (
                    <button
                      onClick={() => onActivateAndSeek?.(section.startTime)}
                      className={`flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer transition-colors group ${groupIndex > 0 ? 'mt-4' : ''}`}
                    >
                      <Play className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                      {section.heading}
                    </button>
                  )}
                  <ul className="space-y-2">
                    {group.ingredients.map((ingredient) => {
                      const isChecked = isIngredientChecked(videoId, ingredient.originalIndex, recipeIndex);
                      return (
                        <li
                          key={ingredient.originalIndex}
                          onClick={() => toggleIngredient(videoId, ingredient.originalIndex, recipeIndex)}
                          className={`text-sm flex items-start cursor-pointer select-none transition-opacity ${
                            isChecked ? 'opacity-50' : 'opacity-100'
                          }`}
                        >
                          <span className={`mr-2 flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                            isChecked
                              ? 'bg-green-500 dark:bg-green-400 border-green-500 dark:border-green-400 text-white'
                              : 'border-zinc-300 dark:border-zinc-600 text-transparent hover:border-zinc-400 dark:hover:border-zinc-500'
                          }`}>
                            {isChecked && (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </span>
                          <span className={`flex-1 ${isChecked ? 'line-through text-zinc-500 dark:text-zinc-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                            {ingredient.quantity && (
                              <span className="font-medium">{ingredient.quantity}</span>
                            )}
                            {ingredient.unit && (
                              <span className="font-medium"> {ingredient.unit}</span>
                            )}
                            {(ingredient.quantity || ingredient.unit) && ' '}
                            {ingredient.item}
                            {ingredient.notes && (
                              <span className="text-zinc-500 dark:text-zinc-400"> ({ingredient.notes})</span>
                            )}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress Bar - always show when there are instructions */}
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
              onClick={() => resetProgress(videoId, recipeIndex)}
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
          <div className="space-y-3">
            {groupedInstructions.map((group, groupIndex) => {
              const section = cleanedTranscript?.sections.find(s => s.id === group.sectionId);
              return (
                <div key={groupIndex}>
                  {section?.heading && (
                    <button
                      onClick={() => onActivateAndSeek?.(section.startTime)}
                      className={`flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-2 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer transition-colors group ${groupIndex > 0 ? 'mt-6' : ''}`}
                    >
                      <Play className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                      {section.heading}
                    </button>
                  )}
                  <ol className="space-y-3">
                    {group.instructions.map((instruction) => {
                      const isCompleted = isStepCompleted(videoId, instruction.step, recipeIndex);
                      return (
                        <li
                          key={instruction.step}
                          onClick={() => toggleStep(videoId, instruction.step, recipeIndex)}
                          className={`text-sm flex items-start cursor-pointer select-none transition-opacity ${
                            isCompleted ? 'opacity-50' : 'opacity-100'
                          }`}
                        >
                          <span className={`mr-3 flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                            isCompleted
                              ? 'bg-green-500 dark:bg-green-400 text-white'
                              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-50 hover:bg-zinc-300 dark:hover:bg-zinc-600'
                          }`}>
                            {isCompleted ? (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              instruction.step
                            )}
                          </span>
                          <div className="flex-1">
                            <span className={`${isCompleted ? 'line-through text-zinc-500 dark:text-zinc-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                              {instruction.text}
                            </span>
                            {/* Per-step ingredients */}
                            {(() => {
                              const stepIngredients = getIngredientsForStep(instruction);
                              if (stepIngredients.length === 0) return null;
                              return (
                                <ul className="mt-2 space-y-1">
                                  {stepIngredients.map(({ ingredient, originalIndex }, idx) => {
                                    // For step-specific ingredients (originalIndex === -1), just display without checkbox
                                    const isStepSpecific = originalIndex === -1;
                                    const isChecked = !isStepSpecific && isIngredientChecked(videoId, originalIndex, recipeIndex);
                                    const uniqueKey = isStepSpecific ? `step-${instruction.step}-ing-${idx}` : `recipe-ing-${originalIndex}`;
                                    return (
                                      <li
                                        key={uniqueKey}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!isStepSpecific) {
                                            toggleIngredient(videoId, originalIndex, recipeIndex);
                                          }
                                        }}
                                        className={`text-xs flex items-start select-none transition-opacity ${
                                          !isStepSpecific ? 'cursor-pointer' : ''
                                        } ${isChecked ? 'opacity-50' : 'opacity-100'}`}
                                      >
                                        {!isStepSpecific && (
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
                                        )}
                                        {isStepSpecific && (
                                          <span className="mr-1.5 text-green-600 dark:text-green-400">•</span>
                                        )}
                                        <span className={`${isChecked ? 'line-through text-zinc-500 dark:text-zinc-500' : 'text-zinc-600 dark:text-zinc-400'}`}>
                                          {ingredient.quantity && (
                                            <span className="font-medium">{ingredient.quantity}</span>
                                          )}
                                          {ingredient.unit && (
                                            <span className="font-medium"> {ingredient.unit}</span>
                                          )}
                                          {(ingredient.quantity || ingredient.unit) && ' '}
                                          {ingredient.item}
                                        </span>
                                      </li>
                                    );
                                  })}
                                </ul>
                              );
                            })()}
                            {(() => {
                              // Prefer AI-extracted measurements, fall back to regex
                              const aiMeasurements = instruction.measurements;
                              const hasAiMeasurements = (aiMeasurements?.temperatures?.length ?? 0) > 0 ||
                                                        (aiMeasurements?.times?.length ?? 0) > 0;
                              const measurements = hasAiMeasurements
                                ? {
                                    temperatures: aiMeasurements?.temperatures ?? [],
                                    times: aiMeasurements?.times ?? []
                                  }
                                : extractMeasurements(instruction.text);
                              const hasMeasurements = measurements.temperatures.length > 0 ||
                                                      measurements.times.length > 0;
                              if (!hasMeasurements) return null;
                              return (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {measurements.temperatures.map((temp, idx) => (
                                    <span
                                      key={`temp-${idx}`}
                                      className="px-1.5 py-0.5 text-xs rounded bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800"
                                    >
                                      {temp}
                                    </span>
                                  ))}
                                  {measurements.times.map((time, idx) => (
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
                              );
                            })()}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Equipment */}
      {recipe.equipment && recipe.equipment.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 uppercase tracking-wide mb-3">
            Equipment
          </h3>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {recipe.equipment.map((item, index) => {
              const affiliateUrl = getEquipmentAffiliateUrl(item);
              return affiliateUrl ? (
                <a
                  key={index}
                  href={affiliateUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {item}
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <span key={index} className="text-sm text-zinc-700 dark:text-zinc-300">
                  {item}
                </span>
              );
            })}
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

export function RecipeViewer({ video, previousVideo, nextVideo }: RecipeViewerProps) {
  const router = useRouter();
  const playerRef = useRef<VideoPlayerHandle>(null);
  // HIDDEN: cookbook - const isSaved = useCookbookStore((state) => state.isSaved(video.id));
  const hasRecipes = !!(video.recipes && video.recipes.length > 0);
  const hasSections = !!(video.cleaned_transcript?.sections && video.cleaned_transcript.sections.length > 0);
  const defaultTab = hasRecipes ? 'recipe' : 'description'; // HIDDEN: cookbook - removed isSaved check
  const [activeTab, setActiveTab] = useState<'recipe' | 'sections' | 'description'>(defaultTab);
  const [selectedRecipeIndex, setSelectedRecipeIndex] = useState(0);
  const [layout, setLayout] = useState<LayoutMode>('side-by-side');

  useEffect(() => {
    const saved = localStorage.getItem('recipe-layout-mode');
    if (saved === 'stacked' || saved === 'side-by-side') {
      setLayout(saved);
    }
  }, []);

  const toggleLayout = () => {
    const newLayout = layout === 'stacked' ? 'side-by-side' : 'stacked';
    setLayout(newLayout);
    localStorage.setItem('recipe-layout-mode', newLayout);
  };

  const uploadDate = new Date(
    video.upload_date.slice(0, 4) + '-' +
    video.upload_date.slice(4, 6) + '-' +
    video.upload_date.slice(6, 8)
  ).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  // HIDDEN: cookbook
  // const handleSave = () => {
  //   setActiveTab('notes');
  // };

  const selectedRecipe = video.recipes?.[selectedRecipeIndex];

  const tabContent = (
    <div className="mt-5">
      {activeTab === 'recipe' && selectedRecipe ? (
        <>
          {/* Recipe selector for multiple recipes */}
          {video.recipes && video.recipes.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {video.recipes.map((recipe, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedRecipeIndex(index)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    selectedRecipeIndex === index
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                  }`}
                >
                  {recipe.title}
                </button>
              ))}
            </div>
          )}
          <RecipeDisplay
            recipe={selectedRecipe}
            videoId={video.id}
            recipeIndex={selectedRecipeIndex}
            onActivateAndSeek={(seconds) => playerRef.current?.activateAndSeek(seconds)}
            cleanedTranscript={video.cleaned_transcript}
          />
        </>
      ) : activeTab === 'sections' && video.cleaned_transcript ? (
        <TranscriptTab
          cleanedTranscript={video.cleaned_transcript}
          onSeek={(seconds) => playerRef.current?.seekTo(seconds)}
        />
      ) : activeTab === 'description' ? (
        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 max-h-[400px] overflow-y-auto">
          <div className="text-sm text-zinc-700 dark:text-zinc-300 prose prose-sm dark:prose-invert max-w-none prose-headings:text-zinc-900 dark:prose-headings:text-zinc-50 prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-strong:text-zinc-900 dark:prose-strong:text-zinc-50 prose-code:text-zinc-900 dark:prose-code:text-zinc-50">
            <ReactMarkdown>
              {video.description}
            </ReactMarkdown>
          </div>
        </div>
      ) : null /* HIDDEN: cookbook - Notes tab removed */}
    </div>
  );

  const tabs = (
    <div className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="flex gap-8">
        {hasRecipes && (
          <button
            onClick={() => setActiveTab('recipe')}
            className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'recipe'
                ? 'border-zinc-900 dark:border-zinc-50 text-zinc-900 dark:text-zinc-50'
                : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Recipe
          </button>
        )}
        {hasSections && (
          <button
            onClick={() => setActiveTab('sections')}
            className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'sections'
                ? 'border-zinc-900 dark:border-zinc-50 text-zinc-900 dark:text-zinc-50'
                : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
            }`}
          >
            Sections
          </button>
        )}
        <button
          onClick={() => setActiveTab('description')}
          className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'description'
              ? 'border-zinc-900 dark:border-zinc-50 text-zinc-900 dark:text-zinc-50'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
          }`}
        >
          Description
        </button>
{/* HIDDEN: cookbook - Notes tab
        <button
          onClick={() => setActiveTab('notes')}
          className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'notes'
              ? 'border-zinc-900 dark:border-zinc-50 text-zinc-900 dark:text-zinc-50'
              : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50'
          }`}
        >
          My Notes
        </button>
        */}
      </div>
    </div>
  );

  const navigation = (
    <div className="flex flex-col sm:flex-row gap-4">
      {previousVideo && (
        <Link
          href={`/recipe/${previousVideo.id}`}
          className="flex-1 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Previous</div>
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50 line-clamp-2">
            {previousVideo.title}
          </div>
        </Link>
      )}
      {nextVideo && (
        <Link
          href={`/recipe/${nextVideo.id}`}
          className="flex-1 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Next</div>
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-50 line-clamp-2">
            {nextVideo.title}
          </div>
        </Link>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <RecipeTimer />
      <div className={`mx-auto px-4 sm:px-6 lg:px-8 py-8 ${layout === 'side-by-side' ? 'max-w-[1600px]' : 'max-w-6xl'}`}>
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push('/');
              }
            }}
            className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
            title="Back to search"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <LayoutToggle layout={layout} onToggle={toggleLayout} />
        </div>

        {layout === 'side-by-side' ? (
          <div className="lg:grid lg:grid-cols-2 lg:gap-8">
            {/* Video Column - Sticky */}
            <div className="lg:sticky lg:top-8 lg:self-start">
              <VideoPlayer ref={playerRef} videoId={video.id} />
              <div className="mt-4">
                <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3 line-clamp-2">
                  {video.title}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                  <Link
                    href={`/channel/${video.channelSlug}`}
                    className="font-medium text-zinc-900 dark:text-zinc-50 hover:underline"
                  >
                    {video.channelName}
                  </Link>
                  <span>·</span>
                  <span>{uploadDate}</span>
                  {/* HIDDEN: cookbook - SaveButton removed
                  <span>·</span>
                  <SaveButton video={video} variant="compact" onSave={handleSave} />
                  */}
                  {process.env.NODE_ENV === 'development' && (
                    <>
                      <span>·</span>
                      <Link
                        href={`/admin/recipe/${video.id}`}
                        className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                      >
                        Admin
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Recipe Column - Scrollable */}
            <div>
              <div className="mb-6">
                {tabs}
                {tabContent}
              </div>

              {/* Affiliate Disclosure */}
              <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-6">
                This page contains affiliate links to Amazon and Instacart. We may earn a small commission on qualifying purchases at no extra cost to you.
              </p>

              {navigation}
            </div>
          </div>
        ) : (
          <>
            <VideoPlayer ref={playerRef} videoId={video.id} />

            <div className="mt-6">
              <h1 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-4 line-clamp-2">
                {video.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400 mb-6">
                <Link
                  href={`/channel/${video.channelSlug}`}
                  className="font-medium text-zinc-900 dark:text-zinc-50 hover:underline"
                >
                  {video.channelName}
                </Link>
                <span>·</span>
                <span>{uploadDate}</span>
                {/* HIDDEN: cookbook - SaveButton removed
                <span>·</span>
                <SaveButton video={video} variant="compact" onSave={handleSave} />
                */}
                {process.env.NODE_ENV === 'development' && (
                  <>
                    <span>·</span>
                    <Link
                      href={`/admin/recipe/${video.id}`}
                      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                    >
                      Admin
                    </Link>
                  </>
                )}
              </div>

              <div className="mb-6">
                {tabs}
                {tabContent}
              </div>

              {/* Affiliate Disclosure */}
              <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-6">
                This page contains affiliate links to Amazon and Instacart. We may earn a small commission on qualifying purchases at no extra cost to you.
              </p>

              {navigation}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
