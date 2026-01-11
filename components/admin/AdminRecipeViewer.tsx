'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { AdminVideoPlayer } from './AdminVideoPlayer';
import { Timeline } from './Timeline';
import { StepList } from './StepList';
import { TranscriptViewer } from './TranscriptViewer';
import { VersionControlPanel } from './VersionControlPanel';
import type {
  VideoRecipes,
  AdminRecipeContent,
  TimelineAnnotation,
  StepSection,
  KeywordType,
  TranscriptSegment,
  RecipeVersionInfo,
  CleanedTranscript,
} from '@/lib/types/admin';

interface PendingStepChanges {
  notes?: string;
  timestamp_seconds?: number;
  end_time_seconds?: number;
  text?: string;
}

interface AdminRecipeViewerProps {
  recipe: VideoRecipes;
  versionInfo?: RecipeVersionInfo;
  availableVersions?: number[];
  onVersionChange?: (version: number) => void;
  onRegenerate?: (prompt: string) => Promise<void>;
  isRegenerating?: boolean;
  onRegenerate2Stage?: (prompt: string) => Promise<void>;
  isRegenerating2Stage?: boolean;
  onSaveChanges?: (
    changes: { step: number; notes?: string; predicted_time?: { start_seconds: number; end_seconds: number } }[]
  ) => Promise<void>;
}

