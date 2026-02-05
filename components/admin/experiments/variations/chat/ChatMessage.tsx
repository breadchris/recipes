'use client';

import { ChatMessage as ChatMessageType } from '@/lib/hooks/useRecipeChat';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (!message.content) return null;

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-violet-600 text-white rounded-br-md'
            : 'bg-zinc-800 text-zinc-200 rounded-bl-md'
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-violet-400">Recipe Assistant</span>
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </div>
    </div>
  );
}
