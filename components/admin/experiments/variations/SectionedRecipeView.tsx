'use client';

import { useMemo, useState } from 'react';
import { Recipe } from '@/lib/types';

interface SectionedRecipeViewProps {
  recipe: Recipe;
  activeStep: number;
  completedSteps: number[];
  checkedIngredients: number[];
  onStepChange: (step: number) => void;
  onStepComplete: (step: number) => void;
}

interface RecipeSection {
  id: string;
  name: string;
  description: string;
  steps: number[];
  estimatedMinutes: number;
  icon: string;
}

function parseTimeToMinutes(timeString: string): number {
  const hourMatch = timeString.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
  const minMatch = timeString.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)/i);
  const secMatch = timeString.match(/(\d+)\s*(?:seconds?|secs?)/i);

  let minutes = 0;
  if (hourMatch) minutes += parseFloat(hourMatch[1]) * 60;
  if (minMatch) minutes += parseFloat(minMatch[1]);
  if (secMatch) minutes += parseInt(secMatch[1]) / 60;

  if (!hourMatch && !minMatch && !secMatch) {
    const numMatch = timeString.match(/(\d+)/);
    if (numMatch) minutes = parseInt(numMatch[1]);
  }

  return minutes;
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hrs} hr`;
  return `${hrs}h ${mins}m`;
}

// Detect section type from step text
function detectSectionType(text: string): { type: string; icon: string } {
  const lowerText = text.toLowerCase();

  // Prep/mise en place
  if (lowerText.includes('chop') || lowerText.includes('dice') || lowerText.includes('mince') ||
      lowerText.includes('slice') || lowerText.includes('cut') || lowerText.includes('prepare') ||
      lowerText.includes('measure') || lowerText.includes('peel') || lowerText.includes('wash')) {
    return { type: 'prep', icon: '🔪' };
  }

  // Dough/bread related
  if (lowerText.includes('dough') || lowerText.includes('knead') || lowerText.includes('rise') ||
      lowerText.includes('proof') || lowerText.includes('flour') || lowerText.includes('yeast') ||
      lowerText.includes('bread')) {
    return { type: 'dough', icon: '🍞' };
  }

  // Sauce/dressing
  if (lowerText.includes('sauce') || lowerText.includes('dressing') || lowerText.includes('gravy') ||
      lowerText.includes('reduction') || lowerText.includes('glaze')) {
    return { type: 'sauce', icon: '🫗' };
  }

  // Cooking main protein
  if (lowerText.includes('sear') || lowerText.includes('grill') || lowerText.includes('roast') ||
      lowerText.includes('chicken') || lowerText.includes('beef') || lowerText.includes('pork') ||
      lowerText.includes('fish') || lowerText.includes('meat')) {
    return { type: 'protein', icon: '🥩' };
  }

  // Baking
  if (lowerText.includes('bake') || lowerText.includes('oven') || lowerText.includes('preheat')) {
    return { type: 'baking', icon: '🔥' };
  }

  // Vegetables
  if (lowerText.includes('vegetable') || lowerText.includes('salad') || lowerText.includes('sauté') ||
      lowerText.includes('steam')) {
    return { type: 'vegetables', icon: '🥗' };
  }

  // Mixing/combining
  if (lowerText.includes('mix') || lowerText.includes('combine') || lowerText.includes('stir') ||
      lowerText.includes('fold') || lowerText.includes('whisk')) {
    return { type: 'mixing', icon: '🥄' };
  }

  // Finishing/plating
  if (lowerText.includes('serve') || lowerText.includes('plate') || lowerText.includes('garnish') ||
      lowerText.includes('top with') || lowerText.includes('finish')) {
    return { type: 'finishing', icon: '🍽️' };
  }

  // Waiting/resting
  if (lowerText.includes('rest') || lowerText.includes('cool') || lowerText.includes('chill') ||
      lowerText.includes('refrigerate') || lowerText.includes('marinate') || lowerText.includes('let')) {
    return { type: 'resting', icon: '⏳' };
  }

  // Default
  return { type: 'cooking', icon: '👨‍🍳' };
}

const SECTION_NAMES: Record<string, string> = {
  prep: 'Prep Work',
  dough: 'Bread/Dough',
  sauce: 'Sauce',
  protein: 'Main Protein',
  baking: 'Baking',
  vegetables: 'Vegetables',
  mixing: 'Mixing',
  finishing: 'Finishing',
  resting: 'Resting',
  cooking: 'Cooking',
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  prep: 'Measure, chop, and prepare ingredients',
  dough: 'Mix, knead, and let the dough rise',
  sauce: 'Prepare sauces and dressings',
  protein: 'Cook the main protein',
  baking: 'Oven cooking steps',
  vegetables: 'Prepare and cook vegetables',
  mixing: 'Combine ingredients together',
  finishing: 'Final touches and plating',
  resting: 'Let food rest or cool',
  cooking: 'General cooking steps',
};

export function SectionedRecipeView({
  recipe,
  activeStep,
  completedSteps,
  onStepChange,
  onStepComplete,
}: SectionedRecipeViewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['all']));

  // Group steps into sections
  const sections = useMemo(() => {
    const sectionMap = new Map<string, RecipeSection>();

    recipe.instructions.forEach((instruction) => {
      const { type, icon } = detectSectionType(instruction.text);

      if (!sectionMap.has(type)) {
        sectionMap.set(type, {
          id: type,
          name: SECTION_NAMES[type] || type,
          description: SECTION_DESCRIPTIONS[type] || '',
          steps: [],
          estimatedMinutes: 0,
          icon,
        });
      }

      const section = sectionMap.get(type)!;
      section.steps.push(instruction.step);

      // Calculate time
      const times = instruction.measurements?.times || [];
      let stepDuration = times.reduce((sum, t) => sum + parseTimeToMinutes(t), 0);
      if (stepDuration === 0) stepDuration = 2;
      section.estimatedMinutes += stepDuration;
    });

    // Sort sections by first step appearance
    return Array.from(sectionMap.values()).sort((a, b) => {
      const aFirstStep = Math.min(...a.steps);
      const bFirstStep = Math.min(...b.steps);
      return aFirstStep - bFirstStep;
    });
  }, [recipe.instructions]);

  // Calculate total time
  const totalMinutes = sections.reduce((sum, s) => sum + s.estimatedMinutes, 0);

  // Find which section the active step is in
  const activeSection = sections.find(s => s.steps.includes(activeStep));

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const currentInstruction = recipe.instructions.find(i => i.step === activeStep);

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4">
        <h2 className="text-lg font-bold text-white">{recipe.title}</h2>
        <div className="flex items-center gap-4 mt-2 text-sm">
          <span className="text-zinc-400">
            {sections.length} sections • {recipe.instructions.length} steps
          </span>
          <span className="text-teal-400">~{formatDuration(totalMinutes)} total</span>
        </div>
      </div>

      {/* Current step highlight */}
      {currentInstruction && (
        <div className="bg-violet-600/20 border-b border-violet-500/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-violet-400 uppercase tracking-wide">
              Currently on Step {activeStep}
            </span>
            {activeSection && (
              <span className="px-2 py-0.5 bg-violet-500/30 text-violet-300 rounded text-xs">
                {activeSection.icon} {activeSection.name}
              </span>
            )}
          </div>
          <p className="text-white">{currentInstruction.text}</p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onStepComplete(activeStep)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                completedSteps.includes(activeStep)
                  ? 'bg-green-600 text-white'
                  : 'bg-violet-600 text-white hover:bg-violet-700'
              }`}
            >
              {completedSteps.includes(activeStep) ? '✓ Completed' : 'Mark Complete'}
            </button>
            {activeStep < recipe.instructions.length && (
              <button
                onClick={() => onStepChange(activeStep + 1)}
                className="px-4 py-2 bg-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-600 transition-colors"
              >
                Next Step →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sections list */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {sections.map((section) => {
            const completedInSection = section.steps.filter(s => completedSteps.includes(s)).length;
            const progressPercent = (completedInSection / section.steps.length) * 100;
            const isExpanded = expandedSections.has(section.id) || expandedSections.has('all');
            const isCurrent = activeSection?.id === section.id;

            return (
              <div
                key={section.id}
                className={`rounded-xl border transition-all ${
                  isCurrent
                    ? 'border-violet-500/50 bg-violet-600/10'
                    : 'border-zinc-800 bg-zinc-900/50'
                }`}
              >
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full p-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{section.icon}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">{section.name}</h3>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 bg-violet-500 text-white text-xs rounded">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">{section.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm text-zinc-400">
                        {completedInSection}/{section.steps.length} steps
                      </div>
                      <div className="text-xs text-teal-400">
                        {formatDuration(section.estimatedMinutes)}
                      </div>
                    </div>

                    {/* Progress ring */}
                    <div className="relative w-10 h-10">
                      <svg className="w-10 h-10 -rotate-90">
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          className="text-zinc-700"
                        />
                        <circle
                          cx="20"
                          cy="20"
                          r="16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeDasharray={`${progressPercent} 100`}
                          strokeLinecap="round"
                          className={progressPercent === 100 ? 'text-green-500' : 'text-violet-500'}
                        />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xs text-zinc-400">
                        {Math.round(progressPercent)}%
                      </span>
                    </div>

                    <svg
                      className={`w-5 h-5 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded steps */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 p-3 space-y-2">
                    {section.steps.map((stepNum) => {
                      const instruction = recipe.instructions.find(i => i.step === stepNum);
                      if (!instruction) return null;

                      const isStepActive = stepNum === activeStep;
                      const isStepComplete = completedSteps.includes(stepNum);
                      const times = instruction.measurements?.times || [];

                      return (
                        <div
                          key={stepNum}
                          onClick={() => onStepChange(stepNum)}
                          className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                            isStepActive
                              ? 'bg-violet-600/20 border border-violet-500/30'
                              : isStepComplete
                              ? 'bg-green-600/10 opacity-60'
                              : 'hover:bg-zinc-800'
                          }`}
                        >
                          {/* Step indicator */}
                          <div
                            className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                              isStepComplete
                                ? 'bg-green-500 text-white'
                                : isStepActive
                                ? 'bg-violet-500 text-white'
                                : 'bg-zinc-700 text-zinc-400'
                            }`}
                          >
                            {isStepComplete ? '✓' : stepNum}
                          </div>

                          {/* Step content */}
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${isStepComplete ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>
                              {instruction.text}
                            </p>
                            {times.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {times.map((time, idx) => (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.5 text-xs bg-teal-500/20 text-teal-400 rounded"
                                  >
                                    {time}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="border-t border-zinc-800 p-3 flex gap-2">
        <button
          onClick={() => onStepChange(Math.max(1, activeStep - 1))}
          disabled={activeStep <= 1}
          className="flex-1 py-3 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 disabled:opacity-30 transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => onStepChange(Math.min(recipe.instructions.length, activeStep + 1))}
          disabled={activeStep >= recipe.instructions.length}
          className="flex-1 py-3 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 disabled:opacity-30 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
