'use client';

import { useMemo } from 'react';
import { ChatMessage as ChatMessageType } from '@/lib/hooks/useRecipeChat';
import { ChatInput } from './ChatInput';
import { StreamingIndicator } from './StreamingIndicator';
import { RecipeResultCard } from './RecipeResultCard';
import { GenerateOfferCard } from './GenerateOfferCard';
import { GeneratedRecipeCard } from './GeneratedRecipeCard';
import { RecipeSearchResult, isGenerateOffer, GenerateOffer, ChatToolResult } from '@/lib/types/recipe-chat';
import { GeneratedRecipe } from '@/lib/schemas/recipe';

interface RecipeChatFocusedProps {
  messages: ChatMessageType[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e?: { preventDefault?: () => void }) => void;
  isLoading: boolean;
  error: Error | null;
  setMessages: (messages: ChatMessageType[]) => void;
  generatingRecipe?: string | null;
  generatedRecipe?: GeneratedRecipe | null;
  onGenerateRecipe?: (title: string) => void;
  onGenerateInspired?: (recipe: RecipeSearchResult) => void;
}

export function RecipeChatFocused({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading,
  error,
  setMessages,
  generatingRecipe,
  generatedRecipe,
  onGenerateRecipe,
  onGenerateInspired,
}: RecipeChatFocusedProps) {
  // Get only the last user message and assistant response
  const lastExchange = useMemo(() => {
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];

    if (!lastUserMessage) return null;

    const lastUserIndex = messages.findIndex(m => m.id === lastUserMessage.id);
    const assistantResponses = messages
      .slice(lastUserIndex + 1)
      .filter(m => m.role === 'assistant');

    const lastAssistantMessage = assistantResponses[assistantResponses.length - 1];

    // Collect all tool results from this exchange
    const allToolResults: ChatToolResult[] = [];
    messages.slice(lastUserIndex).forEach(m => {
      if (m.toolResults) {
        allToolResults.push(...m.toolResults);
      }
    });

    // Separate into recipes and generate offers
    const recipeResults = allToolResults.filter(
      (r): r is RecipeSearchResult => !isGenerateOffer(r)
    );
    const generateOffers = allToolResults.filter(isGenerateOffer);

    return {
      userMessage: lastUserMessage,
      assistantMessage: lastAssistantMessage,
      results: recipeResults,
      generateOffers,
    };
  }, [messages]);

  const handleNewSearch = () => {
    setMessages([]);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Current exchange area */}
      <div className="flex-1 overflow-y-auto p-4">
        {!lastExchange && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-600/30 to-purple-600/30 flex items-center justify-center mb-6">
              <svg className="w-10 h-10 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-zinc-200 mb-2">Find Your Recipe</h3>
            <p className="text-sm text-zinc-500 max-w-md">
              Describe what you want to cook and I'll search our recipe collection for you.
            </p>
          </div>
        )}

        {lastExchange && (
          <div className="space-y-4">
            {/* User's query */}
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <div className="text-xs text-zinc-500 mb-1">You searched for:</div>
              <p className="text-zinc-200">{lastExchange.userMessage.content}</p>
            </div>

            {/* Assistant response */}
            {lastExchange.assistantMessage && lastExchange.assistantMessage.content && (
              <div className="text-sm text-zinc-400">
                {lastExchange.assistantMessage.content}
              </div>
            )}

            {/* Recipe results grid */}
            {lastExchange.results.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                {lastExchange.results.map((recipe) => (
                  <RecipeResultCard
                    key={recipe.id}
                    recipe={recipe}
                    onGenerateInspired={onGenerateInspired}
                  />
                ))}
              </div>
            )}

            {/* Generate offers */}
            {lastExchange.generateOffers.map((offer, index) => (
              <GenerateOfferCard
                key={`offer-${index}`}
                offer={offer}
                onGenerate={onGenerateRecipe || (() => {})}
                isGenerating={!!generatingRecipe}
              />
            ))}

            {/* Generated recipe */}
            {(generatingRecipe || generatedRecipe) && (
              <GeneratedRecipeCard
                recipe={generatedRecipe || {}}
                title={generatingRecipe || generatedRecipe?.title || ''}
                isGenerating={!!generatingRecipe}
              />
            )}

            {/* New search button */}
            <button
              onClick={handleNewSearch}
              className="mt-4 text-sm text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Start new search
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-zinc-700 border-t-violet-500 rounded-full animate-spin mb-4" />
            <p className="text-sm text-zinc-500">Searching recipes...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-600/20 border border-red-600/30 text-red-400 rounded-lg p-3 text-sm">
            Something went wrong. Please try again.
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
        <ChatInput
          input={input}
          onInputChange={handleInputChange}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder="Search for recipes..."
        />
      </div>
    </div>
  );
}
