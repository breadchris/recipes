'use client';

import { useState } from 'react';
import type { NutritionResult } from '@/app/admin/nutrition/page';

interface Portion {
  modifier: string;
  gramWeight: number;
}

interface NutritionCardProps {
  food: NutritionResult;
}

export function NutritionCard({ food }: NutritionCardProps) {
  const [selectedPortionIndex, setSelectedPortionIndex] = useState<number | null>(null);

  const portions: Portion[] = (() => {
    try {
      return JSON.parse(food.portions) || [];
    } catch {
      return [];
    }
  })();

  // Get selected portion and calculate multiplier (nutrition is per 100g)
  const selectedPortion = selectedPortionIndex !== null ? portions[selectedPortionIndex] : null;
  const multiplier = selectedPortion ? selectedPortion.gramWeight / 100 : 1;

  const formatValue = (value: number, decimals = 1) => {
    const adjusted = value * multiplier;
    return adjusted.toFixed(decimals);
  };

  return (
    <div className="p-4 bg-zinc-800 border border-zinc-700 rounded-lg">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-medium text-zinc-200">{food.description}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-zinc-500">{food.category}</span>
            <span className="text-zinc-600">·</span>
            <span className="text-xs px-2 py-0.5 bg-zinc-700 text-zinc-400 rounded">
              {food.dataType}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-zinc-100">
            {formatValue(food.calories, 0)}
          </div>
          <div className="text-xs text-zinc-500">kcal</div>
        </div>
      </div>

      {/* Portion selector */}
      {portions.length > 0 && (
        <div className="mb-4">
          <label className="block text-xs text-zinc-500 mb-1">Portion size</label>
          <select
            value={selectedPortionIndex !== null ? String(selectedPortionIndex) : ''}
            onChange={(e) => {
              if (e.target.value === '') {
                setSelectedPortionIndex(null);
              } else {
                setSelectedPortionIndex(parseInt(e.target.value));
              }
            }}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            <option value="">Per 100g</option>
            {portions.map((portion, index) => (
              <option key={`${index}-${portion.gramWeight}`} value={String(index)}>
                {portion.modifier} ({portion.gramWeight}g)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Macros */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="text-center p-2 bg-zinc-900 rounded">
          <div className="text-lg font-semibold text-zinc-200">
            {formatValue(food.protein_g)}g
          </div>
          <div className="text-xs text-zinc-500">Protein</div>
        </div>
        <div className="text-center p-2 bg-zinc-900 rounded">
          <div className="text-lg font-semibold text-zinc-200">
            {formatValue(food.carbs_g)}g
          </div>
          <div className="text-xs text-zinc-500">Carbs</div>
        </div>
        <div className="text-center p-2 bg-zinc-900 rounded">
          <div className="text-lg font-semibold text-zinc-200">
            {formatValue(food.fat_g)}g
          </div>
          <div className="text-xs text-zinc-500">Fat</div>
        </div>
        <div className="text-center p-2 bg-zinc-900 rounded">
          <div className="text-lg font-semibold text-zinc-200">
            {formatValue(food.fiber_g)}g
          </div>
          <div className="text-xs text-zinc-500">Fiber</div>
        </div>
      </div>

      {/* Additional nutrients */}
      <div className="grid grid-cols-4 gap-3 text-sm">
        <div className="flex justify-between text-zinc-400">
          <span>Sugar</span>
          <span className="text-zinc-300">{formatValue(food.sugar_g)}g</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Sodium</span>
          <span className="text-zinc-300">{formatValue(food.sodium_mg, 0)}mg</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Cholesterol</span>
          <span className="text-zinc-300">{formatValue(food.cholesterol_mg, 0)}mg</span>
        </div>
        <div className="flex justify-between text-zinc-400">
          <span>Sat. Fat</span>
          <span className="text-zinc-300">{formatValue(food.saturated_fat_g)}g</span>
        </div>
      </div>

      {/* FDC ID for reference */}
      <div className="mt-3 pt-3 border-t border-zinc-700 text-xs text-zinc-600">
        FDC ID: {food.fdcId}
      </div>
    </div>
  );
}
