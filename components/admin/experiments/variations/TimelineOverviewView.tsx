'use client';

import { useMemo } from 'react';
import { Recipe } from '@/lib/types';

interface TimelineOverviewViewProps {
  recipe: Recipe;
  activeStep: number;
  completedSteps: number[];
  checkedIngredients: number[];
  onStepChange: (step: number) => void;
  onStepComplete: (step: number) => void;
}

interface TimeBlock {
  stepNumber: number;
  text: string;
  type: 'active' | 'wait' | 'prep';
  durationMinutes: number;
  times: string[];
  startMinute: number;
  isCompleted: boolean;
}

function parseTimeToMinutes(timeString: string): number {
  const hourMatch = timeString.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
  const minMatch = timeString.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)/i);
  const secMatch = timeString.match(/(\d+)\s*(?:seconds?|secs?)/i);

  let minutes = 0;
  if (hourMatch) minutes += parseFloat(hourMatch[1]) * 60;
  if (minMatch) minutes += parseFloat(minMatch[1]);
  if (secMatch) minutes += parseInt(secMatch[1]) / 60;

  // If only a number, assume minutes
  if (!hourMatch && !minMatch && !secMatch) {
    const numMatch = timeString.match(/(\d+)/);
    if (numMatch) minutes = parseInt(numMatch[1]);
  }

  return minutes;
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Detect if a step is primarily a waiting step
function isWaitingStep(text: string): boolean {
  const waitingKeywords = [
    'let rest', 'let sit', 'allow to', 'wait', 'rest for', 'cool',
    'chill', 'refrigerate', 'marinate', 'rise', 'proof', 'set aside',
    'let stand', 'simmer', 'bake', 'roast', 'braise'
  ];
  const lowerText = text.toLowerCase();
  return waitingKeywords.some(keyword => lowerText.includes(keyword));
}

