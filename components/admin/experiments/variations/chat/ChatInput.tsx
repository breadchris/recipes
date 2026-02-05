'use client';

import { FormEvent, KeyboardEvent } from 'react';

interface ChatInputProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ChatInput({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  placeholder = 'Ask about recipes...',
}: ChatInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading && input?.trim()) {
      e.preventDefault();
      const form = e.currentTarget.form;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <input
        type="text"
        value={input}
        onChange={onInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <button
        type="submit"
        disabled={isLoading || !input?.trim()}
        className="px-5 py-3 bg-violet-600 hover:bg-violet-500 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-violet-600"
      >
        {isLoading ? (
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        )}
      </button>
    </form>
  );
}
