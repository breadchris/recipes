'use client';

import { useEffect, useRef } from 'react';
import { Play, Pause, X, RotateCcw } from 'lucide-react';
import { useTimerStore, Timer } from '@/lib/stores/timerStore';
import { formatTime } from '@/lib/parseTimeString';

// Simple chime sound using Web Audio API
function playChime() {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880; // A5 note
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    // Play a second note for a pleasant chime
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.frequency.value = 1320; // E6 note
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.2, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.4);
    }, 150);
  } catch {
    // Audio not supported, fail silently
  }
}

function TimerCard({ timer }: { timer: Timer }) {
  const { pauseTimer, resumeTimer, dismissTimer, tick } = useTimerStore();
  const hasPlayedChime = useRef(false);

  useEffect(() => {
    if (!timer.isRunning) return;

    const interval = setInterval(() => {
      tick(timer.id);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer.id, timer.isRunning, tick]);

  // Play chime when timer completes
  useEffect(() => {
    if (timer.isComplete && !hasPlayedChime.current) {
      hasPlayedChime.current = true;
      playChime();
    }
  }, [timer.isComplete]);

  const progress = timer.totalSeconds > 0
    ? ((timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds) * 100
    : 0;

  return (
    <div
      className={`bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 p-3 min-w-[180px] transition-all ${
        timer.isComplete ? 'animate-pulse ring-2 ring-green-500' : ''
      }`}
    >
      {/* Header with step info and dismiss */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          Step {timer.stepNumber}
        </span>
        <button
          onClick={() => dismissTimer(timer.id)}
          className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded transition-colors"
          aria-label="Dismiss timer"
        >
          <X className="w-3 h-3 text-zinc-400" />
        </button>
      </div>

      {/* Time display */}
      <div className="text-center mb-2">
        <div className={`text-2xl font-mono font-bold ${
          timer.isComplete
            ? 'text-green-600 dark:text-green-400'
            : 'text-zinc-900 dark:text-zinc-100'
        }`}>
          {timer.isComplete ? 'Done!' : formatTime(timer.remainingSeconds)}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {timer.label}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full transition-all duration-1000 ${
            timer.isComplete ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        {!timer.isComplete && (
          <button
            onClick={() => timer.isRunning ? pauseTimer(timer.id) : resumeTimer(timer.id)}
            className="p-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-full transition-colors"
            aria-label={timer.isRunning ? 'Pause timer' : 'Resume timer'}
          >
            {timer.isRunning ? (
              <Pause className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            ) : (
              <Play className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            )}
          </button>
        )}
        <button
          onClick={() => {
            hasPlayedChime.current = false;
            const { startTimer } = useTimerStore.getState();
            startTimer(timer.stepNumber, timer.recipeIndex, timer.label, timer.totalSeconds);
          }}
          className="p-2 bg-zinc-100 dark:bg-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-600 rounded-full transition-colors"
          aria-label="Reset timer"
        >
          <RotateCcw className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
        </button>
      </div>
    </div>
  );
}

export default function RecipeTimer() {
  const timers = useTimerStore((state) => state.timers);

  if (timers.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 md:right-6 left-4 md:left-auto z-50 flex flex-col items-center md:items-end gap-2">
      {timers.map((timer) => (
        <TimerCard key={timer.id} timer={timer} />
      ))}
    </div>
  );
}
