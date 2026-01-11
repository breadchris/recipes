'use client';

import { useCallback } from 'react';
import { Recipe, Ingredient } from '@/lib/types';

interface FocusedStepViewProps {
  recipe: Recipe;
  activeStep: number;
  completedSteps: number[];
  checkedIngredients: number[];
  onStepChange: (step: number) => void;
  onStepComplete: (step: number) => void;
}

export function FocusedStepView({
  recipe,
  activeStep,
  completedSteps,
  onStepChange,
  onStepComplete,
}: FocusedStepViewProps) {
  const currentInstruction = recipe.instructions.find((i) => i.step === activeStep);
  const totalSteps = recipe.instructions.length;
  const isCompleted = completedSteps.includes(activeStep);

  const goToPrevious = useCallback(() => {
    if (activeStep > 1) {
      onStepChange(activeStep - 1);
    }
  }, [activeStep, onStepChange]);

  const goToNext = useCallback(() => {
    if (activeStep < totalSteps) {
      onStepChange(activeStep + 1);
    }
  }, [activeStep, totalSteps, onStepChange]);

  // Get ingredients mentioned in this step
  const stepIngredients: Ingredient[] = currentInstruction?.keywords?.ingredients || [];

  // Extract times from measurements
  const times = currentInstruction?.measurements?.times || [];
  const temperatures = currentInstruction?.measurements?.temperatures || [];

  if (!currentInstruction) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-zinc-500">No step found</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white select-none">
      {/* Progress Bar */}
      <div className="h-1 bg-zinc-800">
        <div
          className="h-full bg-violet-500 transition-all duration-300"
          style={{ width: `${(activeStep / totalSteps) * 100}%` }}
        />
      </div>

      {/* Step Counter */}
      <div className="text-center py-4 border-b border-zinc-800">
        <span className="text-zinc-500 text-lg">
          Step {activeStep} of {totalSteps}
        </span>
      </div>

      {/* Main Step Content */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-8 py-12 cursor-pointer"
        onClick={goToNext}
      >
        {/* Step Text - Extra Large */}
        <p className="text-3xl md:text-4xl lg:text-5xl font-medium text-center leading-relaxed max-w-4xl">
          {currentInstruction.text}
        </p>

        {/* Measurements */}
        {(times.length > 0 || temperatures.length > 0) && (
          <div className="flex flex-wrap gap-3 mt-8 justify-center">
            {temperatures.map((temp, idx) => (
              <span
                key={`temp-${idx}`}
                className="px-4 py-2 bg-red-600/20 text-red-400 rounded-full text-xl font-medium"
              >
                {temp}
              </span>
            ))}
            {times.map((time, idx) => (
              <button
                key={`time-${idx}`}
                onClick={(e) => {
                  e.stopPropagation();
                  // Timer would start here
                }}
                className="px-4 py-2 bg-teal-600/20 text-teal-400 rounded-full text-xl font-medium hover:bg-teal-600/30 transition-colors"
              >
                {time}
              </button>
            ))}
          </div>
        )}

        {/* Step Ingredients */}
        {stepIngredients.length > 0 && (
          <div className="mt-8 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800 max-w-2xl w-full">
            <h4 className="text-sm text-zinc-500 uppercase tracking-wide mb-3">For this step</h4>
            <div className="flex flex-wrap gap-2">
              {stepIngredients.map((ing, idx) => (
                <span key={idx} className="px-3 py-1.5 bg-green-900/30 text-green-400 rounded-lg text-lg">
                  {ing.quantity} {ing.unit} {ing.item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="p-4 border-t border-zinc-800 flex items-center justify-between gap-4">
        <button
          onClick={goToPrevious}
          disabled={activeStep <= 1}
          className="flex-1 py-4 bg-zinc-800 text-zinc-300 rounded-xl text-xl font-medium hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>

        <button
          onClick={() => onStepComplete(activeStep)}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${
            isCompleted
              ? 'bg-green-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
          }`}
        >
          {isCompleted ? (
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>

        <button
          onClick={goToNext}
          disabled={activeStep >= totalSteps}
          className="flex-1 py-4 bg-violet-600 text-white rounded-xl text-xl font-medium hover:bg-violet-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>

      {/* Tap hint */}
      <div className="text-center py-2 text-zinc-600 text-sm">
        Tap anywhere to advance
      </div>
    </div>
  );
}
