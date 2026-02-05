'use client';

import { useState, useCallback, useRef } from 'react';
import { Recipe } from '@/lib/types';
import { ChatVariant, RecipeSearchResult } from '@/lib/types/recipe-chat';
import { useRecipeChat } from '@/lib/hooks/useRecipeChat';
import { RecipeChatConversational } from './chat/RecipeChatConversational';
import { RecipeChatFocused } from './chat/RecipeChatFocused';
import { RecipeChatGuided } from './chat/RecipeChatGuided';

interface RecipeChatViewProps {
  recipe: Recipe | null;
  activeStep: number;
  completedSteps: number[];
  checkedIngredients: number[];
  onStepChange: (step: number) => void;
  onStepComplete: (step: number) => void;
}

const VARIANT_INFO: Record<ChatVariant, { name: string; description: string }> = {
  conversational: {
    name: 'Conversational',
    description: 'Full chat history with recipe cards inline',
  },
  focused: {
    name: 'Focused',
    description: 'Single exchange with recipe grid below',
  },
  guided: {
    name: 'Guided',
    description: 'Quick action buttons with chat',
  },
};

export function RecipeChatView(_props: RecipeChatViewProps) {
  const [variant, setVariant] = useState<ChatVariant>('conversational');

  const {
    messages,
    input,
    setInput,
    isLoading,
    error,
    sendMessage,
    setMessages,
    generatingRecipe,
    generatedRecipe,
    generateRecipe,
    clearGeneratedRecipe,
  } = useRecipeChat();

  // Ref to avoid recreating handleSubmit on every input change
  const inputRef = useRef(input);
  inputRef.current = input;

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  }, [setInput]);

  const handleSubmit = useCallback((e?: { preventDefault?: () => void }) => {
    e?.preventDefault?.();
    if (!inputRef.current?.trim() || isLoading) return;

    sendMessage(inputRef.current);
    setInput('');
  }, [isLoading, sendMessage, setInput]);

  const append = useCallback((content: string) => {
    sendMessage(content);
  }, [sendMessage]);

  const handleGenerateInspired = useCallback((recipe: RecipeSearchResult) => {
    sendMessage(`Generate a recipe inspired by "${recipe.title}"`);
  }, [sendMessage]);

  const currentVariantInfo = VARIANT_INFO[variant];

  // Common props for all variants
  const commonProps = {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    generatingRecipe,
    generatedRecipe,
    onGenerateRecipe: generateRecipe,
    onGenerateInspired: handleGenerateInspired,
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Variant Switcher */}
      <div className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-1 p-2">
          {(Object.keys(VARIANT_INFO) as ChatVariant[]).map((v, index) => (
            <button
              key={v}
              onClick={() => setVariant(v)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                variant === v
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
              }`}
            >
              <span className="text-xs opacity-60 mr-1">{String.fromCharCode(65 + index)}.</span>
              {VARIANT_INFO[v].name}
            </button>
          ))}
        </div>
        <div className="px-4 pb-3">
          <p className="text-sm text-zinc-500">{currentVariantInfo.description}</p>
        </div>
      </div>

      {/* Render active variant */}
      <div className="flex-1 overflow-hidden">
        {variant === 'conversational' && <RecipeChatConversational {...commonProps} />}
        {variant === 'focused' && <RecipeChatFocused {...commonProps} setMessages={setMessages} />}
        {variant === 'guided' && <RecipeChatGuided {...commonProps} append={append} />}
      </div>
    </div>
  );
}
