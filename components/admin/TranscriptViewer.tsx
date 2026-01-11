'use client';

import { useEffect, useRef, useMemo, ReactNode } from 'react';
import type { TranscriptSegment, CleanedTranscript } from '@/lib/types/admin';
import { formatTime } from '@/lib/admin/utils';

interface KeywordSet {
  ingredients: string[];
  techniques: string[];
  equipment: string[];
}

interface TranscriptViewerProps {
  segments: TranscriptSegment[];
  currentTime: number;
  isPlaying: boolean;
  onSeek: (time: number) => void;
  activeStepTimeRange?: { start: number; end: number } | null;
  activeStepKeywords?: KeywordSet | null;
  editingStep?: number | null;
  onSelectionComplete?: (startTime: number, endTime: number) => void;
  // Clean transcript props
  cleanedTranscript?: CleanedTranscript | null;
  showCleanedTranscript?: boolean;
  onToggleCleanedTranscript?: () => void;
  onGenerateCleanTranscript?: () => void;
  isGeneratingCleanTranscript?: boolean;
}

type KeywordType = 'ingredient' | 'technique' | 'equipment';

interface KeywordMatch {
  start: number;
  end: number;
  type: KeywordType;
  keyword: string;
}

function findKeywordMatches(text: string, keywords: KeywordSet): KeywordMatch[] {
  const matches: KeywordMatch[] = [];
  const textLower = text.toLowerCase();

  const searchKeywords = (words: string[], type: KeywordType) => {
    for (const keyword of words) {
      if (!keyword || keyword.length < 2) continue;
      const keywordLower = keyword.toLowerCase();
      let pos = 0;
      while (pos < textLower.length) {
        const idx = textLower.indexOf(keywordLower, pos);
        if (idx === -1) break;
        const beforeOk = idx === 0 || !/\w/.test(text[idx - 1]);
        const afterOk = idx + keyword.length >= text.length || !/\w/.test(text[idx + keyword.length]);
        if (beforeOk && afterOk) {
          matches.push({ start: idx, end: idx + keyword.length, type, keyword });
        }
        pos = idx + 1;
      }
    }
  };

  searchKeywords(keywords.ingredients, 'ingredient');
  searchKeywords(keywords.techniques, 'technique');
  searchKeywords(keywords.equipment, 'equipment');

  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  const filtered: KeywordMatch[] = [];
  let lastEnd = -1;
  for (const match of matches) {
    if (match.start >= lastEnd) {
      filtered.push(match);
      lastEnd = match.end;
    }
  }

  return filtered;
}

function getKeywordClasses(type: KeywordType): string {
  switch (type) {
    case 'ingredient':
      return 'bg-green-800/50 text-green-200 rounded px-0.5';
    case 'technique':
      return 'bg-blue-800/50 text-blue-200 rounded px-0.5';
    case 'equipment':
      return 'bg-orange-800/50 text-orange-200 rounded px-0.5';
  }
}

function renderHighlightedText(
  text: string,
  keywords: KeywordSet | null | undefined,
  isInActiveStep: boolean
): ReactNode {
  if (!keywords || !isInActiveStep) return text;

  const matches = findKeywordMatches(text, keywords);
  if (matches.length === 0) return text;

  const parts: ReactNode[] = [];
  let lastIdx = 0;

  matches.forEach((match, i) => {
    if (match.start > lastIdx) {
      parts.push(text.slice(lastIdx, match.start));
    }
    parts.push(
      <span key={i} className={getKeywordClasses(match.type)}>
        {text.slice(match.start, match.end)}
      </span>
    );
    lastIdx = match.end;
  });

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx));
  }

  return <>{parts}</>;
}

