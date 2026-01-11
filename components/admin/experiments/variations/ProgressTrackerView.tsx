'use client';

import { useMemo } from 'react';
import { Recipe } from '@/lib/types';

interface ProgressTrackerViewProps {
  recipe: Recipe;
  activeStep: number;
  completedSteps: number[];
  checkedIngredients: number[];
  onStepChange: (step: number) => void;
  onStepComplete: (step: number) => void;
}

export function ProgressTrackerView({
  recipe,
  activeStep,
  completedSteps,
  checkedIngredients,
  onStepChange,
  onStepComplete,
}: ProgressTrackerViewProps) {
  const totalSteps = recipe.instructions.length;
  const completedCount = completedSteps.length;
  const progressPercent = Math.round((completedCount / totalSteps) * 100);

  const currentInstruction = recipe.instructions.find((i) => i.step === activeStep);
  const upcomingSteps = recipe.instructions.filter((i) => i.step > activeStep).slice(0, 3);

  // Estimate remaining time based on times in remaining steps
  const estimatedTimeRemaining = useMemo(() => {
    let totalMinutes = 0;
    recipe.instructions.forEach((inst) => {
      if (!completedSteps.includes(inst.step)) {
        inst.measurements?.times?.forEach((time) => {
          const match = time.match(/(\d+)\s*(minute|min|hour|hr|second|sec)/i);
          if (match) {
            let minutes = parseInt(match[1]);
            if (match[2].toLowerCase().startsWith('hour') || match[2].toLowerCase().startsWith('hr')) {
              minutes *= 60;
            } else if (match[2].toLowerCase().startsWith('second') || match[2].toLowerCase().startsWith('sec')) {
              minutes = Math.ceil(minutes / 60);
            }
            totalMinutes += minutes;
          }
        });
      }
    });
    return totalMinutes;
  }, [recipe.instructions, completedSteps]);

  const ingredientProgress = {
    checked: checkedIngredients.length,
    total: recipe.ingredients.length,
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Large Progress Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-6">
        {/* Progress Ring and Percentage */}
        <div className="flex items-center gap-6">
          <div className="relative w-24 h-24">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-zinc-800"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${progressPercent * 2.51} 251`}
                className="text-violet-500 transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">{progressPercent}%</span>
            </div>
          </div>

          <div className="flex-1">
            <div className="text-xl font-medium text-white">
              {completedCount} of {totalSteps} steps complete
            </div>
            {estimatedTimeRemaining > 0 && (
              <div className="text-sm text-zinc-500 mt-1">
                ~{estimatedTimeRemaining} minutes remaining
              </div>
            )}
            <div className="flex gap-4 mt-3">
              <div className="text-sm">
                <span className="text-green-400">{ingredientProgress.checked}</span>
                <span className="text-zinc-600">/{ingredientProgress.total} ingredients</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Current Step - Expanded */}
        {currentInstruction && (
          <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
            <div className="text-xs text-violet-400 uppercase tracking-wide mb-2">Current Step</div>
            <div className="flex gap-4">
              <button
                onClick={() => onStepComplete(currentInstruction.step)}
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  completedSteps.includes(currentInstruction.step)
                    ? 'bg-green-500 text-white'
                    : 'bg-violet-600 text-white'
                }`}
              >
                {completedSteps.includes(currentInstruction.step) ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-lg font-bold">{currentInstruction.step}</span>
                )}
              </button>
              <div className="flex-1">
                <p className="text-lg text-white leading-relaxed">{currentInstruction.text}</p>
                {currentInstruction.measurements?.times && currentInstruction.measurements.times.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {currentInstruction.measurements.times.map((time, idx) => (
                      <span key={idx} className="px-3 py-1 bg-teal-600/20 text-teal-400 rounded-full text-sm">
                        {time}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Upcoming Steps */}
        {upcomingSteps.length > 0 && (
          <div className="p-4 border-b border-zinc-800">
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Coming Up</div>
            <div className="space-y-3">
              {upcomingSteps.map((instruction) => (
                <button
                  key={instruction.step}
                  onClick={() => onStepChange(instruction.step)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-800 transition-colors text-left"
                >
                  <span className="w-7 h-7 rounded-full bg-zinc-700 text-zinc-400 flex items-center justify-center text-sm flex-shrink-0">
                    {instruction.step}
                  </span>
                  <p className="text-sm text-zinc-400 line-clamp-2">{instruction.text}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Completed Steps - Collapsed */}
        {completedSteps.length > 0 && (
          <div className="p-4">
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
              Completed ({completedSteps.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {completedSteps
                .sort((a, b) => a - b)
                .map((stepNum) => (
                  <button
                    key={stepNum}
                    onClick={() => onStepChange(stepNum)}
                    className="w-8 h-8 rounded-full bg-green-600/20 text-green-400 flex items-center justify-center text-sm hover:bg-green-600/30 transition-colors"
                  >
                    {stepNum}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* All Steps List */}
        <div className="p-4 border-t border-zinc-800">
          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">All Steps</div>
          <div className="space-y-1">
            {recipe.instructions.map((instruction) => {
              const isActive = instruction.step === activeStep;
              const isComplete = completedSteps.includes(instruction.step);

              return (
                <button
                  key={instruction.step}
                  onClick={() => onStepChange(instruction.step)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-violet-600/20 border border-violet-500/30'
                      : isComplete
                      ? 'bg-green-600/10'
                      : 'hover:bg-zinc-800/50'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${
                      isComplete
                        ? 'bg-green-500 text-white'
                        : isActive
                        ? 'bg-violet-600 text-white'
                        : 'bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {isComplete ? '✓' : instruction.step}
                  </span>
                  <span
                    className={`text-sm truncate ${
                      isComplete ? 'text-zinc-500 line-through' : isActive ? 'text-white' : 'text-zinc-400'
                    }`}
                  >
                    {instruction.text}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="border-t border-zinc-800 p-3 flex gap-2">
        <button
          onClick={() => onStepChange(Math.max(1, activeStep - 1))}
          disabled={activeStep <= 1}
          className="flex-1 py-3 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 disabled:opacity-30 transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => onStepComplete(activeStep)}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            completedSteps.includes(activeStep)
              ? 'bg-green-600 text-white'
              : 'bg-violet-600 text-white hover:bg-violet-700'
          }`}
        >
          {completedSteps.includes(activeStep) ? 'Completed' : 'Mark Done'}
        </button>
        <button
          onClick={() => onStepChange(Math.min(totalSteps, activeStep + 1))}
          disabled={activeStep >= totalSteps}
          className="flex-1 py-3 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 disabled:opacity-30 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
