'use client';

import { COMPONENT_CATEGORIES } from '@/lib/types/component-lab';
import { useComponentLabStore } from '@/lib/stores/componentLabStore';

export function VariationSelector() {
  const { activeComponentType, activeVariation, setActiveVariation } =
    useComponentLabStore();

  const category = COMPONENT_CATEGORIES.find((c) => c.id === activeComponentType);
  if (!category) return null;

  return (
    <div className="border-b border-zinc-800 bg-zinc-900/50">
      <div className="flex items-center gap-1 p-2 overflow-x-auto">
        {category.variations.map((variation, index) => (
          <button
            key={variation.id}
            onClick={() => setActiveVariation(variation.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeVariation === variation.id
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            }`}
          >
            <span className="text-xs opacity-60 mr-1">{index + 1}.</span>
            {variation.name}
          </button>
        ))}
      </div>
      <div className="px-4 pb-3">
        <p className="text-sm text-zinc-500">
          {category.variations.find((v) => v.id === activeVariation)?.description}
        </p>
      </div>
    </div>
  );
}
