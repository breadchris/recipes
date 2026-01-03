import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RecipeProgress {
  checkedIngredients: number[];  // indices of checked ingredients
  completedSteps: number[];      // step numbers that are completed
}

// Helper to create a key for recipe progress (supports multiple recipes per video)
function makeKey(videoId: string, recipeIndex: number = 0): string {
  return `${videoId}:${recipeIndex}`;
}

interface RecipeProgressStore {
  progress: Record<string, RecipeProgress>;

  // Actions - now take optional recipeIndex parameter
  toggleIngredient: (videoId: string, index: number, recipeIndex?: number) => void;
  toggleStep: (videoId: string, stepNumber: number, recipeIndex?: number) => void;
  isIngredientChecked: (videoId: string, index: number, recipeIndex?: number) => boolean;
  isStepCompleted: (videoId: string, stepNumber: number, recipeIndex?: number) => boolean;
  getProgress: (videoId: string, recipeIndex?: number) => RecipeProgress;
  resetProgress: (videoId: string, recipeIndex?: number) => void;
}

const emptyProgress: RecipeProgress = {
  checkedIngredients: [],
  completedSteps: [],
};

export const useRecipeProgressStore = create<RecipeProgressStore>()(
  persist(
    (set, get) => ({
      progress: {},

      toggleIngredient: (videoId, index, recipeIndex = 0) => {
        const key = makeKey(videoId, recipeIndex);
        set((state) => {
          const current = state.progress[key] || emptyProgress;
          const checked = current.checkedIngredients.includes(index)
            ? current.checkedIngredients.filter((i) => i !== index)
            : [...current.checkedIngredients, index];

          return {
            progress: {
              ...state.progress,
              [key]: {
                ...current,
                checkedIngredients: checked,
              },
            },
          };
        });
      },

      toggleStep: (videoId, stepNumber, recipeIndex = 0) => {
        const key = makeKey(videoId, recipeIndex);
        set((state) => {
          const current = state.progress[key] || emptyProgress;
          const completed = current.completedSteps.includes(stepNumber)
            ? current.completedSteps.filter((s) => s !== stepNumber)
            : [...current.completedSteps, stepNumber];

          return {
            progress: {
              ...state.progress,
              [key]: {
                ...current,
                completedSteps: completed,
              },
            },
          };
        });
      },

      isIngredientChecked: (videoId, index, recipeIndex = 0) => {
        const key = makeKey(videoId, recipeIndex);
        const progress = get().progress[key];
        return progress?.checkedIngredients.includes(index) ?? false;
      },

      isStepCompleted: (videoId, stepNumber, recipeIndex = 0) => {
        const key = makeKey(videoId, recipeIndex);
        const progress = get().progress[key];
        return progress?.completedSteps.includes(stepNumber) ?? false;
      },

      getProgress: (videoId, recipeIndex = 0) => {
        const key = makeKey(videoId, recipeIndex);
        return get().progress[key] || emptyProgress;
      },

      resetProgress: (videoId, recipeIndex = 0) => {
        const key = makeKey(videoId, recipeIndex);
        set((state) => {
          const newProgress = { ...state.progress };
          delete newProgress[key];
          return { progress: newProgress };
        });
      },
    }),
    {
      name: 'recipe-progress-storage',
    }
  )
);