export function TimelineOverviewView({
  recipe,
  activeStep,
  completedSteps,
  onStepChange,
  onStepComplete,
}: TimelineOverviewViewProps) {
  // Calculate time blocks and total time
  const { timeBlocks, totalMinutes, activeMinutes, waitMinutes } = useMemo(() => {
    const blocks: TimeBlock[] = [];
    let runningMinutes = 0;
    let totalActive = 0;
    let totalWait = 0;

    recipe.instructions.forEach((instruction) => {
      const times = instruction.measurements?.times || [];
      let stepDuration = 0;

      // Calculate duration from times in the step
      times.forEach(time => {
        stepDuration += parseTimeToMinutes(time);
      });

      // Default to 2 minutes if no time specified
      if (stepDuration === 0) stepDuration = 2;

      const isWait = isWaitingStep(instruction.text);
      const blockType = isWait ? 'wait' : 'active';

      if (isWait) {
        totalWait += stepDuration;
      } else {
        totalActive += stepDuration;
      }

      blocks.push({
        stepNumber: instruction.step,
        text: instruction.text,
        type: blockType,
        durationMinutes: stepDuration,
        times,
        startMinute: runningMinutes,
        isCompleted: completedSteps.includes(instruction.step),
      });

      runningMinutes += stepDuration;
    });

    return {
      timeBlocks: blocks,
      totalMinutes: runningMinutes,
      activeMinutes: totalActive,
      waitMinutes: totalWait,
    };
  }, [recipe.instructions, completedSteps]);

  // Calculate completion time
  const now = new Date();
  const completionTime = new Date(now.getTime() + totalMinutes * 60 * 1000);

  // Calculate current progress through timeline
  const completedMinutes = useMemo(() => {
    return timeBlocks
      .filter(block => block.isCompleted)
      .reduce((sum, block) => sum + block.durationMinutes, 0);
  }, [timeBlocks]);

  const progressPercent = totalMinutes > 0 ? (completedMinutes / totalMinutes) * 100 : 0;

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header with completion time */}
      <div className="bg-gradient-to-r from-violet-600/20 to-teal-600/20 border-b border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">{recipe.title}</h2>
            <p className="text-zinc-400 text-sm mt-1">Timeline Overview</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">{formatTime(completionTime)}</div>
            <div className="text-sm text-zinc-400">Expected completion</div>
          </div>
        </div>

        {/* Time breakdown */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">{formatDuration(totalMinutes)}</div>
            <div className="text-xs text-zinc-500 uppercase">Total Time</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-teal-400">{formatDuration(activeMinutes)}</div>
            <div className="text-xs text-zinc-500 uppercase">Active Cooking</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{formatDuration(waitMinutes)}</div>
            <div className="text-xs text-zinc-500 uppercase">Waiting Time</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-3 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-teal-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
          <div className="absolute inset-0 flex">
            {timeBlocks.map((block, idx) => {
              const widthPercent = (block.durationMinutes / totalMinutes) * 100;
              return (
                <div
                  key={idx}
                  className={`h-full border-r border-zinc-700/50 ${
                    block.type === 'wait' ? 'bg-amber-500/20' : ''
                  }`}
                  style={{ width: `${widthPercent}%` }}
                />
              );
            })}
          </div>
        </div>
        <div className="flex justify-between mt-1 text-xs text-zinc-600">
          <span>Now</span>
          <span>{formatDuration(completedMinutes)} completed</span>
          <span>{formatTime(completionTime)}</span>
        </div>
      </div>

      {/* Timeline visualization */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-zinc-800" />

          {timeBlocks.map((block, idx) => {
            const isActive = block.stepNumber === activeStep;
            const isPast = block.isCompleted;
            const expectedTime = new Date(now.getTime() + block.startMinute * 60 * 1000);

            return (
              <div
                key={block.stepNumber}
                onClick={() => onStepChange(block.stepNumber)}
                className={`relative pl-16 pr-4 py-4 mb-2 rounded-xl cursor-pointer transition-all ${
                  isActive
                    ? 'bg-violet-600/20 border border-violet-500/50'
                    : isPast
                    ? 'bg-zinc-800/30 opacity-60'
                    : 'bg-zinc-800/50 hover:bg-zinc-800'
                }`}
              >
                {/* Timeline dot */}
                <div
                  className={`absolute left-4 top-6 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    isPast
                      ? 'bg-green-500 border-green-400'
                      : isActive
                      ? 'bg-violet-500 border-violet-400'
                      : block.type === 'wait'
                      ? 'bg-amber-500/20 border-amber-500'
                      : 'bg-zinc-700 border-zinc-600'
                  }`}
                >
                  {isPast && (
                    <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>

                {/* Time indicator */}
                <div className="absolute left-14 -top-2 text-xs text-zinc-500">
                  {formatTime(expectedTime)}
                </div>

                {/* Content */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-zinc-500">Step {block.stepNumber}</span>
                      {block.type === 'wait' && (
                        <span className="px-2 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                          Wait
                        </span>
                      )}
                    </div>
                    <p className={`text-sm ${isPast ? 'text-zinc-500' : 'text-zinc-200'}`}>
                      {block.text}
                    </p>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <div className={`text-lg font-semibold ${
                      block.type === 'wait' ? 'text-amber-400' : 'text-teal-400'
                    }`}>
                      {formatDuration(block.durationMinutes)}
                    </div>
                    {block.times.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end mt-1">
                        {block.times.map((time, tidx) => (
                          <span
                            key={tidx}
                            className="px-1.5 py-0.5 text-xs bg-zinc-700 text-zinc-400 rounded"
                          >
                            {time}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Complete button */}
                {isActive && !isPast && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStepComplete(block.stepNumber);
                    }}
                    className="mt-3 px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
                  >
                    Mark Complete
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom navigation */}
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
          {completedSteps.includes(activeStep) ? '✓ Done' : 'Complete'}
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
