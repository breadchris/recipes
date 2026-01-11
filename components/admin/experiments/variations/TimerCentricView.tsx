'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Recipe } from '@/lib/types';
import { ActiveTimer } from '@/lib/types/component-lab';
import { useComponentLabStore } from '@/lib/stores/componentLabStore';

interface TimerCentricViewProps {
  recipe: Recipe;
  activeStep: number;
  completedSteps: number[];
  checkedIngredients: number[];
  onStepChange: (step: number) => void;
  onStepComplete: (step: number) => void;
}

function parseTimeToSeconds(timeString: string): number {
  const hourMatch = timeString.match(/(\d+)\s*(?:hours?|hrs?)/i);
  const minMatch = timeString.match(/(\d+)\s*(?:minutes?|mins?)/i);
  const secMatch = timeString.match(/(\d+)\s*(?:seconds?|secs?)/i);

  let seconds = 0;
  if (hourMatch) seconds += parseInt(hourMatch[1]) * 3600;
  if (minMatch) seconds += parseInt(minMatch[1]) * 60;
  if (secMatch) seconds += parseInt(secMatch[1]);

  // If only a number, assume minutes
  if (!hourMatch && !minMatch && !secMatch) {
    const numMatch = timeString.match(/(\d+)/);
    if (numMatch) seconds = parseInt(numMatch[1]) * 60;
  }

  return seconds;
}

