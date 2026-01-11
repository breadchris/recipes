'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { VoiceCommand, VoiceRecognitionState } from '../types/component-lab';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

// Extend Window interface for SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface UseSpeechRecognitionOptions {
  onCommand?: (command: VoiceCommand) => void;
  continuous?: boolean;
  language?: string;
}

const COMMAND_PATTERNS: Record<VoiceCommand, RegExp[]> = {
  next: [/^next$/i, /^next step$/i, /^go next$/i, /^forward$/i, /^continue$/i],
  previous: [/^previous$/i, /^back$/i, /^go back$/i, /^last step$/i],
  repeat: [/^repeat$/i, /^again$/i, /^say again$/i, /^what$/i, /^read again$/i],
  timer: [/^timer$/i, /^start timer$/i, /^set timer$/i],
  ingredients: [/^ingredients$/i, /^show ingredients$/i, /^what ingredients$/i],
  done: [/^done$/i, /^complete$/i, /^finished$/i, /^mark done$/i],
  start: [/^start$/i, /^start listening$/i, /^listen$/i],
  stop: [/^stop$/i, /^stop listening$/i, /^pause$/i],
};

function matchCommand(transcript: string): VoiceCommand | null {
  const normalized = transcript.trim().toLowerCase();

  for (const [command, patterns] of Object.entries(COMMAND_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return command as VoiceCommand;
      }
    }
  }

  return null;
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const { onCommand, continuous = true, language = 'en-US' } = options;

  const [state, setState] = useState<VoiceRecognitionState>({
    isListening: false,
    isSupported: false,
    transcript: '',
    error: null,
  });

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const onCommandRef = useRef(onCommand);

  // Keep onCommand ref up to date
  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  // Check browser support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setState((prev) => ({ ...prev, isSupported: !!SpeechRecognition }));
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setState((prev) => ({
        ...prev,
        error: 'Speech recognition not supported in this browser',
      }));
      return;
    }

    // Stop any existing recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = continuous;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onstart = () => {
      setState((prev) => ({ ...prev, isListening: true, error: null }));
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setState((prev) => ({
        ...prev,
        transcript: finalTranscript || interimTranscript,
      }));

      // Check for commands in final transcript
      if (finalTranscript) {
        const command = matchCommand(finalTranscript);
        if (command && onCommandRef.current) {
          onCommandRef.current(command);
        }
      }
    };

    recognition.onerror = (event) => {
      let errorMessage = 'Speech recognition error';
      let shouldClearRef = false;

      switch (event.error) {
        case 'no-speech':
          errorMessage = 'No speech detected. Try speaking louder.';
          break;
        case 'audio-capture':
          errorMessage = 'No microphone found. Check your audio settings.';
          shouldClearRef = true;
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Allow microphone in browser settings.';
          shouldClearRef = true;
          break;
        case 'network':
          // Chrome's speech recognition requires internet - it sends audio to Google's servers
          errorMessage = 'Network error. Speech recognition requires internet connection.';
          shouldClearRef = true; // Don't auto-restart on network errors
          break;
        case 'aborted':
          // User stopped, not an error
          return;
      }

      // Clear ref to prevent auto-restart loop on persistent errors
      if (shouldClearRef) {
        recognitionRef.current = null;
      }

      setState((prev) => ({ ...prev, error: errorMessage, isListening: false }));
    };

    recognition.onend = () => {
      setState((prev) => ({ ...prev, isListening: false }));

      // Restart if continuous mode and still should be listening
      if (continuous && recognitionRef.current === recognition) {
        try {
          recognition.start();
        } catch {
          // Ignore - might be intentionally stopped
        }
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: 'Failed to start speech recognition',
      }));
    }
  }, [continuous, language]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setState((prev) => ({ ...prev, isListening: false }));
  }, []);

  const toggleListening = useCallback(() => {
    if (state.isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [state.isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  return {
    ...state,
    startListening,
    stopListening,
    toggleListening,
  };
}
