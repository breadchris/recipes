'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import ReactPlayer from 'react-player';
import { formatTime } from '@/lib/admin/utils';
import type { TimelineAnnotation } from '@/lib/types/admin';

const KEYWORD_COLORS = {
  ingredient: '#22c55e',
  technique: '#3b82f6',
  equipment: '#f97316',
};

interface AdminVideoPlayerProps {
  videoUrl: string;
  annotations?: TimelineAnnotation[];
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onPlayStateChange: (playing: boolean) => void;
  seekTo?: number;
}

export function AdminVideoPlayer({
  videoUrl,
  annotations = [],
  onTimeUpdate,
  onDurationChange,
  onPlayStateChange,
  seekTo,
}: AdminVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playerRef = useRef<any>(null);
  const lastSeekTo = useRef<number | null>(null);
  const controlsTimeoutRef = useRef<number | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  const isValidYouTubeUrl =
    videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be');

  useEffect(() => {
    if (
      seekTo !== undefined &&
      seekTo !== null &&
      seekTo !== lastSeekTo.current &&
      playerRef.current &&
      isReady
    ) {
      playerRef.current.currentTime = seekTo;
      lastSeekTo.current = seekTo;
      setCurrentTime(seekTo);
      onTimeUpdate(seekTo);
    }
  }, [seekTo, isReady, onTimeUpdate]);

  const handleDurationChange = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const dur = e.currentTarget.duration;
      if (dur && !isNaN(dur) && dur > 0) {
        setDuration(dur);
        onDurationChange(dur);
        setIsReady(true);
        setIsLoading(false);
        setError(null);
      }
    },
    [onDurationChange]
  );

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    onPlayStateChange(true);
  }, [onPlayStateChange]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    onPlayStateChange(false);
  }, [onPlayStateChange]);

  const handleError = useCallback(() => {
    setError('Failed to load video. Please check the YouTube URL.');
    setIsLoading(false);
  }, []);

  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const time = e.currentTarget.currentTime;
      if (typeof time === 'number' && !isNaN(time)) {
        setCurrentTime(time);
        onTimeUpdate(time);
      }
    },
    [onTimeUpdate]
  );

  const handleProgress = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = e.currentTarget;
      if (video.buffered.length > 0) {
        setBufferedTime(video.buffered.end(video.buffered.length - 1));
      }
    },
    []
  );

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleMuteToggle = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  const handleRestart = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.currentTime = 0;
      setCurrentTime(0);
      onTimeUpdate(0);
    }
  }, [onTimeUpdate]);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  }, []);

  const handleShowControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    } else {
      handleShowControls();
    }
  }, [isPlaying, handleShowControls]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  if (!isValidYouTubeUrl) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800">
        <div className="aspect-video bg-zinc-800 flex items-center justify-center">
          <div className="text-center p-8">
            <h3 className="text-lg font-medium text-zinc-100 mb-2">Invalid Video URL</h3>
            <p className="text-sm text-zinc-400">Please select a valid recipe.</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900 rounded-lg border border-zinc-800">
        <div className="aspect-video bg-red-950/50 flex items-center justify-center">
          <div className="text-center p-8">
            <h3 className="text-lg font-medium text-red-400 mb-2">Video Error</h3>
            <p className="text-sm text-red-300">{error}</p>
            <button
              onClick={() => {
                setError(null);
                setIsLoading(true);
                setIsReady(false);
              }}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={videoContainerRef}
      className="relative w-full h-full cursor-pointer"
      onMouseMove={handleShowControls}
      onTouchStart={handleShowControls}
    >
      <div className="aspect-video bg-black relative w-full">
        <ReactPlayer
          ref={playerRef}
          src={videoUrl}
          width="100%"
          height="100%"
          playing={isPlaying}
          volume={volume}
          muted={isMuted}
          playbackRate={playbackRate}
          controls={false}
          onDurationChange={handleDurationChange}
          onPlay={handlePlay}
          onPause={handlePause}
          onTimeUpdate={handleTimeUpdate}
          onProgress={handleProgress}
          onError={handleError}
          style={{ backgroundColor: '#000000' }}
        />

        {!isLoading && !error && isReady && (
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 z-10 transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center gap-4">
              <button
                onClick={handlePlayPause}
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

              <button
                onClick={handleRestart}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>

              <div className="flex-1 text-white text-sm">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                  className="text-white hover:bg-white/20 px-3 py-2 rounded-lg transition-colors text-sm font-medium"
                >
                  {playbackRate}x
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full mb-2 right-0 bg-black/90 rounded-lg shadow-lg overflow-hidden backdrop-blur-sm">
                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handlePlaybackRateChange(rate)}
                        className={`block w-full px-4 py-2 text-left text-white hover:bg-white/20 transition-colors text-sm ${
                          playbackRate === rate ? 'bg-white/10' : ''
                        }`}
                      >
                        {rate}x {playbackRate === rate && '✓'}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleMuteToggle}
                className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
              >
                {isMuted ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                )}
              </button>
            </div>

            {duration > 0 && (
              <div className="mt-3">
                <div
                  className="w-full bg-white/30 rounded-full h-2 hover:h-3 relative cursor-pointer transition-all group"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const percentage = x / rect.width;
                    const seekTime = percentage * duration;
                    if (playerRef.current) {
                      playerRef.current.currentTime = seekTime;
                      setCurrentTime(seekTime);
                      onTimeUpdate(seekTime);
                    }
                  }}
                >
                  <div
                    className="absolute top-0 left-0 h-full bg-white/50 rounded-full transition-all pointer-events-none z-0"
                    style={{ width: `${(bufferedTime / duration) * 100}%` }}
                  />
                  <div
                    className="absolute top-0 left-0 h-full bg-red-600 rounded-full transition-all pointer-events-none z-10"
                    style={{ width: `${(currentTime / duration) * 100}%` }}
                  />
                  {annotations.map((annotation, index) => {
                    const pos = duration > 0 ? (annotation.timestamp / duration) * 100 : 0;
                    return (
                      <div
                        key={annotation.id || index}
                        className="absolute top-0 h-full w-1 rounded-full pointer-events-none opacity-70 group-hover:opacity-90 z-5"
                        style={{
                          left: `${pos}%`,
                          backgroundColor: KEYWORD_COLORS[annotation.type],
                        }}
                        title={annotation.keyword}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
