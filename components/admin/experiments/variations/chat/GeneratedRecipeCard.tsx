'use client';

import { useState } from 'react';
import { GeneratedRecipe } from '@/lib/schemas/recipe';

interface GeneratedRecipeCardProps {
  recipe: Partial<GeneratedRecipe>;
  title: string;
  isGenerating?: boolean;
}

export function GeneratedRecipeCard({ recipe, title, isGenerating }: GeneratedRecipeCardProps) {
  const [expandedSection, setExpandedSection] = useState<'ingredients' | 'instructions' | null>(null);

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins === 0 ? `${hours} hr` : `${hours} hr ${mins} min`;
  };

  return (
    <div className="bg-gradient-to-br from-violet-600/10 to-violet-900/10 border border-violet-600/30 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-violet-600/20">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-violet-400 uppercase tracking-wide">AI Generated</span>
              {isGenerating && (
                <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <div className="w-3 h-3 border-2 border-zinc-600 border-t-violet-500 rounded-full animate-spin" />
                  Generating...
                </div>
              )}
            </div>
            <h3 className="text-lg font-semibold text-zinc-200 mt-1">
              {recipe.title || title}
            </h3>
            {recipe.description && (
              <p className="text-sm text-zinc-400 mt-1 line-clamp-2">{recipe.description}</p>
            )}
          </div>
        </div>

        {/* Metadata */}
        {(recipe.prep_time_minutes || recipe.cook_time_minutes || recipe.servings || recipe.difficulty) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {recipe.prep_time_minutes && (
              <span className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-300">
                Prep: {formatTime(recipe.prep_time_minutes)}
              </span>
            )}
            {recipe.cook_time_minutes && (
              <span className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-300">
                Cook: {formatTime(recipe.cook_time_minutes)}
              </span>
            )}
            {recipe.servings && (
              <span className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-300">
                {recipe.servings} servings
              </span>
            )}
            {recipe.difficulty && (
              <span className="px-2 py-1 text-xs rounded bg-zinc-800 text-zinc-300 capitalize">
                {recipe.difficulty}
              </span>
            )}
          </div>
        )}

        {/* Tags */}
        {(recipe.cuisine_type?.length || recipe.dietary_tags?.length) && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {recipe.cuisine_type?.map((tag, i) => (
              <span key={`cuisine-${i}`} className="px-1.5 py-0.5 text-xs rounded-full bg-violet-900/50 text-violet-300">
                {tag}
              </span>
            ))}
            {recipe.dietary_tags?.map((tag, i) => (
              <span key={`diet-${i}`} className="px-1.5 py-0.5 text-xs rounded-full bg-green-900/50 text-green-300">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expandable Sections */}
      <div className="divide-y divide-violet-600/20">
        {/* Ingredients */}
        {recipe.ingredients && recipe.ingredients.length > 0 && (
          <div>
            <button
              onClick={() => setExpandedSection(expandedSection === 'ingredients' ? null : 'ingredients')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-violet-600/5 transition-colors"
            >
              <span className="text-sm font-medium text-zinc-300">
                Ingredients ({recipe.ingredients.length})
              </span>
              <svg
                className={`w-4 h-4 text-zinc-500 transition-transform ${expandedSection === 'ingredients' ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSection === 'ingredients' && (
              <ul className="px-4 pb-3 space-y-1.5">
                {recipe.ingredients.map((ingredient, index) => (
                  <li key={index} className="text-sm text-zinc-400 flex items-start">
                    <span className="text-violet-500 mr-2">•</span>
                    <span>
                      {ingredient.quantity && <span className="text-zinc-300">{ingredient.quantity}</span>}
                      {ingredient.unit && <span className="text-zinc-300"> {ingredient.unit}</span>}
                      {(ingredient.quantity || ingredient.unit) && ' '}
                      {ingredient.item}
                      {ingredient.notes && <span className="text-zinc-500"> ({ingredient.notes})</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Instructions */}
        {recipe.instructions && recipe.instructions.length > 0 && (
          <div>
            <button
              onClick={() => setExpandedSection(expandedSection === 'instructions' ? null : 'instructions')}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-violet-600/5 transition-colors"
            >
              <span className="text-sm font-medium text-zinc-300">
                Instructions ({recipe.instructions.length} steps)
              </span>
              <svg
                className={`w-4 h-4 text-zinc-500 transition-transform ${expandedSection === 'instructions' ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSection === 'instructions' && (
              <ol className="px-4 pb-3 space-y-3">
                {recipe.instructions.map((instruction, index) => (
                  <li key={index} className="text-sm text-zinc-400 flex items-start">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-600/30 text-violet-300 text-xs flex items-center justify-center mr-2">
                      {instruction.step}
                    </span>
                    <span>{instruction.text}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>

      {/* Tips */}
      {recipe.tips && recipe.tips.length > 0 && !isGenerating && (
        <div className="px-4 py-3 bg-zinc-800/30 border-t border-violet-600/20">
          <p className="text-xs text-zinc-500 mb-1">Tips</p>
          <p className="text-sm text-zinc-400">{recipe.tips[0]}</p>
        </div>
      )}
    </div>
  );
}