function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function TimerCentricView({
  recipe,
  activeStep,
  completedSteps,
  onStepChange,
  onStepComplete,
}: TimerCentricViewProps) {
  const { simulatedTimers, addTimer, updateTimer, removeTimer } = useComponentLabStore();
  const [now, setNow] = useState(Date.now());

  // Update timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());

      // Update running timers
      simulatedTimers.forEach((timer) => {
        if (timer.isRunning && timer.startedAt) {
          const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
          const remaining = Math.max(0, timer.totalSeconds - elapsed);
          if (remaining !== timer.remainingSeconds) {
            updateTimer(timer.id, { remainingSeconds: remaining });
          }
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [simulatedTimers, updateTimer]);

  // Extract all timed steps
  const timedSteps = useMemo(() => {
    return recipe.instructions
      .filter((inst) => inst.measurements?.times && inst.measurements.times.length > 0)
      .map((inst) => ({
        stepNumber: inst.step,
        times: inst.measurements!.times!,
        text: inst.text,
        isComplete: completedSteps.includes(inst.step),
      }));
  }, [recipe.instructions, completedSteps]);

  const currentInstruction = recipe.instructions.find((i) => i.step === activeStep);
  const currentTimes = currentInstruction?.measurements?.times || [];

  const handleStartTimer = useCallback(
    (stepNumber: number, timeString: string) => {
      const seconds = parseTimeToSeconds(timeString);
      if (seconds <= 0) return;

      const newTimer: ActiveTimer = {
        id: `timer-${Date.now()}`,
        stepNumber,
        label: timeString,
        totalSeconds: seconds,
        remainingSeconds: seconds,
        isRunning: true,
        startedAt: Date.now(),
      };

      addTimer(newTimer);
    },
    [addTimer]
  );

  const handleToggleTimer = useCallback(
    (timer: ActiveTimer) => {
      if (timer.isRunning) {
        // Pause
        const elapsed = timer.startedAt ? Math.floor((Date.now() - timer.startedAt) / 1000) : 0;
        updateTimer(timer.id, {
          isRunning: false,
          remainingSeconds: Math.max(0, timer.totalSeconds - elapsed),
          startedAt: undefined,
        });
      } else {
        // Resume
        updateTimer(timer.id, {
          isRunning: true,
          startedAt: Date.now() - (timer.totalSeconds - timer.remainingSeconds) * 1000,
        });
      }
    },
    [updateTimer]
  );

  const handleResetTimer = useCallback(
    (timer: ActiveTimer) => {
      updateTimer(timer.id, {
        remainingSeconds: timer.totalSeconds,
        isRunning: false,
        startedAt: undefined,
      });
    },
    [updateTimer]
  );

  const activeTimers = simulatedTimers.filter((t) => t.remainingSeconds > 0 || t.isRunning);
  const completedTimers = simulatedTimers.filter((t) => t.remainingSeconds === 0 && !t.isRunning);

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Active Timers Grid - Always visible at top */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
          Active Timers ({activeTimers.length})
        </div>
        {activeTimers.length === 0 ? (
          <div className="text-center py-6 text-zinc-600">
            No active timers. Tap a time to start.
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {activeTimers.map((timer) => {
              const progress = (timer.remainingSeconds / timer.totalSeconds) * 100;
              const isAlmostDone = timer.remainingSeconds <= 30 && timer.remainingSeconds > 0;
              const isDone = timer.remainingSeconds === 0;

              return (
                <div
                  key={timer.id}
                  className={`relative p-4 rounded-xl border transition-colors ${
                    isDone
                      ? 'bg-green-600/20 border-green-500/50'
                      : isAlmostDone
                      ? 'bg-amber-600/20 border-amber-500/50 animate-pulse'
                      : 'bg-zinc-800 border-zinc-700'
                  }`}
                >
                  {/* Progress bar background */}
                  <div className="absolute inset-0 rounded-xl overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        isDone ? 'bg-green-600/10' : isAlmostDone ? 'bg-amber-600/10' : 'bg-violet-600/10'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-500">Step {timer.stepNumber}</span>
                      <button
                        onClick={() => removeTimer(timer.id)}
                        className="text-zinc-600 hover:text-zinc-400"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    <div
                      className={`text-3xl font-mono font-bold ${
                        isDone ? 'text-green-400' : isAlmostDone ? 'text-amber-400' : 'text-white'
                      }`}
                    >
                      {formatTime(timer.remainingSeconds)}
                    </div>

                    <div className="text-xs text-zinc-500 mt-1">{timer.label}</div>

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => handleToggleTimer(timer)}
                        className={`flex-1 py-1.5 rounded text-sm font-medium ${
                          timer.isRunning
                            ? 'bg-zinc-700 text-zinc-300'
                            : 'bg-violet-600 text-white'
                        }`}
                      >
                        {timer.isRunning ? 'Pause' : 'Resume'}
                      </button>
                      <button
                        onClick={() => handleResetTimer(timer)}
                        className="px-3 py-1.5 rounded text-sm bg-zinc-700 text-zinc-400"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Current Step with Timer Buttons */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Current Step */}
        {currentInstruction && (
          <div className="mb-6">
            <div className="text-xs text-violet-400 uppercase tracking-wide mb-2">
              Step {activeStep} of {recipe.instructions.length}
            </div>
            <p className="text-xl text-white leading-relaxed mb-4">{currentInstruction.text}</p>

            {currentTimes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {currentTimes.map((time, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleStartTimer(activeStep, time)}
                    className="px-4 py-2 bg-teal-600/20 text-teal-400 rounded-lg text-lg font-medium hover:bg-teal-600/30 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {time}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upcoming Timed Steps */}
        <div className="mb-6">
          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Upcoming Timed Steps</div>
          <div className="space-y-2">
            {timedSteps
              .filter((ts) => ts.stepNumber > activeStep && !ts.isComplete)
              .map((ts) => (
                <div
                  key={ts.stepNumber}
                  className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-800"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <span className="text-xs text-zinc-600">Step {ts.stepNumber}</span>
                      <p className="text-sm text-zinc-400 line-clamp-2">{ts.text}</p>
                    </div>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {ts.times.map((time, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-teal-600/10 text-teal-500 rounded text-xs"
                        >
                          {time}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Completed Timers */}
        {completedTimers.length > 0 && (
          <div>
            <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
              Completed Timers ({completedTimers.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {completedTimers.map((timer) => (
                <div
                  key={timer.id}
                  className="px-3 py-2 rounded-lg bg-green-600/10 border border-green-600/20 text-sm"
                >
                  <span className="text-green-400">Step {timer.stepNumber}</span>
                  <span className="text-zinc-500 ml-2">{timer.label}</span>
                  <button
                    onClick={() => removeTimer(timer.id)}
                    className="ml-2 text-zinc-600 hover:text-zinc-400"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="border-t border-zinc-800 p-3 flex gap-2">
        <button
          onClick={() => onStepChange(Math.max(1, activeStep - 1))}
          disabled={activeStep <= 1}
          className="flex-1 py-3 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 disabled:opacity-30 transition-colors"
        >
          Previous
        </button>
        <button
          onClick={() => onStepComplete(activeStep)}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            completedSteps.includes(activeStep)
              ? 'bg-green-600 text-white'
              : 'bg-violet-600 text-white hover:bg-violet-700'
          }`}
        >
          Done
        </button>
        <button
          onClick={() => onStepChange(Math.min(recipe.instructions.length, activeStep + 1))}
          disabled={activeStep >= recipe.instructions.length}
          className="flex-1 py-3 bg-zinc-800 text-zinc-400 rounded-lg hover:bg-zinc-700 disabled:opacity-30 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}
