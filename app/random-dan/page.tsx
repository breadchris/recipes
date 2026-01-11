'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import ReactPlayer from 'react-player';
import { formatTime } from '@/lib/formatTime';
import type { CleanedTranscriptSection } from '@/lib/types/admin';

interface RandomSectionResponse {
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  section: CleanedTranscriptSection;
  totalSections: number;
  sectionIndex: number;
}

export default function RandomDanPage() {
  const [currentSection, setCurrentSection] = useState<RandomSectionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  const [isFullVideoMode, setIsFullVideoMode] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [watchHistory, setWatchHistory] = useState<RandomSectionResponse[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const hasSeenkedRef = useRef(false);
  const previousSectionRef = useRef<RandomSectionResponse | null>(null);

  // Fetch a random section
  const fetchRandomSection = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsReady(false);
    setHasAutoPlayed(false);
    setIsFullVideoMode(false);
    hasSeenkedRef.current = false;

    try {
      const response = await fetch('/api/random-dan');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch random section');
      }

      const data: RandomSectionResponse = await response.json();
      setCurrentSection(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch initial section on mount
  useEffect(() => {
    fetchRandomSection();
  }, [fetchRandomSection]);

  // Add previous section to history when current section changes
  useEffect(() => {
    if (previousSectionRef.current && currentSection) {
      setWatchHistory((history) => [
        previousSectionRef.current!,
        ...history.slice(0, 9), // Keep max 10 items
      ]);
    }
    previousSectionRef.current = currentSection;
  }, [currentSection]);

  // Load a section from history
  const loadFromHistory = useCallback((item: RandomSectionResponse) => {
    setIsReady(false);
    setHasAutoPlayed(false);
    setIsFullVideoMode(false);
    hasSeenkedRef.current = false;
    setCurrentSection(item);
  }, []);

  // Seek to start time when player is ready (only in section mode)
  useEffect(() => {
    if (isReady && currentSection && playerRef.current && !hasSeenkedRef.current && !isFullVideoMode) {
      playerRef.current.currentTime = currentSection.section.startTime;
      hasSeenkedRef.current = true;
      // Start playing after seek
      setIsPlaying(true);
      setHasAutoPlayed(true);
    }
  }, [isReady, currentSection, isFullVideoMode]);

  // Handle time update - check if we've reached the end of the section
  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const time = e.currentTarget.currentTime;
      if (typeof time === 'number' && !isNaN(time)) {
        setCurrentTime(time);

        // Check if we've reached the end of the section (only in section mode)
        if (!isFullVideoMode && currentSection && time >= currentSection.section.endTime) {
          // Fetch next random section
          fetchRandomSection();
        }
      }
    },
    [currentSection, fetchRandomSection, isFullVideoMode]
  );

  const handleDurationChange = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const dur = e.currentTarget.duration;
      if (dur && !isNaN(dur) && dur > 0) {
        setVideoDuration(dur);
        setIsReady(true);
      }
    },
    []
  );

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleError = useCallback(() => {
    setError('Failed to load video');
  }, []);

  // Calculate progress within section
  const sectionDuration = currentSection
    ? currentSection.section.endTime - currentSection.section.startTime
    : 0;
  const sectionProgress = currentSection
    ? Math.max(0, Math.min(1, (currentTime - currentSection.section.startTime) / sectionDuration))
    : 0;
  const timeRemaining = currentSection
    ? Math.max(0, currentSection.section.endTime - currentTime)
    : 0;

  if (isLoading && !currentSection) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-zinc-400">Loading random section...</div>
        </div>
      </div>
    );
  }

  if (error && !currentSection) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-red-950/50 border border-red-800 rounded-lg p-6 text-center">
          <h3 className="text-lg font-medium text-red-400 mb-2">Error</h3>
          <p className="text-red-300 mb-4">{error}</p>
          <button
            onClick={fetchRandomSection}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Random Dan</h1>
        {currentSection && (
          <Link
            href={`/recipe/${currentSection.videoId}`}
            className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors flex items-center gap-2 text-sm"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View Recipe
          </Link>
        )}
      </div>

      {currentSection && (
        <>
          {/* Video Player */}
          <div className="bg-zinc-900 rounded-lg overflow-hidden mb-4">
            <div className="aspect-video bg-black relative">
              <ReactPlayer
                ref={playerRef}
                src={currentSection.videoUrl}
                width="100%"
                height="100%"
                playing={isPlaying}
                controls={false}
                onDurationChange={handleDurationChange}
                onPlay={handlePlay}
                onPause={handlePause}
                onTimeUpdate={handleTimeUpdate}
                onError={handleError}
                style={{ backgroundColor: '#000000' }}
              />

              {/* Custom controls overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="flex items-center gap-4 mb-3">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                  >
                    {isPlaying ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 text-white text-sm">
                    {isFullVideoMode ? (
                      <>Video: {formatTime(currentTime)} / {formatTime(videoDuration)}</>
                    ) : (
                      <>
                        Section: {formatTime(Math.max(0, currentTime - currentSection.section.startTime))} / {formatTime(sectionDuration)}
                        <span className="text-zinc-400 ml-2">({formatTime(timeRemaining)} remaining)</span>
                      </>
                    )}
                  </div>

                  <button
                    onClick={() => setIsFullVideoMode(!isFullVideoMode)}
                    className="text-white hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors text-xs font-medium"
                    title={isFullVideoMode ? 'Back to section mode' : 'Watch full video'}
                  >
                    {isFullVideoMode ? 'Back to Sections' : 'Watch Full Video'}
                  </button>

                  <button
                    onClick={fetchRandomSection}
                    className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                    title="Next Random Section"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-white/30 rounded-full h-2">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all"
                    style={{
                      width: `${isFullVideoMode
                        ? (videoDuration > 0 ? (currentTime / videoDuration) * 100 : 0)
                        : sectionProgress * 100
                      }%`
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Video Title */}
          <div className="text-zinc-400 text-sm mb-4">
            {currentSection.videoTitle}
          </div>

          {/* Section Info */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-100">
                {currentSection.section.heading || `Section ${currentSection.sectionIndex + 1}`}
              </h2>
              <span className="text-sm text-zinc-500">
                {formatTime(currentSection.section.startTime)} - {formatTime(currentSection.section.endTime)}
              </span>
            </div>
            <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {currentSection.section.text}
            </p>
            <div className="mt-4 text-xs text-zinc-500">
              Section {currentSection.sectionIndex + 1} of {currentSection.totalSections}
            </div>
          </div>

          {/* Watch History */}
          {watchHistory.length > 0 && (
            <div className="mt-6 text-xs text-zinc-600">
              <div className="mb-1">Recently watched:</div>
              {watchHistory.map((item, index) => (
                <button
                  key={`${item.videoId}-${item.section.id}-${index}`}
                  onClick={() => loadFromHistory(item)}
                  className="block w-full text-left text-zinc-500 truncate hover:text-zinc-300 transition-colors"
                >
                  {item.section.heading || `Section ${item.sectionIndex + 1}`} — {item.videoTitle.replace(/\s*\|\s*What's Eating Dan\??.*$/i, '')}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
