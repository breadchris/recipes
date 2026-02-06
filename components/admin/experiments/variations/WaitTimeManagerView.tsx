'use client';

import { useMemo, useState, useEffect } from 'react';
import { Recipe } from '@/lib/types';

interface WaitTimeManagerViewProps {
  recipe: Recipe;
  activeStep: number;
  completedSteps: number[];
  checkedIngredients: number[];
  onStepChange: (step: number) => void;
  onStepComplete: (step: number) => void;
}

interface WaitPeriod {
  stepNumber: number;
  stepText: string;
  waitMinutes: number;
  waitLabel: string;
  parallelTasks: ParallelTask[];
}

interface ParallelTask {
  stepNumber: number;
  text: string;
  estimatedMinutes: number;
  isComplete: boolean;
}

interface ActiveWait {
  stepNumber: number;
  waitLabel: string;
  totalSeconds: number;
  remainingSeconds: number;
  startedAt: number;
}

function parseTimeToMinutes(timeString: string): number {
  const hourMatch = timeString.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
  const minMatch = timeString.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)/i);
  const secMatch = timeString.match(/(\d+)\s*(?:seconds?|secs?)/i);

  let minutes = 0;
  if (hourMatch) minutes += parseFloat(hourMatch[1]) * 60;
  if (minMatch) minutes += parseFloat(minMatch[1]);
  if (secMatch) minutes += parseInt(secMatch[1]) / 60;

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
  return `${hrs}h ${mins}m`;
}

function formatCountdown(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Detect if a step is primarily a waiting step
function isWaitingStep(text: string): { isWait: boolean; waitType: string } {
  const lowerText = text.toLowerCase();

  const waitPatterns = [
    { keywords: ['let rest', 'rest for', 'let stand'], type: 'rest' },
    { keywords: ['let rise', 'rise for', 'proof', 'let proof'], type: 'rise' },
    { keywords: ['marinate', 'marinade'], type: 'marinate' },
    { keywords: ['chill', 'refrigerate', 'cool down', 'let cool'], type: 'chill' },
    { keywords: ['simmer', 'cook for', 'bake for', 'roast for'], type: 'cook' },
    { keywords: ['set aside', 'let sit'], type: 'wait' },
  ];

  for (const pattern of waitPatterns) {
    if (pattern.keywords.some(k => lowerText.includes(k))) {
      return { isWait: true, waitType: pattern.type };
    }
  }

  return { isWait: false, waitType: '' };
}

// Check if a task can be done during a wait (no timing conflict)
function canDoInParallel(taskText: string): boolean {
  const lowerText = taskText.toLowerCase();
  // Active tasks that can be done while waiting
  const parallelKeywords = [
    'chop', 'dice', 'slice', 'mince', 'prepare', 'measure',
    'mix', 'whisk', 'combine', 'stir', 'gather', 'wash',
    'peel', 'grate', 'shred', 'season', 'set up', 'clean'
  ];
  return parallelKeywords.some(k => lowerText.includes(k));
}

const WAIT_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  rest: { label: 'Resting', icon: '😴', color: 'amber' },
  rise: { label: 'Rising', icon: '🍞', color: 'yellow' },
  marinate: { label: 'Marinating', icon: '🫙', color: 'purple' },
  chill: { label: 'Chilling', icon: '❄️', color: 'blue' },
  cook: { label: 'Cooking', icon: '🔥', color: 'orange' },
  wait: { label: 'Waiting', icon: '⏳', color: 'zinc' },
};

