'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { SpeechSynthesisState } from '../types/component-lab';

interface UseSpeechSynthesisOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  voice?: string;
  onEnd?: () => void;
}

export function useSpeechSynthesis(options: UseSpeechSynthesisOptions = {}) {
  const { rate = 0.9, pitch = 1, volume = 1, voice: voiceName, onEnd } = options;

  const [state, setState] = useState<SpeechSynthesisState>({
    isSpeaking: false,
    isSupported: false,
    isPaused: false,
  });

  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const onEndRef = useRef(onEnd);

  // Keep onEnd ref up to date
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  // Check browser support and load voices
  useEffect(() => {
    const isSupported = 'speechSynthesis' in window;
    setState((prev) => ({ ...prev, isSupported }));

    if (!isSupported) return;

    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Get preferred voice
  const getVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (voices.length === 0) return null;

    // Try to find specified voice
    if (voiceName) {
      const found = voices.find((v) => v.name === voiceName);
      if (found) return found;
    }

    // Prefer English voices
    const englishVoices = voices.filter((v) => v.lang.startsWith('en'));

    // Prefer natural-sounding voices
    const naturalVoice = englishVoices.find(
      (v) =>
        v.name.includes('Natural') ||
        v.name.includes('Enhanced') ||
        v.name.includes('Premium')
    );
    if (naturalVoice) return naturalVoice;

    // Fallback to any English voice or first available
    return englishVoices[0] || voices[0];
  }, [voices, voiceName]);

  const speak = useCallback(
    (text: string) => {
      if (!state.isSupported) {
        console.warn('Speech synthesis not supported');
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      const voice = getVoice();
      if (voice) {
        utterance.voice = voice;
      }

      utterance.onstart = () => {
        setState((prev) => ({ ...prev, isSpeaking: true, isPaused: false }));
      };

      utterance.onend = () => {
        setState((prev) => ({ ...prev, isSpeaking: false, isPaused: false }));
        if (onEndRef.current) {
          onEndRef.current();
        }
      };

      utterance.onerror = (event) => {
        // 'canceled' and 'interrupted' are expected when switching steps or stopping speech
        if (event.error !== 'canceled' && event.error !== 'interrupted') {
          console.error('Speech synthesis error:', event.error);
        }
        setState((prev) => ({ ...prev, isSpeaking: false, isPaused: false }));
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [state.isSupported, rate, pitch, volume, getVoice]
  );

  const pause = useCallback(() => {
    if (state.isSupported && state.isSpeaking) {
      window.speechSynthesis.pause();
      setState((prev) => ({ ...prev, isPaused: true }));
    }
  }, [state.isSupported, state.isSpeaking]);

  const resume = useCallback(() => {
    if (state.isSupported && state.isPaused) {
      window.speechSynthesis.resume();
      setState((prev) => ({ ...prev, isPaused: false }));
    }
  }, [state.isSupported, state.isPaused]);

  const cancel = useCallback(() => {
    if (state.isSupported) {
      window.speechSynthesis.cancel();
      setState((prev) => ({ ...prev, isSpeaking: false, isPaused: false }));
    }
  }, [state.isSupported]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  return {
    ...state,
    voices,
    speak,
    pause,
    resume,
    cancel,
  };
}