export function TranscriptViewer({
  segments,
  currentTime,
  isPlaying,
  onSeek,
  activeStepTimeRange,
  activeStepKeywords,
  editingStep,
  onSelectionComplete,
  cleanedTranscript,
  showCleanedTranscript,
  onToggleCleanedTranscript,
  onGenerateCleanTranscript,
  isGeneratingCleanTranscript,
}: TranscriptViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLSpanElement>(null);
  const activeCleanedRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = () => {
    if (!editingStep || !onSelectionComplete) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);

    const findSegmentElement = (node: Node): HTMLElement | null => {
      let current: Node | null = node;
      while (current) {
        if (current instanceof HTMLElement && current.dataset.segmentId) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    };

    const startEl = findSegmentElement(range.startContainer);
    const endEl = findSegmentElement(range.endContainer);

    if (startEl && endEl) {
      const startSegmentId = startEl.dataset.segmentId;
      const endSegmentId = endEl.dataset.segmentId;

      const startSegment = segments.find((s) => s.id === startSegmentId);
      const endSegment = segments.find((s) => s.id === endSegmentId);

      if (startSegment && endSegment) {
        const minStart = Math.min(startSegment.startTime, endSegment.startTime);
        const maxEnd = Math.max(startSegment.endTime, endSegment.endTime);

        onSelectionComplete(minStart, maxEnd);
        selection.removeAllRanges();
      }
    }
  };

  const activeSegmentId = useMemo(() => {
    for (const segment of segments) {
      if (currentTime >= segment.startTime && currentTime <= segment.endTime) {
        return segment.id;
      }
    }
    let closest: TranscriptSegment | null = null;
    for (const segment of segments) {
      if (segment.startTime <= currentTime) {
        closest = segment;
      } else {
        break;
      }
    }
    return closest?.id ?? null;
  }, [segments, currentTime]);

  const activeCleanedSectionId = useMemo(() => {
    if (!cleanedTranscript?.sections) return null;
    for (const section of cleanedTranscript.sections) {
      if (currentTime >= section.startTime && currentTime < section.endTime) {
        return section.id;
      }
    }
    // Find closest section that starts before current time
    let closest = null;
    for (const section of cleanedTranscript.sections) {
      if (section.startTime <= currentTime) {
        closest = section;
      } else {
        break;
      }
    }
    return closest?.id ?? null;
  }, [cleanedTranscript?.sections, currentTime]);

  useEffect(() => {
    if (isPlaying && activeRef.current && containerRef.current && !showCleanedTranscript) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSegmentId, isPlaying, showCleanedTranscript]);

  useEffect(() => {
    if (isPlaying && activeCleanedRef.current && containerRef.current && showCleanedTranscript) {
      activeCleanedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeCleanedSectionId, isPlaying, showCleanedTranscript]);

  if (segments.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500">
        No transcript available for this video.
      </div>
    );
  }

  const hasCleanedTranscript = !!(cleanedTranscript?.sections && cleanedTranscript.sections.length > 0);

  // Render controls bar
  const controlsBar = (
    <div className="sticky top-0 z-10 bg-zinc-800 border-b border-zinc-700 -mx-8 md:-mx-16 px-4 md:px-8 py-2 flex items-center gap-3">
      {/* Toggle buttons */}
      <div className="flex rounded-md overflow-hidden border border-zinc-600">
        <button
          onClick={onToggleCleanedTranscript}
          disabled={!onToggleCleanedTranscript}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            !showCleanedTranscript
              ? 'bg-zinc-600 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          Raw
        </button>
        <button
          onClick={onToggleCleanedTranscript}
          disabled={!hasCleanedTranscript || !onToggleCleanedTranscript}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            showCleanedTranscript
              ? 'bg-zinc-600 text-white'
              : hasCleanedTranscript
                ? 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
          }`}
        >
          Cleaned
        </button>
      </div>

      {/* Generate button */}
      {onGenerateCleanTranscript && (
        <button
          onClick={onGenerateCleanTranscript}
          disabled={isGeneratingCleanTranscript}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            isGeneratingCleanTranscript
              ? 'bg-zinc-700 text-zinc-500 cursor-wait'
              : 'bg-green-700 text-white hover:bg-green-600'
          }`}
        >
          {isGeneratingCleanTranscript
            ? 'Generating...'
            : hasCleanedTranscript
              ? 'Regenerate'
              : 'Generate Clean'}
        </button>
      )}

      {/* Info about cleaned transcript */}
      {hasCleanedTranscript && cleanedTranscript && (
        <span className="text-xs text-zinc-500 ml-auto">
          {cleanedTranscript.sections.length} sections
        </span>
      )}
    </div>
  );

  // Render cleaned transcript sections
  const renderCleanedSections = () => {
    if (!cleanedTranscript?.sections) return null;

    return (
      <div className="space-y-6">
        {cleanedTranscript.sections.map((section) => {
          const isActive = section.id === activeCleanedSectionId;
          const isInActiveStep =
            activeStepTimeRange &&
            section.startTime < activeStepTimeRange.end &&
            section.endTime > activeStepTimeRange.start;

          return (
            <div
              key={section.id}
              ref={isActive ? activeCleanedRef : null}
              onClick={() => onSeek(section.startTime)}
              className={`
                cursor-pointer rounded-lg p-4 transition-colors duration-150
                ${isActive
                  ? 'bg-red-900/50 border border-red-700'
                  : isInActiveStep
                    ? 'bg-yellow-900/40 border border-yellow-700/50'
                    : 'bg-zinc-800/50 hover:bg-zinc-800 border border-transparent'
                }
              `}
            >
              {section.heading && (
                <h3 className="text-sm font-semibold text-zinc-200 mb-2">
                  {section.heading}
                </h3>
              )}
              <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                {section.text}
              </p>
              <div className="mt-2 text-xs text-zinc-500 font-mono">
                {formatTime(section.startTime)} - {formatTime(section.endTime)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render raw transcript segments
  const renderRawSegments = () => (
    <>
      {segments.map((segment) => {
        const isActive = segment.id === activeSegmentId;
        const isInActiveStep =
          activeStepTimeRange &&
          segment.startTime >= activeStepTimeRange.start &&
          segment.startTime < activeStepTimeRange.end;

        return (
          <span
            key={segment.id}
            ref={isActive ? activeRef : null}
            data-segment-id={segment.id}
            onClick={editingStep ? undefined : () => onSeek(segment.startTime)}
            className={`
              relative inline ${editingStep ? 'cursor-text' : 'cursor-pointer'} rounded px-0.5 group
              transition-colors duration-150
              ${isActive
                ? 'bg-red-600/80 text-white'
                : isInActiveStep
                  ? 'bg-yellow-700/60 text-zinc-100'
                  : 'hover:bg-zinc-800 text-zinc-300'
              }
              ${editingStep ? 'selection:bg-blue-700' : ''}
            `}
          >
            {renderHighlightedText(segment.text, activeStepKeywords, !!activeStepKeywords)}{' '}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 rounded text-xs font-mono bg-zinc-700 text-zinc-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {formatTime(segment.startTime)}
            </span>
          </span>
        );
      })}
    </>
  );

  return (
    <div
      ref={containerRef}
      className={`h-full overflow-y-auto p-4 px-8 md:px-16 bg-zinc-900 leading-8 ${editingStep ? 'select-text' : ''}`}
      onMouseUp={handleMouseUp}
    >
      {controlsBar}

      {editingStep && (
        <div className="sticky top-10 z-10 bg-blue-900/50 border-b border-blue-700 -mx-8 md:-mx-16 px-8 md:px-16 py-2 mb-4 text-sm text-blue-300">
          Select text to set step boundaries for step {editingStep}
        </div>
      )}

      <div className="mt-4">
        {showCleanedTranscript && hasCleanedTranscript
          ? renderCleanedSections()
          : renderRawSegments()
        }
      </div>
    </div>
  );
}
