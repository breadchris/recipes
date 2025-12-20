'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCookbookStore } from '@/lib/stores/cookbook';

interface NotesEditorProps {
  videoId: string;
  className?: string;
}

export default function NotesEditor({ videoId, className = '' }: NotesEditorProps) {
  const savedVideo = useCookbookStore((state) => state.getSavedVideo(videoId));
  const updateNotes = useCookbookStore((state) => state.updateNotes);

  const [localNotes, setLocalNotes] = useState(savedVideo?.notes || '');
  const [charCount, setCharCount] = useState(savedVideo?.notes.length || 0);

  // Update local state when saved video changes
  useEffect(() => {
    setLocalNotes(savedVideo?.notes || '');
    setCharCount(savedVideo?.notes.length || 0);
  }, [savedVideo?.notes]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLocalNotes(value);
    setCharCount(value.length);
  };

  const handleBlur = useCallback(() => {
    if (localNotes !== savedVideo?.notes) {
      updateNotes(videoId, localNotes);
    }
  }, [localNotes, savedVideo?.notes, updateNotes, videoId]);

  if (!savedVideo) {
    return null;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <label htmlFor={`notes-${videoId}`} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Recipe Notes
        </label>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {charCount} characters
        </span>
      </div>
      <textarea
        id={`notes-${videoId}`}
        value={localNotes}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="Write down your recipe here... (ingredients, steps, tips, etc.)"
        className="w-full min-h-[200px] p-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 placeholder-zinc-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-50 focus:border-transparent resize-y"
        rows={10}
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Notes are automatically saved when you click outside the text area
      </p>
    </div>
  );
}
