'use client';

import { useMemo } from 'react';
import { Recipe } from '@/lib/types';
import { ExtractedAction } from '@/lib/types/component-lab';

interface QuickGlanceViewProps {
  recipe: Recipe;
  activeStep: number;
  completedSteps: number[];
  checkedIngredients: number[];
  onStepChange: (step: number) => void;
  onStepComplete: (step: number) => void;
}

// Common cooking action verbs
const ACTION_VERBS = [
  'add', 'bake', 'beat', 'blend', 'boil', 'broil', 'brown', 'brush', 'chill', 'chop',
  'coat', 'combine', 'cook', 'cool', 'cover', 'cut', 'dice', 'drain', 'drizzle', 'dry',
  'fold', 'fry', 'grate', 'grill', 'heat', 'knead', 'layer', 'marinate', 'mash', 'melt',
  'mix', 'peel', 'place', 'pour', 'preheat', 'press', 'reduce', 'remove', 'rest', 'roast',
  'roll', 'saute', 'sear', 'season', 'serve', 'set', 'simmer', 'slice', 'spread', 'sprinkle',
  'steam', 'stir', 'strain', 'stuff', 'toss', 'transfer', 'turn', 'whisk', 'wrap'
];

function extractAction(text: string, stepNumber: number): ExtractedAction {
  const words = text.toLowerCase().split(/\s+/);
  const firstWord = words[0].replace(/[^a-z]/g, '');

  // Find the action verb
  let verb = ACTION_VERBS.find(v => text.toLowerCase().includes(v)) || firstWord;
  verb = verb.toUpperCase();

  // Extract subject (usually the noun after the verb)
  const subjectMatch = text.match(/(?:the\s+)?(\w+(?:\s+\w+)?)\s*(?:until|for|in|with|to|into|on|at|about|over)/i);
  const subject = subjectMatch ? subjectMatch[1] : '';

  // Extract measurement (time or temperature)
  const timeMatch = text.match(/(\d+(?:\s*-\s*\d+)?\s*(?:minutes?|mins?|seconds?|secs?|hours?|hrs?))/i);
  const tempMatch = text.match(/(\d+°?[FC])/i);
  const measurement = timeMatch?.[1] || tempMatch?.[1] || undefined;

  return {
    verb,
    subject,
    measurement,
    fullText: text,
    stepNumber,
  };
}

export function QuickGlanceView({
  recipe,
  activeStep,
  completedSteps,
  onStepChange,
  onStepComplete,
}: QuickGlanceViewProps) {
  const totalSteps = recipe.instructions.length;

  const extractedActions = useMemo(() => {
    return recipe.instructions.map((inst) => extractAction(inst.text, inst.step));
  }, [recipe.instructions]);

  const currentAction = extractedActions.find((a) => a.stepNumber === activeStep);
  const nextAction = extractedActions.find((a) => a.stepNumber === activeStep + 1);

  return (
    <div className="h-full flex flex-col bg-black text-white">
      {/* Ultra-minimal header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-900">
        <span className="text-zinc-600 font-mono">
          {activeStep}/{totalSteps}
        </span>
        <span className="text-zinc-600 text-sm">{recipe.title}</span>
      </div>

      {/* Main content - scroll snap */}
      <div className="flex-1 overflow-y-auto snap-y snap-mandatory">
        {extractedActions.map((action, idx) => {
          const isActive = action.stepNumber === activeStep;
          const isComplete = completedSteps.includes(action.stepNumber);
          const isPast = action.stepNumber < activeStep;

          return (
            <div
              key={action.stepNumber}
              className={`min-h-[50vh] snap-start p-6 flex flex-col justify-center border-b border-zinc-900 transition-all ${
                isActive ? 'bg-zinc-950' : isPast ? 'bg-zinc-950/50' : 'bg-black'
              }`}
              onClick={() => onStepChange(action.stepNumber)}
            >
              {/* Step indicator */}
              <div className="flex items-center gap-3 mb-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStepComplete(action.stepNumber);
                  }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    isComplete
                      ? 'bg-green-500 text-black'
                      : isActive
                      ? 'bg-white text-black'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {isComplete ? '✓' : action.stepNumber}
                </button>
                {isActive && (
                  <span className="text-xs text-zinc-600 uppercase tracking-widest">Current</span>
                )}
              </div>

              {/* Extracted action - large and bold */}
              <div className={`transition-opacity ${isPast && !isActive ? 'opacity-40' : ''}`}>
                <div className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight leading-none">
                  <span className="text-violet-400">{action.verb}</span>
                  {action.subject && (
                    <span className="text-white ml-3">{action.subject}</span>
                  )}
                </div>

                {action.measurement && (
                  <div className="mt-4">
                    <span className="inline-block px-4 py-2 bg-teal-500/20 text-teal-300 rounded-lg text-2xl font-bold">
                      {action.measurement}
                    </span>
                  </div>
                )}

                {/* Full text - smaller, toggleable */}
                {isActive && (
                  <p className="mt-6 text-lg text-zinc-500 leading-relaxed max-w-2xl">
                    {action.fullText}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom navigation - extra large touch targets */}
      <div className="flex border-t border-zinc-900">
        <button
          onClick={() => onStepChange(Math.max(1, activeStep - 1))}
          disabled={activeStep <= 1}
          className="flex-1 py-6 text-2xl font-bold text-zinc-500 hover:text-white hover:bg-zinc-900 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          ←
        </button>
        <div className="w-px bg-zinc-900" />
        <button
          onClick={() => onStepComplete(activeStep)}
          className={`flex-1 py-6 text-2xl font-bold transition-colors ${
            completedSteps.includes(activeStep)
              ? 'bg-green-500/20 text-green-400'
              : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
          }`}
        >
          DONE
        </button>
        <div className="w-px bg-zinc-900" />
        <button
          onClick={() => onStepChange(Math.min(totalSteps, activeStep + 1))}
          disabled={activeStep >= totalSteps}
          className="flex-1 py-6 text-2xl font-bold text-zinc-500 hover:text-white hover:bg-zinc-900 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
        >
          →
        </button>
      </div>
    </div>
  );
}
