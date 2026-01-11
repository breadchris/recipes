import { Recipe } from '../types';

export interface RecipeConfiguration {
  id: string;
  name: string;
  description?: string;
  recipe: Recipe;
  videoId: string;
  initialProgress?: {
    completedSteps: number[];
    checkedIngredients: number[];
  };
  activeStep?: number;
}

export interface ComponentVariation {
  id: string;
  name: string;
  description: string;
}

export interface ComponentCategory {
  id: string;
  name: string;
  description: string;
  variations: ComponentVariation[];
}

// Voice command types for VoiceOptimizedView
export type VoiceCommand =
  | 'next'
  | 'previous'
  | 'repeat'
  | 'timer'
  | 'ingredients'
  | 'done'
  | 'start'
  | 'stop';

export interface VoiceRecognitionState {
  isListening: boolean;
  isSupported: boolean;
  transcript: string;
  error: string | null;
}

export interface SpeechSynthesisState {
  isSpeaking: boolean;
  isSupported: boolean;
  isPaused: boolean;
}

// Extracted action for QuickGlanceView
export interface ExtractedAction {
  verb: string;           // "SEAR", "CHOP", "MIX"
  subject: string;        // "chicken", "onions"
  measurement?: string;   // "3 min", "350°F"
  fullText: string;       // Original instruction text
  stepNumber: number;
}

// Timer type for TimerCentricView
export interface ActiveTimer {
  id: string;
  stepNumber: number;
  label: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  startedAt?: number;
}

// Realtime voice state for AIVoiceAssistantView
export interface RealtimeVoiceState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  assistantMessage: string;
  error: string | null;
}

// Preset configurations
export const RECIPE_VIEW_VARIATIONS: ComponentVariation[] = [
  {
    id: 'focused-step',
    name: 'Focused Step',
    description: 'Full-screen single step display with large text and minimal UI',
  },
  {
    id: 'quick-glance',
    name: 'Quick Glance',
    description: 'Ultra-high contrast with extracted key actions for busy cooks',
  },
  {
    id: 'voice-optimized',
    name: 'Voice Control',
    description: 'Hands-free operation with voice commands and text-to-speech',
  },
  {
    id: 'progress-tracker',
    name: 'Progress Tracker',
    description: 'Overview of recipe progress with upcoming steps preview',
  },
  {
    id: 'timer-centric',
    name: 'Timer Centric',
    description: 'Multiple timer management for timing-sensitive cooking',
  },
  {
    id: 'ai-voice-assistant',
    name: 'AI Voice Assistant',
    description: 'Conversational AI cooking assistant with OpenAI Realtime API',
  },
];

export const COMPONENT_CATEGORIES: ComponentCategory[] = [
  {
    id: 'recipe-view',
    name: 'Recipe View',
    description: 'Different layouts for viewing recipes while cooking',
    variations: RECIPE_VIEW_VARIATIONS,
  },
];
