'use client';

import { useComponentLabStore } from '@/lib/stores/componentLabStore';
import { Recipe } from '@/lib/types';

// Import variations
import { FocusedStepView } from './variations/FocusedStepView';
import { QuickGlanceView } from './variations/QuickGlanceView';
import { VoiceOptimizedView } from './variations/VoiceOptimizedView';
import { ProgressTrackerView } from './variations/ProgressTrackerView';
import { TimerCentricView } from './variations/TimerCentricView';
import { AIVoiceAssistantView } from './variations/AIVoiceAssistantView';
import { TimelineOverviewView } from './variations/TimelineOverviewView';
import { SectionedRecipeView } from './variations/SectionedRecipeView';
import { WaitTimeManagerView } from './variations/WaitTimeManagerView';
import { RecipeChatConversational } from './variations/chat/RecipeChatConversational';
import { RecipeChatFocused } from './variations/chat/RecipeChatFocused';
import { RecipeChatGuided } from './variations/chat/RecipeChatGuided';
import { useRecipeChat } from '@/lib/hooks/useRecipeChat';
import { useCallback, useRef } from 'react';

interface RecipeViewLabProps {
  recipe: Recipe | null;
}

export function RecipeViewLab({ recipe }: RecipeViewLabProps) {
  const { activeVariation, simulatedActiveStep, simulatedProgress, setActiveStep, toggleStepComplete } =
    useComponentLabStore();

  // Chat state - shared across chat variants
  const {
    messages, input, setInput, isLoading, error, sendMessage, setMessages,
    generateRecipe, generatedRecipe, generatingRecipe
  } = useRecipeChat();

  // Ref to avoid recreating handleSubmit on every input change
  const inputRef = useRef(input);
  inputRef.current = input;

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, [setInput]);

  const handleSubmit = useCallback((e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    if (!inputRef.current.trim() || isLoading) return;
    sendMessage(inputRef.current);
    setInput('');
  }, [isLoading, sendMessage, setInput]);

  const append = useCallback((content: string) => {
    sendMessage(content);
  }, [sendMessage]);

  // Check if this is a chat variant (doesn't need recipe)
  const isChatVariant = activeVariation?.startsWith('chat-');

  // Show placeholder for recipe-based variants when no recipe selected
  if (!recipe && !isChatVariant) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <div className="text-center text-zinc-500">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg font-medium">No recipe selected</p>
          <p className="text-sm mt-1">Choose a sample recipe from the configurator below</p>
        </div>
      </div>
    );
  }

  const variationProps = {
    recipe: recipe!,
    activeStep: simulatedActiveStep,
    completedSteps: simulatedProgress.completedSteps,
    checkedIngredients: simulatedProgress.checkedIngredients,
    onStepChange: setActiveStep,
    onStepComplete: toggleStepComplete,
  };

  const chatProps = {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    generatingRecipe,
    generatedRecipe,
    onGenerateRecipe: generateRecipe,
  };

  return (
    <div className="flex-1 overflow-hidden bg-zinc-950">
      {activeVariation === 'focused-step' && <FocusedStepView {...variationProps} />}
      {activeVariation === 'quick-glance' && <QuickGlanceView {...variationProps} />}
      {activeVariation === 'voice-optimized' && <VoiceOptimizedView {...variationProps} />}
      {activeVariation === 'progress-tracker' && <ProgressTrackerView {...variationProps} />}
      {activeVariation === 'timer-centric' && <TimerCentricView {...variationProps} />}
      {activeVariation === 'ai-voice-assistant' && <AIVoiceAssistantView {...variationProps} />}
      {activeVariation === 'timeline-overview' && <TimelineOverviewView {...variationProps} />}
      {activeVariation === 'sectioned-recipe' && <SectionedRecipeView {...variationProps} />}
      {activeVariation === 'wait-time-manager' && <WaitTimeManagerView {...variationProps} />}
      {activeVariation === 'chat-conversational' && <RecipeChatConversational {...chatProps} />}
      {activeVariation === 'chat-focused' && <RecipeChatFocused {...chatProps} setMessages={setMessages} />}
      {activeVariation === 'chat-guided' && <RecipeChatGuided {...chatProps} append={append} />}
    </div>
  );
}
