'use client';

import type { CleanedTranscript } from '@/lib/types';
import { formatTime } from '@/lib/parseTimeString';

interface TranscriptTabProps {
  cleanedTranscript: CleanedTranscript;
  onSeek: (time: number) => void;
}

export function TranscriptTab({
  cleanedTranscript,
  onSeek,
}: TranscriptTabProps) {
  if (!cleanedTranscript?.sections || cleanedTranscript.sections.length === 0) {
    return (
      <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-8 text-center">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No transcript sections available for this video.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-50 dark:bg-zinc-900 rounded-lg p-4 max-h-[500px] overflow-y-auto space-y-3">
      {cleanedTranscript.sections.map((section) => (
        <div
          key={section.id}
          onClick={() => onSeek(section.startTime)}
          className="cursor-pointer rounded-lg p-4 transition-colors duration-150 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
        >
          {section.heading && (
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
              {section.heading}
            </h3>
          )}
          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
            {section.text}
          </p>
          <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
            {formatTime(section.startTime)} - {formatTime(section.endTime)}
          </div>
        </div>
      ))}
    </div>
  );
}
