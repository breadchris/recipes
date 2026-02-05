'use client';

import { useState } from 'react';
import { RecipeSearchResult } from '@/lib/types/recipe-chat';

interface RecipeResultCardProps {
  recipe: RecipeSearchResult;
  onGenerateInspired?: (recipe: RecipeSearchResult) => void;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

function formatViews(views?: number): string {
  if (!views) return '';
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M views`;
  if (views >= 1000) return `${(views / 1000).toFixed(0)}K views`;
  return `${views} views`;
}

export function RecipeResultCard({ recipe, onGenerateInspired }: RecipeResultCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      className="bg-zinc-800/50 hover:bg-zinc-800 rounded-lg overflow-hidden cursor-pointer transition-all border border-zinc-700/50 hover:border-zinc-600"
    >
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        {recipe.thumbnail && (
          <div className="flex-shrink-0 w-24 h-16 rounded-md overflow-hidden bg-zinc-700">
            <img
              src={recipe.thumbnail}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-zinc-200 line-clamp-2 leading-tight">
            {recipe.title}
          </h4>
          <p className="text-xs text-zinc-500 mt-1">{recipe.channelName}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
            {recipe.duration && <span>{formatDuration(recipe.duration)}</span>}
            {recipe.duration && recipe.viewCount && <span>•</span>}
            {recipe.viewCount && <span>{formatViews(recipe.viewCount)}</span>}
          </div>
        </div>

        {/* Expand indicator */}
        <div className="flex-shrink-0 self-center">
          <svg
            className={`w-5 h-5 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-0 border-t border-zinc-700/50">
          {recipe.description && (
            <p className="text-xs text-zinc-400 mt-3 leading-relaxed">
              {recipe.description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-3">
            <a
              href={`/recipe/${recipe.id}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 transition-colors"
            >
              View full recipe
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            {onGenerateInspired && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateInspired(recipe);
                }}
                className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Generate inspired
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
