import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RecipeProgress {
  checkedIngredients: number[];  // indices of checked ingredients
  completedSteps: number[];      // step numbers that are completed
}

interface RecipeProgressStore {
  progress: Record<string, RecipeProgress>;

  // Actions
  toggleIngredient: (videoId: string, index: number) => void;
  toggleStep: (videoId: string, stepNumber: number) => void;
  isIngredientChecked: (videoId: string, index: number) => boolean;
  isStepCompleted: (videoId: string, stepNumber: number) => boolean;
  getProgress: (videoId: string) => RecipeProgress;
  resetProgress: (videoId: string) => void;
}

const emptyProgress: RecipeProgress = {
  checkedIngredients: [],
  completedSteps: [],
};

export const useRecipeProgressStore = create<RecipeProgressStore>()(
  persist(
    (set, get) => ({
      progress: {},

      toggleIngredient: (videoId, index) => {
        set((state) => {
          const current = state.progress[videoId] || emptyProgress;
          const checked = current.checkedIngredients.includes(index)
            ? current.checkedIngredients.filter((i) => i !== index)
            : [...current.checkedIngredients, index];

          return {
            progress: {
              ...state.progress,
              [videoId]: {
                ...current,
                checkedIngredients: checked,
              },
            },
          };
        });
      },

      toggleStep: (videoId, stepNumber) => {
        set((state) => {
          const current = state.progress[videoId] || emptyProgress;
          const completed = current.completedSteps.includes(stepNumber)
            ? current.completedSteps.filter((s) => s !== stepNumber)
            : [...current.completedSteps, stepNumber];

          return {
            progress: {
              ...state.progress,
              [videoId]: {
                ...current,
                completedSteps: completed,
              },
            },
          };
        });
      },

      isIngredientChecked: (videoId, index) => {
        const progress = get().progress[videoId];
        return progress?.checkedIngredients.includes(index) ?? false;
      },

      isStepCompleted: (videoId, stepNumber) => {
        const progress = get().progress[videoId];
        return progress?.completedSteps.includes(stepNumber) ?? false;
      },

      getProgress: (videoId) => {
        return get().progress[videoId] || emptyProgress;
      },

      resetProgress: (videoId) => {
        set((state) => {
          const newProgress = { ...state.progress };
          delete newProgress[videoId];
          return { progress: newProgress };
        });
      },
    }),
    {
      name: 'recipe-progress-storage',
    }
  )
);
