import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { RECIPE_VIEW_VARIATIONS } from '@/lib/types/component-lab';

// Recipe viewer variant type - 'default' means the standard RecipeViewer
export type RecipeViewerVariant = 'default' | 'focused-step' | 'quick-glance' | 'voice-optimized' | 'progress-tracker' | 'timer-centric' | 'ai-voice-assistant';

export interface FeatureFlags {
  // Global flags
  showBuyButton: boolean;
  showInstacartButton: boolean;
}

// Page-specific flags (not persisted with global flags)
export interface PageSpecificFlags {
  // Recipe page
  recipeViewerVariant: RecipeViewerVariant;
}

const defaultFlags: FeatureFlags = {
  showBuyButton: false,
  showInstacartButton: true,
};

const defaultPageFlags: PageSpecificFlags = {
  recipeViewerVariant: 'default',
};

interface FeatureFlagsStore {
  flags: FeatureFlags;
  pageFlags: PageSpecificFlags;
  setFlag: <K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => void;
  getFlag: <K extends keyof FeatureFlags>(key: K) => FeatureFlags[K];
  setPageFlag: <K extends keyof PageSpecificFlags>(key: K, value: PageSpecificFlags[K]) => void;
  getPageFlag: <K extends keyof PageSpecificFlags>(key: K) => PageSpecificFlags[K];
  resetFlags: () => void;
  resetPageFlags: () => void;
}

export const useFeatureFlagsStore = create<FeatureFlagsStore>()(
  persist(
    (set, get) => ({
      flags: defaultFlags,
      pageFlags: defaultPageFlags,

      setFlag: (key, value) => {
        set((state) => ({
          flags: {
            ...state.flags,
            [key]: value,
          },
        }));
      },

      getFlag: (key) => {
        return get().flags[key];
      },

      setPageFlag: (key, value) => {
        set((state) => ({
          pageFlags: {
            ...state.pageFlags,
            [key]: value,
          },
        }));
      },

      getPageFlag: (key) => {
        return get().pageFlags[key];
      },

      resetFlags: () => {
        set({ flags: defaultFlags });
      },

      resetPageFlags: () => {
        set({ pageFlags: defaultPageFlags });
      },
    }),
    {
      name: 'feature-flags-storage',
    }
  )
);

export const featureFlagDefinitions: Record<keyof FeatureFlags, { label: string; description: string }> = {
  showBuyButton: {
    label: 'Buy on Amazon Button',
    description: 'Show the "Buy on Amazon" button in the ingredients section',
  },
  showInstacartButton: {
    label: 'Order on Instacart Button',
    description: 'Show the "Order on Instacart" button in the ingredients section',
  },
};

export const pageFlagDefinitions: Record<keyof PageSpecificFlags, {
  label: string;
  description: string;
  page: string;
  options?: { value: string; label: string; description: string }[];
}> = {
  recipeViewerVariant: {
    label: 'Recipe Viewer Variant',
    description: 'Switch between different recipe viewer layouts',
    page: '/recipe/',
    options: [
      { value: 'default', label: 'Default', description: 'Standard recipe viewer with tabs' },
      ...RECIPE_VIEW_VARIATIONS.map(v => ({ value: v.id, label: v.name, description: v.description })),
    ],
  },
};
