'use client';

import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react';

export interface VideoPlayerHandle {
  seekTo: (seconds: number) => void;
}

interface VideoPlayerProps {
  videoId: string;
  onEnded?: () => void;
  playing?: boolean;
}

export const VideoPlayer = forwardRef<VideoPlayerHandle, VideoPlayerProps>(
  function VideoPlayer({ videoId, onEnded, playing = false }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isActivated, setIsActivated] = useState(playing);
    const [liteYouTubeLoaded, setLiteYouTubeLoaded] = useState(false);

    // Dynamically import lite-youtube web component on client only
    useEffect(() => {
      import('@justinribeiro/lite-youtube').then(() => {
        setLiteYouTubeLoaded(true);
      });
    }, []);

    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        const iframe = containerRef.current?.querySelector('iframe');
        if (iframe?.contentWindow) {
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }),
            '*'
          );
        }
      },
    }));

    // Auto-activate if playing prop is true
    useEffect(() => {
      if (playing && !isActivated) {
        setIsActivated(true);
      }
    }, [playing, isActivated]);

    // Listen for video end events from YouTube iframe
    useEffect(() => {
      if (!isActivated || !onEnded) return;

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== 'https://www.youtube.com') return;
        try {
          const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          if (data.event === 'onStateChange' && data.info === 0) {
            onEnded();
          }
        } catch {
          // Ignore non-JSON messages
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    }, [isActivated, onEnded]);

    return (
      <div ref={containerRef} className="relative aspect-video bg-black rounded-lg overflow-hidden">
        {isActivated ? (
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`}
            className="absolute inset-0 w-full h-full"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        ) : liteYouTubeLoaded ? (
          // @ts-expect-error - lite-youtube is a web component
          <lite-youtube
            videoid={videoId}
            playlabel="Play video"
            style={{ width: '100%', height: '100%' }}
            onClick={() => setIsActivated(true)}
          />
        ) : (
          // Fallback thumbnail while lite-youtube loads
          <div
            className="w-full h-full bg-cover bg-center cursor-pointer flex items-center justify-center"
            style={{ backgroundImage: `url(https://i.ytimg.com/vi/${videoId}/hqdefault.jpg)` }}
            onClick={() => setIsActivated(true)}
          >
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        )}
      </div>
    );
  }
);
