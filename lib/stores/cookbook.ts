import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { VideoWithChannel } from '../types';

export interface SavedVideo {
  video: VideoWithChannel;
  notes: string;
  savedAt: number;
}

interface CookbookStore {
  savedVideos: Record<string, SavedVideo>;

  // Actions
  saveVideo: (video: VideoWithChannel) => void;
  removeVideo: (videoId: string) => void;
  updateNotes: (videoId: string, notes: string) => void;
  isSaved: (videoId: string) => boolean;
  getSavedVideo: (videoId: string) => SavedVideo | undefined;
  getSavedVideosArray: () => SavedVideo[];
  exportCookbook: () => string;
  importCookbook: (jsonString: string) => void;
  clearCookbook: () => void;
}

export const useCookbookStore = create<CookbookStore>()(
  persist(
    (set, get) => ({
      savedVideos: {},

      saveVideo: (video) => {
        set((state) => ({
          savedVideos: {
            ...state.savedVideos,
            [video.id]: {
              video,
              notes: '',
              savedAt: Date.now(),
            },
          },
        }));
      },

      removeVideo: (videoId) => {
        set((state) => {
          const newSavedVideos = { ...state.savedVideos };
          delete newSavedVideos[videoId];
          return { savedVideos: newSavedVideos };
        });
      },

      updateNotes: (videoId, notes) => {
        set((state) => {
          const savedVideo = state.savedVideos[videoId];
          if (!savedVideo) return state;

          return {
            savedVideos: {
              ...state.savedVideos,
              [videoId]: {
                ...savedVideo,
                notes,
              },
            },
          };
        });
      },

      isSaved: (videoId) => {
        return videoId in get().savedVideos;
      },

      getSavedVideo: (videoId) => {
        return get().savedVideos[videoId];
      },

      getSavedVideosArray: () => {
        const savedVideos = get().savedVideos;
        return Object.values(savedVideos).sort((a, b) => b.savedAt - a.savedAt);
      },

      exportCookbook: () => {
        const data = {
          savedVideos: get().savedVideos,
          exportedAt: new Date().toISOString(),
          version: '1.0',
        };
        return JSON.stringify(data, null, 2);
      },

      importCookbook: (jsonString) => {
        try {
          const data = JSON.parse(jsonString);
          if (data.savedVideos && typeof data.savedVideos === 'object') {
            set({ savedVideos: data.savedVideos });
          }
        } catch (error) {
          console.error('Failed to import cookbook:', error);
          throw new Error('Invalid cookbook format');
        }
      },

      clearCookbook: () => {
        set({ savedVideos: {} });
      },
    }),
    {
      name: 'cookbook-storage',
    }
  )
);
