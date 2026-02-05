'use client';

import { useRef, useEffect } from 'react';
import { ChatMessage as ChatMessageType } from '@/lib/hooks/useRecipeChat';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { StreamingIndicator } from './StreamingIndicator';
import { RecipeResultCard } from './RecipeResultCard';
import { GenerateOfferCard } from './GenerateOfferCard';
import { GeneratedRecipeCard } from './GeneratedRecipeCard';
import { QUICK_ACTIONS, isGenerateOffer, RecipeSearchResult } from '@/lib/types/recipe-chat';
import { GeneratedRecipe } from '@/lib/schemas/recipe';

interface RecipeChatGuidedProps {
  messages: ChatMessageType[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e?: { preventDefault?: () => void }) => void;
  isLoading: boolean;
  error: Error | null;
  append: (content: string) => void;
  generatingRecipe?: string | null;
  generatedRecipe?: GeneratedRecipe | null;
  onGenerateRecipe?: (title: string) => void;
  onGenerateInspired?: (recipe: RecipeSearchResult) => void;
}

export function RecipeChatGuided({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  error,
  append,
  generatingRecipe,
  generatedRecipe,
  onGenerateRecipe,
  onGenerateInspired,
}: RecipeChatGuidedProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleQuickAction = (prompt: string) => {
    if (isLoading) return;
    append(prompt);
  };

  // Suggested follow-up questions based on context
  const suggestedFollowUps = [
    'Show me something easier',
    'Find vegetarian options',
    'Under 30 minutes',
    'More like these',
  ];

  const hasMessages = messages.length > 0;

  return (
    <div className="h-full flex flex-col">
      {/* Quick actions header */}
      {!hasMessages && (
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
          <p className="text-xs text-zinc-500 mb-3">Quick searches:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action.prompt)}
                disabled={isLoading}
                className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!hasMessages && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/20 to-purple-600/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-zinc-200 mb-2">Let's Find You a Recipe</h3>
            <p className="text-sm text-zinc-500 max-w-sm">
              Click a quick search above or type your own request below.
            </p>
          </div>
        )}

        {messages.map((message) => {
          const recipeResults = message.toolResults?.filter(
            (r): r is RecipeSearchResult => !isGenerateOffer(r)
          ) || [];
          const generateOffers = message.toolResults?.filter(isGenerateOffer) || [];

          return (
            <div key={message.id} className="space-y-3">
              <ChatMessage message={message} />

              {/* Render recipe cards */}
              {recipeResults.length > 0 && (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2">
                    {recipeResults.map((recipe) => (
                      <RecipeResultCard
                        key={recipe.id}
                        recipe={recipe}
                        onGenerateInspired={onGenerateInspired}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Render generate offers */}
              {generateOffers.map((offer, index) => (
                <GenerateOfferCard
                  key={`offer-${index}`}
                  offer={offer}
                  onGenerate={onGenerateRecipe || (() => {})}
                  isGenerating={!!generatingRecipe}
                />
              ))}
            </div>
          );
        })}

        {isLoading && <StreamingIndicator />}

        {/* Show generated recipe */}
        {(generatingRecipe || generatedRecipe) && (
          <GeneratedRecipeCard
            recipe={generatedRecipe || {}}
            title={generatingRecipe || generatedRecipe?.title || ''}
            isGenerating={!!generatingRecipe}
          />
        )}

        {error && (
          <div className="bg-red-600/20 border border-red-600/30 text-red-400 rounded-lg p-3 text-sm">
            Something went wrong. Please try again.
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested follow-ups */}
      {hasMessages && !isLoading && (
        <div className="px-4 pb-2">
          <div className="flex flex-wrap gap-2">
            {suggestedFollowUps.map((followUp) => (
              <button
                key={followUp}
                onClick={() => handleQuickAction(followUp)}
                className="px-3 py-1.5 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 rounded-full text-xs transition-colors border border-zinc-700/50"
              >
                {followUp}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
        <ChatInput
          input={input}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder="Or describe what you're looking for..."
        />
      </div>
    </div>
  );
}
