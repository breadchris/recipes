'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { BatchVideoSample, ChannelInfo } from '@/lib/types/admin';

type VideoStatus = 'pending' | 'stage1' | 'stage2' | 'completed' | 'error';

interface ProcessingVideo extends BatchVideoSample {
  status: VideoStatus;
  errorMessage?: string;
  newVersion?: number;
}

type BatchStatus = 'idle' | 'processing' | 'paused' | 'completed';

export default function BatchProcessingPage() {
  const [sampleSize, setSampleSize] = useState(10);
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [videos, setVideos] = useState<ProcessingVideo[]>([]);
  const [batchStatus, setBatchStatus] = useState<BatchStatus>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoadingChannels, setIsLoadingChannels] = useState(false);
  const [isSampling, setIsSampling] = useState(false);

  const abortRef = useRef(false);

  // Load channels on mount
  useEffect(() => {
    const loadChannels = async () => {
      setIsLoadingChannels(true);
      try {
        const response = await fetch('/api/admin/channels');
        if (response.ok) {
          const data = await response.json();
          setChannels(data.channels || []);
        }
      } catch (error) {
        console.error('Failed to load channels:', error);
      } finally {
        setIsLoadingChannels(false);
      }
    };
    loadChannels();
  }, []);

  // Sample videos
  const handleSample = useCallback(async () => {
    setIsSampling(true);
    try {
      const channelsParam = selectedChannels.length > 0
        ? `&channels=${selectedChannels.join(',')}`
        : '';
      const response = await fetch(
        `/api/admin/batch/sample?count=${sampleSize}${channelsParam}`
      );

      if (!response.ok) {
        throw new Error('Failed to sample videos');
      }

      const data = await response.json();
      const processingVideos: ProcessingVideo[] = data.videos.map(
        (v: BatchVideoSample) => ({
          ...v,
          status: 'pending' as VideoStatus,
        })
      );

      setVideos(processingVideos);
      setCurrentIndex(0);
      setBatchStatus('idle');
    } catch (error) {
      console.error('Failed to sample:', error);
      alert(error instanceof Error ? error.message : 'Failed to sample videos');
    } finally {
      setIsSampling(false);
    }
  }, [sampleSize, selectedChannels]);

  // Process a single video
  const processVideo = useCallback(async (videoId: string): Promise<{ success: boolean; version?: number; error?: string }> => {
    // Update status to stage1
    setVideos(prev => prev.map(v =>
      v.video_id === videoId ? { ...v, status: 'stage1' as VideoStatus } : v
    ));

    try {
      const response = await fetch(`/api/admin/recipes/${videoId}/regenerate-2stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Failed to process' };
      }

      const data = await response.json();
      return { success: true, version: data.version };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, []);

  // Start/resume processing
  const handleStartProcessing = useCallback(async () => {
    if (videos.length === 0) return;

    abortRef.current = false;
    setBatchStatus('processing');

    for (let i = currentIndex; i < videos.length; i++) {
      if (abortRef.current) {
        setBatchStatus('paused');
        return;
      }

      const video = videos[i];
      if (video.status === 'completed' || video.status === 'error') {
        setCurrentIndex(i + 1);
        continue;
      }

      // Update to stage1
      setVideos(prev => prev.map((v, idx) =>
        idx === i ? { ...v, status: 'stage1' as VideoStatus } : v
      ));

      // Small delay to show stage1 status
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update to stage2
      setVideos(prev => prev.map((v, idx) =>
        idx === i ? { ...v, status: 'stage2' as VideoStatus } : v
      ));

      const result = await processVideo(video.video_id);

      setVideos(prev => prev.map((v, idx) =>
        idx === i
          ? {
              ...v,
              status: result.success ? 'completed' : 'error',
              newVersion: result.version,
              errorMessage: result.error,
            }
          : v
      ));

      setCurrentIndex(i + 1);
    }

    setBatchStatus('completed');
  }, [videos, currentIndex, processVideo]);

  // Stop processing
  const handleStop = useCallback(() => {
    abortRef.current = true;
  }, []);

  // Rerun same sample
  const handleRerun = useCallback(() => {
    setVideos(prev => prev.map(v => ({
      ...v,
      status: 'pending' as VideoStatus,
      errorMessage: undefined,
      newVersion: undefined,
    })));
    setCurrentIndex(0);
    setBatchStatus('idle');
  }, []);

  // Clear sample
  const handleClear = useCallback(() => {
    setVideos([]);
    setCurrentIndex(0);
    setBatchStatus('idle');
  }, []);

  // Toggle channel selection
  const toggleChannel = useCallback((channelId: string) => {
    setSelectedChannels(prev =>
      prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  }, []);

  const completedCount = videos.filter(v => v.status === 'completed').length;
  const errorCount = videos.filter(v => v.status === 'error').length;

  const getStatusIcon = (status: VideoStatus) => {
    switch (status) {
      case 'pending': return <span className="text-zinc-500">-</span>;
      case 'stage1': return <span className="text-blue-400 animate-pulse">1</span>;
      case 'stage2': return <span className="text-violet-400 animate-pulse">2</span>;
      case 'completed': return <span className="text-green-400">+</span>;
      case 'error': return <span className="text-red-400">x</span>;
    }
  };

  const getStatusText = (video: ProcessingVideo) => {
    switch (video.status) {
      case 'pending': return 'Pending';
      case 'stage1': return 'Cleaning transcript...';
      case 'stage2': return 'Generating recipe...';
      case 'completed': return `Completed (v${video.newVersion})`;
      case 'error': return video.errorMessage || 'Error';
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-100">Batch 2-Stage Recipe Generation</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Process multiple videos with the 2-stage flow: clean transcript, then generate recipe with section references.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Sample Size</label>
            <input
              type="number"
              min={1}
              max={100}
              value={sampleSize}
              onChange={(e) => setSampleSize(parseInt(e.target.value) || 10)}
              disabled={batchStatus === 'processing'}
              className="w-24 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
            />
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-zinc-500">
                Channels {selectedChannels.length > 0 ? `(${selectedChannels.length} selected)` : '(all)'}
              </label>
              {selectedChannels.length > 0 && (
                <button
                  onClick={() => setSelectedChannels([])}
                  disabled={batchStatus === 'processing'}
                  className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-50"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 p-2 bg-zinc-800/50 border border-zinc-700 rounded max-h-24 overflow-y-auto">
              {isLoadingChannels ? (
                <span className="text-xs text-zinc-500">Loading channels...</span>
              ) : channels.length === 0 ? (
                <span className="text-xs text-zinc-500">No channels found</span>
              ) : (
                channels.map(channel => {
                  const isSelected = selectedChannels.includes(channel.channel_id);
                  return (
                    <button
                      key={channel.channel_id}
                      onClick={() => toggleChannel(channel.channel_id)}
                      disabled={batchStatus === 'processing'}
                      className={`px-2 py-0.5 text-xs rounded-full border transition-colors disabled:opacity-50 ${
                        isSelected
                          ? 'bg-violet-600 border-violet-500 text-white'
                          : 'bg-zinc-800 border-zinc-600 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300'
                      }`}
                    >
                      {channel.channel_name}
                      <span className={isSelected ? 'text-violet-200 ml-1' : 'text-zinc-500 ml-1'}>
                        {channel.video_count}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSample}
              disabled={batchStatus === 'processing' || isSampling}
              className="px-3 py-1.5 bg-zinc-700 text-zinc-200 rounded text-sm hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSampling ? 'Sampling...' : 'Sample Videos'}
            </button>

            {videos.length > 0 && (
              <>
                <button
                  onClick={handleRerun}
                  disabled={batchStatus === 'processing'}
                  className="px-3 py-1.5 bg-zinc-700 text-zinc-200 rounded text-sm hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Rerun Sample
                </button>
                <button
                  onClick={handleClear}
                  disabled={batchStatus === 'processing'}
                  className="px-3 py-1.5 bg-zinc-800 text-zinc-400 rounded text-sm hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Progress */}
      {videos.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-zinc-300">
              {batchStatus === 'processing' ? (
                <span>Processing {currentIndex + 1}/{videos.length}...</span>
              ) : batchStatus === 'completed' ? (
                <span className="text-green-400">Completed: {completedCount}/{videos.length}</span>
              ) : batchStatus === 'paused' ? (
                <span className="text-amber-400">Paused at {currentIndex}/{videos.length}</span>
              ) : (
                <span>{videos.length} videos sampled</span>
              )}
              {errorCount > 0 && (
                <span className="ml-2 text-red-400">({errorCount} errors)</span>
              )}
            </div>

            <div className="flex gap-2">
              {batchStatus === 'processing' ? (
                <button
                  onClick={handleStop}
                  className="px-3 py-1 bg-red-600/20 text-red-400 rounded text-sm hover:bg-red-600/30"
                >
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleStartProcessing}
                  disabled={videos.length === 0 || batchStatus === 'completed'}
                  className="px-3 py-1 bg-violet-600 text-white rounded text-sm hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {batchStatus === 'paused' ? 'Resume' : 'Start Processing'}
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-zinc-800 rounded overflow-hidden">
            <div
              className="h-full bg-violet-600 transition-all duration-300"
              style={{ width: `${(completedCount / videos.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Video list */}
      {videos.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto">
            {videos.map((video, index) => (
              <div
                key={video.video_id}
                className={`flex items-center gap-3 px-4 py-2 border-b border-zinc-800 last:border-b-0 ${
                  index === currentIndex && batchStatus === 'processing' ? 'bg-zinc-800/50' : ''
                }`}
              >
                <div className="w-6 text-center font-mono text-sm">
                  {getStatusIcon(video.status)}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/admin/recipe/${video.video_id}`}
                    className="text-sm text-zinc-200 hover:text-violet-400 truncate block"
                  >
                    {video.title}
                  </Link>
                  <div className="text-xs text-zinc-500">
                    {video.channel_name && <span>{video.channel_name} - </span>}
                    <span className="font-mono">{video.video_id}</span>
                  </div>
                </div>
                <div className={`text-xs ${
                  video.status === 'completed' ? 'text-green-400' :
                  video.status === 'error' ? 'text-red-400' :
                  video.status === 'stage1' || video.status === 'stage2' ? 'text-violet-400' :
                  'text-zinc-500'
                }`}>
                  {getStatusText(video)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {videos.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center">
          <p className="text-zinc-500">
            Click "Sample Videos" to get a random sample of videos with transcripts.
          </p>
        </div>
      )}
    </div>
  );
}
