'use client';

import { useState } from 'react';
import { ComponentsSidebar } from '@/components/admin/experiments/ComponentsSidebar';
import { VariationSelector } from '@/components/admin/experiments/VariationSelector';
import { StateConfigurator } from '@/components/admin/experiments/StateConfigurator';
import { RecipeViewLab } from '@/components/admin/experiments/RecipeViewLab';
import { Recipe } from '@/lib/types';

export default function ComponentsPage() {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Left Sidebar */}
      <ComponentsSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Variation Tabs */}
        <VariationSelector />

        {/* Preview Area */}
        <RecipeViewLab recipe={selectedRecipe} />

        {/* State Configurator */}
        <StateConfigurator
          onRecipeSelect={setSelectedRecipe}
          selectedRecipe={selectedRecipe}
        />
      </div>
    </div>
  );
}