export function WaitTimeManagerView({
  recipe,
  activeStep,
  completedSteps,
  onStepChange,
  onStepComplete,
}: WaitTimeManagerViewProps) {
  const [activeWaits, setActiveWaits] = useState<ActiveWait[]>([]);
  const [now, setNow] = useState(Date.now());

  // Update active waits every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
      setActiveWaits(prev => prev.map(wait => ({
        ...wait,
        remainingSeconds: Math.max(0, wait.totalSeconds - Math.floor((Date.now() - wait.startedAt) / 1000)),
      })).filter(wait => wait.remainingSeconds > 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Analyze recipe for wait periods and parallel tasks
  const { waitPeriods, totalWaitMinutes, totalActiveMinutes } = useMemo(() => {
    const waits: WaitPeriod[] = [];
    let totalWait = 0;
    let totalActive = 0;

    recipe.instructions.forEach((instruction, idx) => {
      const { isWait, waitType } = isWaitingStep(instruction.text);
      const times = instruction.measurements?.times || [];
      let stepDuration = times.reduce((sum, t) => sum + parseTimeToMinutes(t), 0);
      if (stepDuration === 0) stepDuration = 2;

      if (isWait && stepDuration >= 5) {
        // Find parallel tasks that come after this wait
        const parallelTasks: ParallelTask[] = [];
        let parallelTimeRemaining = stepDuration;

        for (let i = idx + 1; i < recipe.instructions.length && parallelTimeRemaining > 0; i++) {
          const nextInstruction = recipe.instructions[i];
          const { isWait: nextIsWait } = isWaitingStep(nextInstruction.text);

          if (nextIsWait) break; // Stop at next wait

          if (canDoInParallel(nextInstruction.text)) {
            const nextTimes = nextInstruction.measurements?.times || [];
            let nextDuration = nextTimes.reduce((sum, t) => sum + parseTimeToMinutes(t), 0);
            if (nextDuration === 0) nextDuration = 2;

            if (nextDuration <= parallelTimeRemaining) {
              parallelTasks.push({
                stepNumber: nextInstruction.step,
                text: nextInstruction.text,
                estimatedMinutes: nextDuration,
                isComplete: completedSteps.includes(nextInstruction.step),
              });
              parallelTimeRemaining -= nextDuration;
            }
          }
        }

        waits.push({
          stepNumber: instruction.step,
          stepText: instruction.text,
          waitMinutes: stepDuration,
          waitLabel: times[0] || `${Math.round(stepDuration)} minutes`,
          parallelTasks,
        });

        totalWait += stepDuration;
      } else {
        totalActive += stepDuration;
      }
    });

    return { waitPeriods: waits, totalWaitMinutes: totalWait, totalActiveMinutes: totalActive };
  }, [recipe.instructions, completedSteps]);

  const currentInstruction = recipe.instructions.find(i => i.step === activeStep);
  const currentWait = waitPeriods.find(w => w.stepNumber === activeStep);
  const { isWait: isCurrentWait, waitType: currentWaitType } = currentInstruction
    ? isWaitingStep(currentInstruction.text)
    : { isWait: false, waitType: '' };

  const startWaitTimer = (wait: WaitPeriod) => {
    const existingWait = activeWaits.find(w => w.stepNumber === wait.stepNumber);
    if (existingWait) return;

    setActiveWaits(prev => [...prev, {
      stepNumber: wait.stepNumber,
      waitLabel: wait.waitLabel,
      totalSeconds: Math.round(wait.waitMinutes * 60),
      remainingSeconds: Math.round(wait.waitMinutes * 60),
      startedAt: Date.now(),
    }]);
  };

  const dismissWait = (stepNumber: number) => {
    setActiveWaits(prev => prev.filter(w => w.stepNumber !== stepNumber));
  };

  const waitTypeConfig = currentWaitType ? WAIT_TYPE_LABELS[currentWaitType] : null;

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header with time summary */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4">
        <h2 className="text-lg font-bold text-white mb-3">{recipe.title}</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-white">
              {formatDuration(totalActiveMinutes + totalWaitMinutes)}
            </div>
            <div className="text-xs text-zinc-500">Total Time</div>
          </div>
          <div className="bg-teal-600/20 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-teal-400">{formatDuration(totalActiveMinutes)}</div>
            <div className="text-xs text-zinc-500">Hands-on</div>
          </div>
          <div className="bg-amber-600/20 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-amber-400">{formatDuration(totalWaitMinutes)}</div>
            <div className="text-xs text-zinc-500">Waiting</div>
          </div>
        </div>
      </div>

      {/* Active wait timers */}
      {activeWaits.length > 0 && (
        <div className="bg-amber-600/10 border-b border-amber-500/30 p-4">
          <div className="text-xs text-amber-400 uppercase tracking-wide mb-3">
            Active Timers ({activeWaits.length})
          </div>
          <div className="grid grid-cols-2 gap-3">
            {activeWaits.map(wait => {
              const progress = (wait.remainingSeconds / wait.totalSeconds) * 100;
              const isAlmostDone = wait.remainingSeconds <= 60;

              return (
                <div
                  key={wait.stepNumber}
                  className={`relative p-3 rounded-lg border ${
                    isAlmostDone
                      ? 'bg-green-600/20 border-green-500/50 animate-pulse'
                      : 'bg-zinc-800 border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-zinc-500">Step {wait.stepNumber}</span>
                    <button
                      onClick={() => dismissWait(wait.stepNumber)}
                      className="text-zinc-600 hover:text-zinc-400"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className={`text-2xl font-mono font-bold ${isAlmostDone ? 'text-green-400' : 'text-white'}`}>
                    {formatCountdown(wait.remainingSeconds)}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">{wait.waitLabel}</div>
                  <div className="mt-2 h-1 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${isAlmostDone ? 'bg-green-500' : 'bg-amber-500'}`}
                      style={{ width: `${100 - progress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Current step */}
      <div className={`p-4 border-b ${
        isCurrentWait
          ? `bg-${waitTypeConfig?.color || 'amber'}-600/10 border-${waitTypeConfig?.color || 'amber'}-500/30`
          : 'bg-violet-600/10 border-violet-500/30'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs uppercase tracking-wide text-zinc-400">
            Step {activeStep} of {recipe.instructions.length}
          </span>
          {isCurrentWait && waitTypeConfig && (
            <span className={`px-2 py-0.5 bg-${waitTypeConfig.color}-500/20 text-${waitTypeConfig.color}-400 rounded text-xs`}>
              {waitTypeConfig.icon} {waitTypeConfig.label}
            </span>
          )}
        </div>
        <p className="text-white text-lg">{currentInstruction?.text}</p>

        <div className="flex gap-2 mt-4">
          {isCurrentWait && currentWait && !activeWaits.find(w => w.stepNumber === activeStep) && (
            <button
              onClick={() => startWaitTimer(currentWait)}
              className="px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Start Timer ({currentWait.waitLabel})
            </button>
          )}
          <button
            onClick={() => onStepComplete(activeStep)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              completedSteps.includes(activeStep)
                ? 'bg-green-600 text-white'
                : 'bg-violet-600 text-white hover:bg-violet-700'
            }`}
          >
            {completedSteps.includes(activeStep) ? '✓ Done' : 'Mark Complete'}
          </button>
        </div>
      </div>

      {/* Parallel tasks during wait */}
      {isCurrentWait && currentWait && currentWait.parallelTasks.length > 0 && (
        <div className="p-4 bg-teal-600/10 border-b border-teal-500/30">
          <div className="text-xs text-teal-400 uppercase tracking-wide mb-3">
            💡 While waiting, you can:
          </div>
          <div className="space-y-2">
            {currentWait.parallelTasks.map(task => (
              <div
                key={task.stepNumber}
                onClick={() => onStepChange(task.stepNumber)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                  task.isComplete
                    ? 'bg-green-600/10 opacity-60'
                    : 'bg-zinc-800/50 hover:bg-zinc-800'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  task.isComplete
                    ? 'bg-green-500 text-white'
                    : 'bg-teal-600 text-white'
                }`}>
                  {task.isComplete ? '✓' : task.stepNumber}
                </div>
                <div className="flex-1">
                  <p className={`text-sm ${task.isComplete ? 'text-zinc-500 line-through' : 'text-zinc-300'}`}>
                    {task.text}
                  </p>
                  <span className="text-xs text-zinc-500">~{formatDuration(task.estimatedMinutes)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming wait periods */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
          Upcoming Wait Periods ({waitPeriods.filter(w => w.stepNumber > activeStep).length})
        </div>
        <div className="space-y-3">
          {waitPeriods
            .filter(wait => wait.stepNumber > activeStep)
            .map(wait => {
              const { waitType } = isWaitingStep(wait.stepText);
              const config = WAIT_TYPE_LABELS[waitType] || WAIT_TYPE_LABELS.wait;

              return (
                <div
                  key={wait.stepNumber}
                  onClick={() => onStepChange(wait.stepNumber)}
                  className="p-4 rounded-lg bg-zinc-800/50 border border-zinc-800 cursor-pointer hover:bg-zinc-800 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-zinc-600">Step {wait.stepNumber}</span>
                        <span className={`px-2 py-0.5 bg-${config.color}-500/20 text-${config.color}-400 rounded text-xs`}>
                          {config.icon} {config.label}
                        </span>
                      </div>
                      <p className="text-sm text-zinc-400 line-clamp-2">{wait.stepText}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-amber-400">
                        {formatDuration(wait.waitMinutes)}
                      </div>
                      {wait.parallelTasks.length > 0 && (
                        <div className="text-xs text-teal-400 mt-1">
                          {wait.parallelTasks.length} tasks to do
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

          {waitPeriods.filter(w => w.stepNumber > activeStep).length === 0 && (
            <div className="text-center py-8 text-zinc-600">
              No more wait periods ahead!
            </div>
          )}
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
