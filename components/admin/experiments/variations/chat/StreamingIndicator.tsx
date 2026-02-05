'use client';

export function StreamingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-zinc-800 rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-violet-400">Recipe Assistant</span>
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
