'use client';

import { useState, useCallback } from 'react';
import { useComponentLabStore } from '@/lib/stores/componentLabStore';
import { RecipeConfiguration } from '@/lib/types/component-lab';
import { Recipe } from '@/lib/types';

// Sample recipes for testing
const SAMPLE_RECIPES: Recipe[] = [
  {
    title: 'Classic Pasta Carbonara',
    description: 'A traditional Roman pasta dish with eggs, cheese, and guanciale',
    prep_time_minutes: 10,
    cook_time_minutes: 20,
    servings: 4,
    difficulty: 'Medium',
    ingredients: [
      { item: 'Spaghetti', quantity: '400', unit: 'g', notes: '' },
      { item: 'Guanciale', quantity: '200', unit: 'g', notes: 'or pancetta' },
      { item: 'Egg yolks', quantity: '4', unit: '', notes: 'room temperature' },
      { item: 'Pecorino Romano', quantity: '100', unit: 'g', notes: 'finely grated' },
      { item: 'Black pepper', quantity: '2', unit: 'tsp', notes: 'freshly ground' },
      { item: 'Salt', quantity: '', unit: '', notes: 'for pasta water' },
    ],
    instructions: [
      { step: 1, text: 'Bring a large pot of salted water to a boil.', measurements: { times: ['10 minutes'] } },
      { step: 2, text: 'Cut the guanciale into small strips or cubes.' },
      { step: 3, text: 'In a bowl, whisk together egg yolks, grated pecorino, and black pepper.' },
      { step: 4, text: 'Cook the guanciale in a cold pan over medium heat until crispy, about 8 minutes.', measurements: { times: ['8 minutes'] } },
      { step: 5, text: 'Cook pasta until al dente according to package directions.' },
      { step: 6, text: 'Reserve 1 cup of pasta water before draining.' },
      { step: 7, text: 'Add hot pasta to the pan with guanciale (off heat).' },
      { step: 8, text: 'Quickly toss with egg mixture, adding pasta water as needed for creaminess.' },
      { step: 9, text: 'Serve immediately with extra pecorino and pepper.' },
    ],
    equipment: ['Large pot', 'Large pan', 'Mixing bowl', 'Whisk'],
    tips: ['Work quickly when adding egg mixture to prevent scrambling', 'The heat from pasta cooks the eggs'],
  },
  {
    title: 'Simple Roast Chicken',
    description: 'Perfectly roasted whole chicken with crispy skin',
    prep_time_minutes: 15,
    cook_time_minutes: 75,
    servings: 6,
    difficulty: 'Easy',
    ingredients: [
      { item: 'Whole chicken', quantity: '1', unit: '', notes: 'about 4 lbs' },
      { item: 'Butter', quantity: '4', unit: 'tbsp', notes: 'softened' },
      { item: 'Garlic', quantity: '4', unit: 'cloves', notes: 'minced' },
      { item: 'Lemon', quantity: '1', unit: '', notes: 'halved' },
      { item: 'Fresh thyme', quantity: '4', unit: 'sprigs', notes: '' },
      { item: 'Salt', quantity: '2', unit: 'tsp', notes: '' },
      { item: 'Black pepper', quantity: '1', unit: 'tsp', notes: '' },
    ],
    instructions: [
      { step: 1, text: 'Preheat oven to 425°F (220°C).', measurements: { temperatures: ['425°F'] } },
      { step: 2, text: 'Pat chicken completely dry with paper towels.' },
      { step: 3, text: 'Mix softened butter with garlic, salt, and pepper.' },
      { step: 4, text: 'Carefully loosen skin and rub butter mixture under and over the skin.' },
      { step: 5, text: 'Stuff cavity with lemon halves and thyme sprigs.' },
      { step: 6, text: 'Tie legs together with kitchen twine and tuck wing tips under.' },
      { step: 7, text: 'Place in roasting pan and roast for 1 hour 15 minutes.', measurements: { times: ['1 hour 15 minutes'] } },
      { step: 8, text: 'Check internal temperature reaches 165°F in thickest part of thigh.', measurements: { temperatures: ['165°F'] } },
      { step: 9, text: 'Rest for 10 minutes before carving.', measurements: { times: ['10 minutes'] } },
    ],
    equipment: ['Roasting pan', 'Kitchen twine', 'Meat thermometer'],
    tips: ['Dry skin = crispy skin', 'Let chicken come to room temperature before roasting'],
  },
  {
    title: 'Quick Stir-Fry with Timers',
    description: 'Fast vegetable stir-fry testing timer functionality',
    prep_time_minutes: 10,
    cook_time_minutes: 8,
    servings: 2,
    difficulty: 'Easy',
    ingredients: [
      { item: 'Mixed vegetables', quantity: '400', unit: 'g', notes: '' },
      { item: 'Soy sauce', quantity: '2', unit: 'tbsp', notes: '' },
      { item: 'Garlic', quantity: '2', unit: 'cloves', notes: '' },
      { item: 'Ginger', quantity: '1', unit: 'inch', notes: 'minced' },
      { item: 'Vegetable oil', quantity: '2', unit: 'tbsp', notes: '' },
    ],
    instructions: [
      { step: 1, text: 'Heat wok over high heat for 1 minute until smoking.', measurements: { times: ['1 minute'] } },
      { step: 2, text: 'Add oil and swirl to coat. Heat for 30 seconds.', measurements: { times: ['30 seconds'] } },
      { step: 3, text: 'Add garlic and ginger, stir for 15 seconds.', measurements: { times: ['15 seconds'] } },
      { step: 4, text: 'Add hard vegetables first, stir-fry 2 minutes.', measurements: { times: ['2 minutes'] } },
      { step: 5, text: 'Add soft vegetables, stir-fry 1 minute.', measurements: { times: ['1 minute'] } },
      { step: 6, text: 'Add soy sauce and toss for 30 seconds.', measurements: { times: ['30 seconds'] } },
      { step: 7, text: 'Serve immediately while hot.' },
    ],
    equipment: ['Wok', 'Spatula'],
  },
];

