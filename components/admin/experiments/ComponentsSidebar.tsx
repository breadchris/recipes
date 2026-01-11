'use client';

import { COMPONENT_CATEGORIES, ComponentCategory } from '@/lib/types/component-lab';
import { useComponentLabStore } from '@/lib/stores/componentLabStore';

export function ComponentsSidebar() {
  const { activeComponentType, setActiveComponentType } = useComponentLabStore();

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">
          Components
        </h2>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {COMPONENT_CATEGORIES.map((category: ComponentCategory) => (
          <button
            key={category.id}
            onClick={() => setActiveComponentType(category.id)}
            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
              activeComponentType === category.id
                ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30'
                : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            <div className="font-medium">{category.name}</div>
            <div className="text-xs text-zinc-500 mt-0.5">
              {category.variations.length} variations
            </div>
          </button>
        ))}
      </nav>
      <div className="p-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-600">
          Select a component type to view and test variations
        </p>
      </div>
    </aside>
  );
}
