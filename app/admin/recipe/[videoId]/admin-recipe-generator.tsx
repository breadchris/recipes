'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AdminVideoPlayer } from '@/components/admin/AdminVideoPlayer';
import { TranscriptViewer } from '@/components/admin/TranscriptViewer';
import type { TranscriptSegment } from '@/lib/types/admin';

interface AdminRecipeGeneratorProps {
  videoId: string;
  videoTitle: string;
}

export function AdminRecipeGenerator({ videoId, videoTitle }: AdminRecipeGeneratorProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Transcript state
  const [transcriptSegments, setTranscriptSegments] = useState<TranscriptSegment[]>([]);
  const [isLoadingTranscript, setIsLoadingTranscript] = useState(true);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);
  const [isFetchingTranscript, setIsFetchingTranscript] = useState(false);

  // Video player state
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [seekTo, setSeekTo] = useState<number | undefined>(undefined);

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Fetch transcript on mount
  useEffect(() => {
    async function fetchTranscript() {
      try {
        const response = await fetch(`/api/admin/recipes/${videoId}/transcript`);
        if (response.ok) {
          const data = await response.json();
          setTranscriptSegments(data.segments || []);
          setTranscriptError(null);
        } else if (response.status === 404) {
          setTranscriptError('no_transcript');
        } else {
          setTranscriptError('Failed to load transcript');
        }
      } catch (err) {
        setTranscriptError(err instanceof Error ? err.message : 'Failed to load transcript');
      } finally {
        setIsLoadingTranscript(false);
      }
    }

    fetchTranscript();
  }, [videoId]);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleDurationChange = useCallback(() => {
    // Duration received - player is ready
  }, []);

  const handlePlayStateChange = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  const handleSeek = useCallback((time: number) => {
    setSeekTo(time);
    // Reset seekTo after a short delay to allow re-seeking to same time
    setTimeout(() => setSeekTo(undefined), 100);
  }, []);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/recipes/${videoId}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate recipe');
      }

      // Reload the page to show the editor
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate recipe');
      setIsGenerating(false);
    }
  }

  async function handleFetchTranscript() {
    setIsFetchingTranscript(true);
    setTranscriptError(null);

    try {
      const response = await fetch(`/api/admin/recipes/${videoId}/fetch-transcript`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch transcript');
      }

      // Re-fetch transcript after successful extraction
      const transcriptResponse = await fetch(`/api/admin/recipes/${videoId}/transcript`);
      if (transcriptResponse.ok) {
        const data = await transcriptResponse.json();
        setTranscriptSegments(data.segments || []);
        setTranscriptError(null);
      }
    } catch (err) {
      setTranscriptError(err instanceof Error ? err.message : 'Failed to fetch transcript');
    } finally {
      setIsFetchingTranscript(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-zinc-900">
      {/* Header banner */}
      <div className="bg-blue-900/50 border-b border-blue-700 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-blue-100">{videoTitle}</h1>
          <p className="text-sm text-blue-300">
            No recipe generated yet - review the transcript below
          </p>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-red-300 text-sm">{error}</span>
          )}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || transcriptError === 'no_transcript'}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
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
              </>
            ) : (
              'Generate Recipe'
            )}
          </button>
        </div>
      </div>

      {/* Main content - 50/50 split */}
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
          {isLoadingTranscript ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <svg className="w-8 h-8 animate-spin mx-auto text-zinc-500" viewBox="0 0 24 24">
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
                <p className="text-zinc-500 mt-2">Loading transcript...</p>
              </div>
            </div>
          ) : transcriptError === 'no_transcript' ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <svg
                  className="w-16 h-16 mx-auto text-zinc-600 mb-4"
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
                <h2 className="text-xl font-medium text-zinc-200 mb-2">No Transcript Available</h2>
                <p className="text-zinc-400 mb-6">
                  This video doesn&apos;t have a transcript yet. Fetch it from YouTube to continue.
                </p>
                <button
                  onClick={handleFetchTranscript}
                  disabled={isFetchingTranscript}
                  className="px-6 py-3 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                >
                  {isFetchingTranscript ? (
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
                      Fetching Transcript...
                    </span>
                  ) : (
                    'Fetch Transcript'
                  )}
                </button>
              </div>
            </div>
          ) : transcriptError ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-red-400">
                <p>Error: {transcriptError}</p>
              </div>
            </div>
          ) : (
            <TranscriptViewer
              segments={transcriptSegments}
              currentTime={currentTime}
              isPlaying={isPlaying}
              onSeek={handleSeek}
              activeStepTimeRange={null}
              activeStepKeywords={null}
              editingStep={null}
              onSelectionComplete={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  );
}
