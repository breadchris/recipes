import { create } from 'zustand';

export interface Timer {
  id: string;
  stepNumber: number;
  recipeIndex: number;
  label: string;  // Original time string, e.g., "5 minutes"
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isComplete: boolean;
}

interface TimerStore {
  timers: Timer[];

  startTimer: (stepNumber: number, recipeIndex: number, label: string, totalSeconds: number) => void;
  pauseTimer: (id: string) => void;
  resumeTimer: (id: string) => void;
  dismissTimer: (id: string) => void;
  tick: (id: string) => void;
  getTimerForStep: (stepNumber: number, recipeIndex: number) => Timer | undefined;
}

const MAX_TIMERS = 5;

export const useTimerStore = create<TimerStore>()((set, get) => ({
  timers: [],

  startTimer: (stepNumber, recipeIndex, label, totalSeconds) => {
    const id = `${recipeIndex}-${stepNumber}-${Date.now()}`;

    set((state) => {
      // Check if timer already exists for this step
      const existingTimer = state.timers.find(
        (t) => t.stepNumber === stepNumber && t.recipeIndex === recipeIndex && !t.isComplete
      );

      if (existingTimer) {
        // Restart the existing timer
        return {
          timers: state.timers.map((t) =>
            t.id === existingTimer.id
              ? { ...t, remainingSeconds: totalSeconds, isRunning: true, isComplete: false }
              : t
          ),
        };
      }

      // Limit number of timers
      let timers = state.timers;
      if (timers.length >= MAX_TIMERS) {
        // Remove oldest completed timer, or oldest timer if none completed
        const completedIndex = timers.findIndex((t) => t.isComplete);
        if (completedIndex !== -1) {
          timers = timers.filter((_, i) => i !== completedIndex);
        } else {
          timers = timers.slice(1);
        }
      }

      return {
        timers: [
          ...timers,
          {
            id,
            stepNumber,
            recipeIndex,
            label,
            totalSeconds,
            remainingSeconds: totalSeconds,
            isRunning: true,
            isComplete: false,
          },
        ],
      };
    });
  },

  pauseTimer: (id) => {
    set((state) => ({
      timers: state.timers.map((t) =>
        t.id === id ? { ...t, isRunning: false } : t
      ),
    }));
  },

  resumeTimer: (id) => {
    set((state) => ({
      timers: state.timers.map((t) =>
        t.id === id && !t.isComplete ? { ...t, isRunning: true } : t
      ),
    }));
  },

  dismissTimer: (id) => {
    set((state) => ({
      timers: state.timers.filter((t) => t.id !== id),
    }));
  },

  tick: (id) => {
    set((state) => ({
      timers: state.timers.map((t) => {
        if (t.id !== id || !t.isRunning) return t;

        const newRemaining = t.remainingSeconds - 1;
        if (newRemaining <= 0) {
          return { ...t, remainingSeconds: 0, isRunning: false, isComplete: true };
        }
        return { ...t, remainingSeconds: newRemaining };
      }),
    }));
  },

  getTimerForStep: (stepNumber, recipeIndex) => {
    return get().timers.find(
      (t) => t.stepNumber === stepNumber && t.recipeIndex === recipeIndex && !t.isComplete
    );
  },
}));
