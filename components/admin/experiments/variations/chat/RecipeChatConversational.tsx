'use client';

import { useRef, useEffect } from 'react';
import { ChatMessage as ChatMessageType } from '@/lib/hooks/useRecipeChat';
import { isGenerateOffer, RecipeSearchResult } from '@/lib/types/recipe-chat';
import { GeneratedRecipe } from '@/lib/schemas/recipe';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { StreamingIndicator } from './StreamingIndicator';
import { RecipeResultCard } from './RecipeResultCard';
import { GenerateOfferCard } from './GenerateOfferCard';
import { GeneratedRecipeCard } from './GeneratedRecipeCard';

interface RecipeChatConversationalProps {
  messages: ChatMessageType[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e?: { preventDefault?: () => void }) => void;
  isLoading: boolean;
  error: Error | null;
  generatingRecipe?: string | null;
  generatedRecipe?: GeneratedRecipe | null;
  onGenerateRecipe?: (title: string) => void;
  onGenerateInspired?: (recipe: RecipeSearchResult) => void;
}

export function RecipeChatConversational({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  error,
  generatingRecipe,
  generatedRecipe,
  onGenerateRecipe,
  onGenerateInspired,
}: RecipeChatConversationalProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="h-full flex flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-violet-600/20 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-zinc-200 mb-2">Recipe Chat</h3>
            <p className="text-sm text-zinc-500 max-w-sm">
              Tell me what you're in the mood for and I'll help you find the perfect recipe.
              Try "quick pasta dinner" or "healthy chicken recipes".
            </p>
          </div>
        )}

        {messages.map((message) => {
          // Separate tool results into recipes and generate offers
          const recipeResults = message.toolResults?.filter(
            (r): r is RecipeSearchResult => !isGenerateOffer(r)
          ) || [];
          const generateOffers = message.toolResults?.filter(isGenerateOffer) || [];

          return (
            <div key={message.id} className="space-y-3">
              <ChatMessage message={message} />

              {/* Render recipe cards */}
              {recipeResults.length > 0 && (
                <div className="ml-0 grid grid-cols-1 gap-2">
                  {recipeResults.map((recipe) => (
                    <RecipeResultCard
                      key={recipe.id}
                      recipe={recipe}
                      onGenerateInspired={onGenerateInspired}
                    />
                  ))}
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

      {/* Input area */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
        <ChatInput
          input={input}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder="What would you like to cook today?"
        />
      </div>
    </div>
  );
}
