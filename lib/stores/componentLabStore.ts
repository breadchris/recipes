import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RecipeConfiguration, ActiveTimer } from '../types/component-lab';

interface SimulatedProgress {
  completedSteps: number[];
  checkedIngredients: number[];
}

interface ComponentLabStore {
  // Active experiment state
  activeComponentType: string;
  activeVariation: string;

  // Sample data configurations
  savedConfigurations: Record<string, RecipeConfiguration>;
  activeConfigurationId: string | null;

  // Recipe state simulation
  simulatedProgress: SimulatedProgress;
  simulatedActiveStep: number;
  simulatedTimers: ActiveTimer[];

  // Actions - navigation
  setActiveComponentType: (type: string) => void;
  setActiveVariation: (variation: string) => void;

  // Actions - configurations
  saveConfiguration: (config: RecipeConfiguration) => void;
  deleteConfiguration: (id: string) => void;
  loadConfiguration: (id: string) => void;
  clearActiveConfiguration: () => void;

  // Actions - simulation
  setActiveStep: (step: number) => void;
  toggleStepComplete: (step: number) => void;
  toggleIngredientChecked: (index: number) => void;
  resetSimulation: () => void;

  // Actions - timers
  addTimer: (timer: ActiveTimer) => void;
  updateTimer: (id: string, updates: Partial<ActiveTimer>) => void;
  removeTimer: (id: string) => void;
  clearTimers: () => void;
}

const emptyProgress: SimulatedProgress = {
  completedSteps: [],
  checkedIngredients: [],
};

export const useComponentLabStore = create<ComponentLabStore>()(
  persist(
    (set, get) => ({
      // Initial state
      activeComponentType: 'recipe-view',
      activeVariation: 'focused-step',
      savedConfigurations: {},
      activeConfigurationId: null,
      simulatedProgress: emptyProgress,
      simulatedActiveStep: 1,
      simulatedTimers: [],

      // Navigation actions
      setActiveComponentType: (type) => set({ activeComponentType: type }),
      setActiveVariation: (variation) => set({ activeVariation: variation }),

      // Configuration actions
      saveConfiguration: (config) =>
        set((state) => ({
          savedConfigurations: {
            ...state.savedConfigurations,
            [config.id]: config,
          },
        })),

      deleteConfiguration: (id) =>
        set((state) => {
          const newConfigs = { ...state.savedConfigurations };
          delete newConfigs[id];
          return {
            savedConfigurations: newConfigs,
            activeConfigurationId:
              state.activeConfigurationId === id
                ? null
                : state.activeConfigurationId,
          };
        }),

      loadConfiguration: (id) => {
        const config = get().savedConfigurations[id];
        if (config) {
          set({
            activeConfigurationId: id,
            simulatedProgress: config.initialProgress || emptyProgress,
            simulatedActiveStep: config.activeStep || 1,
          });
        }
      },

      clearActiveConfiguration: () =>
        set({
          activeConfigurationId: null,
          simulatedProgress: emptyProgress,
          simulatedActiveStep: 1,
        }),

      // Simulation actions
      setActiveStep: (step) => set({ simulatedActiveStep: step }),

      toggleStepComplete: (step) =>
        set((state) => {
          const completed = state.simulatedProgress.completedSteps.includes(step)
            ? state.simulatedProgress.completedSteps.filter((s) => s !== step)
            : [...state.simulatedProgress.completedSteps, step];
          return {
            simulatedProgress: {
              ...state.simulatedProgress,
              completedSteps: completed,
            },
          };
        }),

      toggleIngredientChecked: (index) =>
        set((state) => {
          const checked = state.simulatedProgress.checkedIngredients.includes(index)
            ? state.simulatedProgress.checkedIngredients.filter((i) => i !== index)
            : [...state.simulatedProgress.checkedIngredients, index];
          return {
            simulatedProgress: {
              ...state.simulatedProgress,
              checkedIngredients: checked,
            },
          };
        }),

      resetSimulation: () =>
        set({
          simulatedProgress: emptyProgress,
          simulatedActiveStep: 1,
          simulatedTimers: [],
        }),

      // Timer actions
      addTimer: (timer) =>
        set((state) => ({
          simulatedTimers: [...state.simulatedTimers, timer],
        })),

      updateTimer: (id, updates) =>
        set((state) => ({
          simulatedTimers: state.simulatedTimers.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      removeTimer: (id) =>
        set((state) => ({
          simulatedTimers: state.simulatedTimers.filter((t) => t.id !== id),
        })),

      clearTimers: () => set({ simulatedTimers: [] }),
    }),
    {
      name: 'component-lab-storage',
    }
  )
);
