'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { useChat, UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ChatToolResult, GenerateOffer } from '@/lib/types/recipe-chat';
import { GeneratedRecipe } from '@/lib/schemas/recipe';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolResults?: ChatToolResult[];
}

interface UseRecipeChatReturn {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  error: Error | null;
  sendMessage: (content: string) => Promise<void>;
  setMessages: (messages: ChatMessage[]) => void;
  generatingRecipe: string | null;
  generatedRecipe: GeneratedRecipe | null;
  generateRecipe: (title: string) => Promise<void>;
  clearGeneratedRecipe: () => void;
}

// Create transport outside component to prevent recreation on every render
const chatTransport = new DefaultChatTransport({
  api: '/api/admin/recipe-chat',
});

export function useRecipeChat(): UseRecipeChatReturn {
  // Manual input state (no longer provided by useChat in v3.x)
  const [input, setInput] = useState('');

  // AI SDK's useChat hook handles all stream parsing automatically
  const {
    messages: uiMessages,
    setMessages: setUiMessages,
    sendMessage: sdkSendMessage,
    status,
    error,
  } = useChat({
    transport: chatTransport,
  });

  // Derive isLoading from status
  const isLoading = status === 'streaming';

  // Recipe generation state (separate from chat)
  const [generatingRecipe, setGeneratingRecipe] = useState<string | null>(null);
  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
  const generateAbortRef = useRef<AbortController | null>(null);

  // Convert UIMessage[] to ChatMessage[] for backward compatibility with existing components
  const messages = useMemo(() => {
    return uiMessages
      .filter((msg): msg is UIMessage & { role: 'user' | 'assistant' } =>
        msg.role === 'user' || msg.role === 'assistant'
      )
      .map((msg) => {
        // Extract text content from parts
        let content = '';
        const toolResults: ChatToolResult[] = [];

        for (const part of msg.parts || []) {
          if (part.type === 'text') {
            content += part.text;
          } else if (part.type.startsWith('tool-')) {
            // Tool parts have the format: { type: 'tool-{toolName}', state: 'result', output: ... }
            const toolPart = part as { state?: string; output?: unknown };
            if (toolPart.state === 'output-available' && toolPart.output) {
              const output = toolPart.output;
              // Handle array of recipe results
              if (Array.isArray(output)) {
                toolResults.push(...(output as ChatToolResult[]));
              }
              // Handle generate-offer
              else if (output && typeof output === 'object' && 'type' in output && output.type === 'generate-offer') {
                toolResults.push(output as GenerateOffer);
              }
            }
          }
        }

        return {
          id: msg.id,
          role: msg.role,
          content,
          toolResults: toolResults.length > 0 ? toolResults : undefined,
        };
      });
  }, [uiMessages]);

  // Wrapper for sendMessage to match existing interface
  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isLoading) return;

    console.log('[recipe-chat] Sending message', { content: content.slice(0, 50) });
    setInput(''); // Clear input before sending
    await sdkSendMessage({ text: content.trim() });
  }, [sdkSendMessage, isLoading]);

  // Wrapper for setMessages that converts back to UIMessage format
  const setMessages = useCallback((newMessages: ChatMessage[]) => {
    const uiMsgs: UIMessage[] = newMessages.map((msg) => ({
      id: msg.id,
      role: msg.role,
      parts: [{ type: 'text' as const, text: msg.content }],
    }));
    setUiMessages(uiMsgs);
  }, [setUiMessages]);

  // Recipe generation (separate from chat streaming)
  const generateRecipe = useCallback(async (title: string) => {
    console.log('[recipe-chat] generateRecipe called', { title, currentlyGenerating: generatingRecipe });
    if (generatingRecipe) {
      console.log('[recipe-chat] Already generating, skipping');
      return;
    }

    // Cancel any existing generation
    if (generateAbortRef.current) {
      generateAbortRef.current.abort();
    }
    generateAbortRef.current = new AbortController();

    setGeneratingRecipe(title);
    setGeneratedRecipe(null);
    console.log('[recipe-chat] Starting recipe generation', { title });

    try {
      const response = await fetch('/api/generate-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: title }),
        signal: generateAbortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to generate recipe');
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });

        // Try to parse the accumulated JSON (it streams as partial object)
        try {
          const partialRecipe = JSON.parse(accumulated);
          setGeneratedRecipe(partialRecipe);
        } catch {
          // Not complete JSON yet, continue accumulating
        }
      }

      // Final parse
      try {
        const finalRecipe = JSON.parse(accumulated);
        setGeneratedRecipe(finalRecipe);
        console.log('[recipe-chat] Recipe generation completed', { title: finalRecipe.title });
      } catch (parseError) {
        console.error('[recipe-chat] Failed to parse generated recipe', { parseError });
        throw new Error('Failed to parse generated recipe');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('[recipe-chat] Recipe generation error', { error: (err as Error).message });
      }
    } finally {
      setGeneratingRecipe(null);
    }
  }, [generatingRecipe]);

  const clearGeneratedRecipe = useCallback(() => {
    setGeneratedRecipe(null);
  }, []);

  return {
    messages,
    input,
    setInput,
    isLoading,
    error: error || null,
    sendMessage,
    setMessages,
    generatingRecipe,
    generatedRecipe,
    generateRecipe,
    clearGeneratedRecipe,
  };
}