interface StateConfiguratorProps {
  onRecipeSelect: (recipe: Recipe | null) => void;
  selectedRecipe: Recipe | null;
}

export function StateConfigurator({ onRecipeSelect, selectedRecipe }: StateConfiguratorProps) {
  const {
    savedConfigurations,
    activeConfigurationId,
    simulatedActiveStep,
    simulatedProgress,
    saveConfiguration,
    deleteConfiguration,
    loadConfiguration,
    setActiveStep,
    resetSimulation,
  } = useComponentLabStore();

  const [configName, setConfigName] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const handleSaveConfiguration = useCallback(() => {
    if (!selectedRecipe || !configName.trim()) return;

    const config: RecipeConfiguration = {
      id: `config-${Date.now()}`,
      name: configName.trim(),
      recipe: selectedRecipe,
      videoId: 'sample',
      initialProgress: simulatedProgress,
      activeStep: simulatedActiveStep,
    };

    saveConfiguration(config);
    setConfigName('');
  }, [selectedRecipe, configName, simulatedProgress, simulatedActiveStep, saveConfiguration]);

  const handleLoadConfiguration = useCallback(
    (id: string) => {
      const config = savedConfigurations[id];
      if (config) {
        onRecipeSelect(config.recipe);
        loadConfiguration(id);
      }
    },
    [savedConfigurations, onRecipeSelect, loadConfiguration]
  );

  return (
    <div className="border-t border-zinc-800 bg-zinc-900/50">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/50 transition-colors"
      >
        <h3 className="text-sm font-medium text-zinc-300">State Configurator</h3>
        <svg
          className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Sample Recipes */}
          <div>
            <label className="block text-xs text-zinc-500 mb-2">Sample Recipes</label>
            <div className="grid grid-cols-1 gap-2">
              {SAMPLE_RECIPES.map((recipe, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onRecipeSelect(recipe);
                    resetSimulation();
                  }}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedRecipe?.title === recipe.title
                      ? 'bg-violet-600/20 text-violet-400 border border-violet-500/30'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                  }`}
                >
                  <div className="font-medium">{recipe.title}</div>
                  <div className="text-xs opacity-60">
                    {recipe.instructions.length} steps | {recipe.ingredients.length} ingredients
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Active Step Control */}
          {selectedRecipe && (
            <div>
              <label className="block text-xs text-zinc-500 mb-2">
                Active Step: {simulatedActiveStep} of {selectedRecipe.instructions.length}
              </label>
              <input
                type="range"
                min={1}
                max={selectedRecipe.instructions.length}
                value={simulatedActiveStep}
                onChange={(e) => setActiveStep(parseInt(e.target.value))}
                className="w-full accent-violet-500"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setActiveStep(Math.max(1, simulatedActiveStep - 1))}
                  disabled={simulatedActiveStep <= 1}
                  className="flex-1 px-3 py-1.5 text-sm bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() =>
                    setActiveStep(Math.min(selectedRecipe.instructions.length, simulatedActiveStep + 1))
                  }
                  disabled={simulatedActiveStep >= selectedRecipe.instructions.length}
                  className="flex-1 px-3 py-1.5 text-sm bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Progress Display */}
          {selectedRecipe && (
            <div className="text-xs text-zinc-500">
              Completed: {simulatedProgress.completedSteps.length} / {selectedRecipe.instructions.length} steps
              <button
                onClick={resetSimulation}
                className="ml-2 text-violet-400 hover:text-violet-300"
              >
                Reset
              </button>
            </div>
          )}

          {/* Save Configuration */}
          {selectedRecipe && (
            <div>
              <label className="block text-xs text-zinc-500 mb-2">Save Configuration</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={configName}
                  onChange={(e) => setConfigName(e.target.value)}
                  placeholder="Configuration name..."
                  className="flex-1 px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
                />
                <button
                  onClick={handleSaveConfiguration}
                  disabled={!configName.trim()}
                  className="px-3 py-1.5 text-sm bg-violet-600 text-white rounded hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Saved Configurations */}
          {Object.keys(savedConfigurations).length > 0 && (
            <div>
              <label className="block text-xs text-zinc-500 mb-2">Saved Configurations</label>
              <div className="space-y-1">
                {Object.values(savedConfigurations).map((config) => (
                  <div
                    key={config.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                      activeConfigurationId === config.id
                        ? 'bg-violet-600/20 border border-violet-500/30'
                        : 'bg-zinc-800'
                    }`}
                  >
                    <button
                      onClick={() => handleLoadConfiguration(config.id)}
                      className="flex-1 text-left text-zinc-300 hover:text-zinc-100"
                    >
                      {config.name}
                    </button>
                    <button
                      onClick={() => deleteConfiguration(config.id)}
                      className="ml-2 text-zinc-500 hover:text-red-400"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