export function AdminRecipeViewer({
  recipe,
  versionInfo,
  availableVersions,
  onVersionChange,
  onRegenerate,
  isRegenerating = false,
  onRegenerate2Stage,
  isRegenerating2Stage = false,
  onSaveChanges,
}: AdminRecipeViewerProps) {
  const [selectedRecipeIndex, setSelectedRecipeIndex] = useState(0);
  const recipeContent: AdminRecipeContent | undefined = recipe.recipes[selectedRecipeIndex];

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekTo, setSeekTo] = useState<number | undefined>(undefined);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [filterTypes, setFilterTypes] = useState<KeywordType[]>(['ingredient', 'technique', 'equipment']);
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [videoHeightPercent, setVideoHeightPercent] = useState(50);
  const [isResizingVertical, setIsResizingVertical] = useState(false);
  const [leftPanelWidthPercent, setLeftPanelWidthPercent] = useState(55);
  const [isResizingHorizontal, setIsResizingHorizontal] = useState(false);
  const [isLargeScreen, setIsLargeScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Map<number, PendingStepChanges>>(new Map());
  const [deletedSteps, setDeletedSteps] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  // Clean transcript state
  const [cleanedTranscript, setCleanedTranscript] = useState<CleanedTranscript | null>(null);
  const [showCleanedTranscript, setShowCleanedTranscript] = useState(false);
  const [isGeneratingCleanTranscript, setIsGeneratingCleanTranscript] = useState(false);

  const hasUnsavedChanges = pendingChanges.size > 0 || deletedSteps.size > 0;

  const pendingNotes = useMemo(() => {
    const notes = new Map<number, string>();
    pendingChanges.forEach((changes, step) => {
      if (changes.notes !== undefined) {
        notes.set(step, changes.notes);
      }
    });
    return notes;
  }, [pendingChanges]);

  const pendingBoundaries = useMemo(() => {
    const boundaries = new Map<number, { timestamp_seconds?: number; end_time_seconds?: number }>();
    pendingChanges.forEach((changes, step) => {
      if (changes.timestamp_seconds !== undefined || changes.end_time_seconds !== undefined) {
        boundaries.set(step, {
          timestamp_seconds: changes.timestamp_seconds,
          end_time_seconds: changes.end_time_seconds,
        });
      }
    });
    return boundaries;
  }, [pendingChanges]);

  const pendingText = useMemo(() => {
    const texts = new Map<number, string>();
    pendingChanges.forEach((changes, step) => {
      if (changes.text !== undefined) {
        texts.set(step, changes.text);
      }
    });
    return texts;
  }, [pendingChanges]);

  useEffect(() => {
    const checkScreenSize = () => setIsLargeScreen(window.innerWidth >= 1024);
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Reset selected recipe index when navigating to a different video
  useEffect(() => {
    setSelectedRecipeIndex(0);
  }, [recipe.video_id]);

  const videoUrl = `https://www.youtube.com/watch?v=${recipe.video_id}`;

  // Vertical resize handler (for video/steps split on right panel)
  useEffect(() => {
    if (!isResizingVertical) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const percent = (y / rect.height) * 100;
      setVideoHeightPercent(Math.min(80, Math.max(20, percent)));
    };
    const handleMouseUp = () => setIsResizingVertical(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingVertical]);

  // Horizontal resize handler (for left/right panel split)
  useEffect(() => {
    if (!isResizingHorizontal) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!mainContainerRef.current) return;
      const rect = mainContainerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = (x / rect.width) * 100;
      setLeftPanelWidthPercent(Math.min(80, Math.max(30, percent)));
    };
    const handleMouseUp = () => setIsResizingHorizontal(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingHorizontal]);

  useEffect(() => {
    async function fetchTranscript() {
      try {
        const response = await fetch(`/api/admin/recipes/${recipe.video_id}/transcript`);
        if (response.ok) {
          const data = await response.json();
          setTranscriptSegments(data.segments || []);
        }
      } catch (error) {
        console.error('Failed to fetch transcript:', error);
      }
    }
    fetchTranscript();
  }, [recipe.video_id]);

  // Load cleaned transcript from recipe on mount
  useEffect(() => {
    if (recipe.cleaned_transcript) {
      setCleanedTranscript(recipe.cleaned_transcript);
    }
  }, [recipe.cleaned_transcript]);

  const annotations = useMemo<TimelineAnnotation[]>(() => {
    if (!recipeContent?.instructions) return [];
    const result: TimelineAnnotation[] = [];
    let id = 0;
    recipeContent.instructions.forEach((instruction) => {
      if (!instruction.video_references) return;
      instruction.video_references.forEach((ref) => {
        let type: KeywordType = 'ingredient';
        if (instruction.keywords) {
          if (instruction.keywords.techniques?.includes(ref.keyword)) {
            type = 'technique';
          } else if (instruction.keywords.equipment?.includes(ref.keyword)) {
            type = 'equipment';
          }
        }
        result.push({
          id: `ann-${id++}`,
          keyword: ref.keyword,
          timestamp: ref.timestamp_seconds,
          context: ref.context,
          type,
          stepNumber: instruction.step,
        });
      });
    });
    return result;
  }, [recipeContent?.instructions]);

  const sections = useMemo<StepSection[]>(() => {
    if (!recipeContent?.instructions) return [];
    return recipeContent.instructions.map((instruction) => {
      const pending = pendingBoundaries.get(instruction.step);
      return {
        id: `step-${instruction.step}`,
        stepNumber: instruction.step,
        title: instruction.text.substring(0, 50) + (instruction.text.length > 50 ? '...' : ''),
        startTime: pending?.timestamp_seconds ?? instruction.timestamp_seconds ?? 0,
        endTime: pending?.end_time_seconds ?? instruction.end_time_seconds ?? 0,
      };
    });
  }, [recipeContent?.instructions, pendingBoundaries]);

  const activeStepTimeRange = useMemo(() => {
    if (activeStep === null) return null;
    const section = sections.find((s) => s.stepNumber === activeStep);
    if (!section) return null;
    return { start: section.startTime, end: section.endTime };
  }, [activeStep, sections]);

  const activeStepKeywords = useMemo(() => {
    if (activeStep === null || !recipeContent?.instructions) return null;
    const instruction = recipeContent.instructions.find((i) => i.step === activeStep);
    if (!instruction?.keywords) return null;
    // Extract ingredient names for text highlighting (handles both new object format and legacy string format)
    const ingredientNames = (instruction.keywords.ingredients || []).map((ing) =>
      typeof ing === 'object' && ing !== null ? ing.item : String(ing)
    );
    return {
      ingredients: ingredientNames,
      techniques: instruction.keywords.techniques || [],
      equipment: instruction.keywords.equipment || [],
    };
  }, [activeStep, recipeContent?.instructions]);

  const handleTimeUpdate = useCallback((time: number) => setCurrentTime(time), []);
  const handleDurationChange = useCallback((dur: number) => setDuration(dur), []);
  const handlePlayStateChange = useCallback((playing: boolean) => setIsPlaying(playing), []);

  const handleJumpToTimestamp = useCallback((timestamp: number) => {
    setSeekTo(timestamp);
    setTimeout(() => setSeekTo(undefined), 100);
  }, []);

  const handleStepClick = useCallback(
    (step: number, startTime: number) => {
      setActiveStep(step);
      handleJumpToTimestamp(startTime);
    },
    [handleJumpToTimestamp]
  );

  const handleToggleFilter = useCallback((type: KeywordType) => {
    setFilterTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }, []);

  const handleNotesChange = useCallback((step: number, notes: string) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const existing = next.get(step) || {};
      next.set(step, { ...existing, notes });
      return next;
    });
  }, []);

  const handleBoundaryChange = useCallback((step: number, start: number, end: number) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const existing = next.get(step) || {};
      next.set(step, { ...existing, timestamp_seconds: start, end_time_seconds: end });
      return next;
    });
  }, []);

  const handleTextChange = useCallback((step: number, text: string) => {
    setPendingChanges((prev) => {
      const next = new Map(prev);
      const existing = next.get(step) || {};
      next.set(step, { ...existing, text });
      return next;
    });
  }, []);

  const handleDeleteStep = useCallback((step: number) => {
    setDeletedSteps((prev) => new Set([...prev, step]));
  }, []);

  const handleSaveChanges = useCallback(async () => {
    if (!onSaveChanges || pendingChanges.size === 0) return;
    setIsSaving(true);
    try {
      const changes = Array.from(pendingChanges.entries()).map(([step, data]) => ({ step, ...data }));
      await onSaveChanges(changes);
      setPendingChanges(new Map());
      setEditingStep(null);
    } catch (error) {
      console.error('Failed to save changes:', error);
    } finally {
      setIsSaving(false);
    }
  }, [onSaveChanges, pendingChanges]);

  const handleDiscardChanges = useCallback(() => {
    setPendingChanges(new Map());
    setDeletedSteps(new Set());
    setEditingStep(null);
  }, []);

  const handleToggleCleanedTranscript = useCallback(() => {
    setShowCleanedTranscript((prev) => !prev);
  }, []);

  const handleGenerateCleanTranscript = useCallback(async () => {
    setIsGeneratingCleanTranscript(true);
    try {
      const response = await fetch(`/api/admin/recipes/${recipe.video_id}/clean-transcript`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.cleaned_transcript) {
          setCleanedTranscript(data.cleaned_transcript);
          setShowCleanedTranscript(true);
        }
      } else {
        console.error('Failed to generate cleaned transcript');
      }
    } catch (error) {
      console.error('Error generating cleaned transcript:', error);
    } finally {
      setIsGeneratingCleanTranscript(false);
    }
  }, [recipe.video_id]);

  useEffect(() => {
    if (!recipeContent?.instructions) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const steps = recipeContent.instructions.map((i) => i.step);
        const currentIndex = activeStep ? steps.indexOf(activeStep) : -1;
        let newIndex: number;
        if (e.key === 'ArrowUp') {
          newIndex = currentIndex <= 0 ? steps.length - 1 : currentIndex - 1;
        } else {
          newIndex = currentIndex >= steps.length - 1 ? 0 : currentIndex + 1;
        }
        const newStep = steps[newIndex];
        const instruction = recipeContent.instructions.find((i) => i.step === newStep);
        if (instruction) {
          handleStepClick(newStep, instruction.timestamp_seconds ?? 0);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStep, recipeContent?.instructions, handleStepClick]);

  const totalRefs = annotations.length;
  const ingredientRefs = annotations.filter((a) => a.type === 'ingredient').length;
  const techniqueRefs = annotations.filter((a) => a.type === 'technique').length;
  const equipmentRefs = annotations.filter((a) => a.type === 'equipment').length;

  const [showRawJson, setShowRawJson] = useState(false);

  const showVersionControls = versionInfo && availableVersions && onVersionChange && onRegenerate;

  // Show transcript-only view if AI determined no recipe exists
  if (recipe.has_recipe === false) {
    return (
      <div className="flex flex-col h-screen bg-zinc-900">
        <div className="bg-amber-900/50 border-b border-amber-700 px-4 py-3">
          <p className="text-amber-200 text-sm">
            No recipe found in this video - showing transcript only
          </p>
        </div>
        <div className="flex-1 flex min-h-0">
          {/* Video player */}
          <div className="w-1/2 flex flex-col bg-black">
            <div className="flex-1 flex items-center justify-center">
              <div className="w-full max-h-full aspect-video">
                <AdminVideoPlayer
                  videoUrl={videoUrl}
                  annotations={[]}
                  onTimeUpdate={handleTimeUpdate}
                  onDurationChange={handleDurationChange}
                  onPlayStateChange={handlePlayStateChange}
                  seekTo={seekTo}
                />
              </div>
            </div>
          </div>
          {/* Transcript viewer */}
          <div className="w-1/2 overflow-hidden">
            <TranscriptViewer
              segments={transcriptSegments}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onSeek={handleJumpToTimestamp}
              activeStepTimeRange={null}
              activeStepKeywords={null}
              editingStep={null}
              onSelectionComplete={() => {}}
              cleanedTranscript={cleanedTranscript}
              showCleanedTranscript={showCleanedTranscript}
              onToggleCleanedTranscript={handleToggleCleanedTranscript}
              onGenerateCleanTranscript={handleGenerateCleanTranscript}
              isGeneratingCleanTranscript={isGeneratingCleanTranscript}
            />
          </div>
        </div>
      </div>
    );
  }

  // Show generate UI if no recipe content (video hasn't been processed yet)
  if (!recipeContent || !recipeContent.instructions) {
    return (
      <div className="flex flex-col h-screen bg-zinc-900 items-center justify-center">
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-8 text-center max-w-md">
          <div className="mb-6">
            <svg
              className="w-16 h-16 mx-auto text-zinc-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-zinc-200 mb-2">No Recipe Generated</h2>
          <p className="text-zinc-400 mb-6">
            This video doesn&apos;t have a recipe yet. Generate one from the transcript.
          </p>
          {onRegenerate && (
            <button
              onClick={() => onRegenerate('')}
              disabled={isRegenerating}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {isRegenerating ? (
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Generating...
                </span>
              ) : (
                'Generate Recipe'
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-900">
      <div className="bg-zinc-800 border-b border-zinc-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-100 truncate">{recipeContent.title}</h1>
          <button
            onClick={() => setShowRawJson(!showRawJson)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              showRawJson
                ? 'bg-blue-500 text-white'
                : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
            }`}
          >
            {showRawJson ? 'Hide JSON' : 'Show JSON'}
          </button>
        </div>
        <div className="flex items-center gap-4 mt-1 text-xs text-zinc-500">
          <span>{recipeContent.instructions.length} steps</span>
          <span>•</span>
          <span>{totalRefs} keyword references</span>
          <span>•</span>
          <span className="text-green-400">{ingredientRefs} ingredients</span>
          <span className="text-blue-400">{techniqueRefs} techniques</span>
          <span className="text-orange-400">{equipmentRefs} equipment</span>
        </div>
      </div>

      {showVersionControls && (
        <VersionControlPanel
          versionInfo={versionInfo}
          availableVersions={availableVersions}
          onVersionChange={onVersionChange}
          onRegenerate={onRegenerate}
          isRegenerating={isRegenerating}
          onRegenerate2Stage={onRegenerate2Stage}
          isRegenerating2Stage={isRegenerating2Stage}
        />
      )}

      {showRawJson ? (
        <div className="flex-1 overflow-auto p-4 bg-zinc-950">
          <pre className="text-xs text-zinc-300 font-mono whitespace-pre-wrap break-words">
            {JSON.stringify(recipe, null, 2)}
          </pre>
        </div>
      ) : (
      <div ref={mainContainerRef} className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left panel: Timeline + Transcript */}
        <div
          className="flex-1 lg:flex-none flex flex-col min-w-0 min-h-0 border-b lg:border-b-0 lg:border-r border-zinc-700"
          style={isLargeScreen ? { width: `${leftPanelWidthPercent}%` } : undefined}
        >
          <Timeline
            currentTime={currentTime}
            duration={duration}
            annotations={annotations}
            sections={sections}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
            onJumpToTimestamp={handleJumpToTimestamp}
            filterTypes={filterTypes}
            editingStep={editingStep}
            onStepBoundaryChange={handleBoundaryChange}
          />
          <div className="flex-1 min-h-0 overflow-hidden">
            <TranscriptViewer
              segments={transcriptSegments}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onSeek={handleJumpToTimestamp}
              activeStepTimeRange={activeStepTimeRange}
              activeStepKeywords={activeStepKeywords}
              editingStep={editingStep}
              onSelectionComplete={(startTime, endTime) => {
                if (editingStep) {
                  handleBoundaryChange(editingStep, startTime, endTime);
                }
              }}
              cleanedTranscript={cleanedTranscript}
              showCleanedTranscript={showCleanedTranscript}
              onToggleCleanedTranscript={handleToggleCleanedTranscript}
              onGenerateCleanTranscript={handleGenerateCleanTranscript}
              isGeneratingCleanTranscript={isGeneratingCleanTranscript}
            />
          </div>
        </div>

        {/* Horizontal resize handle */}
        <div
          className={`hidden lg:block w-1.5 bg-zinc-700 hover:bg-zinc-600 cursor-col-resize flex-shrink-0 transition-colors ${
            isResizingHorizontal ? 'bg-zinc-500' : ''
          }`}
          onMouseDown={() => setIsResizingHorizontal(true)}
        />

        {/* Right panel: Video + Recipe Steps */}
        <div
          ref={containerRef}
          className="flex-1 lg:flex-none flex flex-col min-w-0 min-h-0"
          style={isLargeScreen ? { width: `${100 - leftPanelWidthPercent}%` } : undefined}
        >
          {/* Video player */}
          <div
            style={isLargeScreen ? { height: `${videoHeightPercent}%` } : undefined}
            className="flex flex-col flex-shrink-0 max-h-[30vh] lg:max-h-none items-center justify-center bg-black"
          >
            <div className="w-full max-h-full aspect-video">
              <AdminVideoPlayer
                videoUrl={videoUrl}
                annotations={annotations.filter((a) => filterTypes.includes(a.type))}
                onTimeUpdate={handleTimeUpdate}
                onDurationChange={handleDurationChange}
                onPlayStateChange={handlePlayStateChange}
                seekTo={seekTo}
              />
            </div>
          </div>

          {/* Vertical resize handle */}
          <div
            className={`hidden lg:block h-1.5 bg-zinc-700 hover:bg-zinc-600 cursor-row-resize flex-shrink-0 transition-colors ${
              isResizingVertical ? 'bg-zinc-500' : ''
            }`}
            onMouseDown={() => setIsResizingVertical(true)}
          />

          {/* Recipe Steps */}
          <div
            className="flex-1 min-h-0 overflow-hidden flex flex-col bg-zinc-800"
            style={isLargeScreen ? { height: `${100 - videoHeightPercent}%`, flex: 'none' } : undefined}
          >
            <div className="p-3 border-b border-zinc-700 bg-zinc-800 flex flex-col gap-2 flex-shrink-0">
              <div className="flex items-center justify-end">
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDiscardChanges}
                      disabled={isSaving}
                      className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleSaveChanges}
                      disabled={isSaving}
                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>
              {recipe.recipes.length > 1 && (
                <select
                  value={selectedRecipeIndex}
                  onChange={(e) => setSelectedRecipeIndex(Number(e.target.value))}
                  className="w-full px-2 py-1.5 text-sm bg-zinc-900 border border-zinc-600 rounded text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {recipe.recipes.map((r, index) => (
                    <option key={index} value={index}>
                      Recipe {index + 1}: {r.title.length > 30 ? r.title.slice(0, 30) + '...' : r.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <StepList
              instructions={recipeContent.instructions}
              activeStep={activeStep}
              currentTime={currentTime}
              onStepClick={handleStepClick}
              filterTypes={filterTypes}
              onToggleFilter={handleToggleFilter}
              cleanedTranscript={cleanedTranscript}
              editingStep={editingStep}
              onEditStep={setEditingStep}
              onNotesChange={handleNotesChange}
              onTextChange={handleTextChange}
              onDeleteStep={handleDeleteStep}
              onBoundaryChange={handleBoundaryChange}
              pendingNotes={pendingNotes}
              pendingText={pendingText}
              deletedSteps={deletedSteps}
              pendingBoundaries={pendingBoundaries}
            />
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
