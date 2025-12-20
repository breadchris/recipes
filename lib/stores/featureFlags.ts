import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FeatureFlags {
  showBuyButton: boolean;
  showInstacartButton: boolean;
}

const defaultFlags: FeatureFlags = {
  showBuyButton: false,
  showInstacartButton: true,
};

interface FeatureFlagsStore {
  flags: FeatureFlags;
  setFlag: <K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) => void;
  getFlag: <K extends keyof FeatureFlags>(key: K) => FeatureFlags[K];
  resetFlags: () => void;
}

export const useFeatureFlagsStore = create<FeatureFlagsStore>()(
  persist(
    (set, get) => ({
      flags: defaultFlags,

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

      resetFlags: () => {
        set({ flags: defaultFlags });
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
