'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Recipe } from '@/lib/types';

// Types
export interface RealtimeVoiceState {
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  assistantMessage: string;
  error: string | null;
}

interface RealtimeEvent {
  type: string;
  delta?: string;
  transcript?: string;
  name?: string;
  arguments?: string;
  call_id?: string;
  response_id?: string;
  item_id?: string;
  output_index?: number;
  content_index?: number;
  event_id?: string;
}

interface UseRealtimeVoiceOptions {
  recipe: Recipe;
  activeStep: number;
  completedSteps: number[];
  onNavigate?: (step: number) => void;
  onStepComplete?: (step: number) => void;
  onTimerStart?: (label: string, seconds: number) => void;
}

export function useRealtimeVoice(options: UseRealtimeVoiceOptions) {
  const { recipe, activeStep, completedSteps, onNavigate, onStepComplete, onTimerStart } = options;

  const [state, setState] = useState<RealtimeVoiceState>({
    connectionStatus: 'disconnected',
    isListening: false,
    isSpeaking: false,
    transcript: '',
    assistantMessage: '',
    error: null,
  });

  // WebRTC refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Callback refs to avoid stale closures
  const onNavigateRef = useRef(onNavigate);
  const onStepCompleteRef = useRef(onStepComplete);
  const onTimerStartRef = useRef(onTimerStart);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
    onStepCompleteRef.current = onStepComplete;
    onTimerStartRef.current = onTimerStart;
  }, [onNavigate, onStepComplete, onTimerStart]);

  // Send function result back to the AI
  const sendFunctionResult = useCallback((callId: string, result: unknown) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;

    dataChannelRef.current.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify(result),
        },
      })
    );

    // Trigger a response after function result
    dataChannelRef.current.send(
      JSON.stringify({
        type: 'response.create',
      })
    );
  }, []);

  // Handle AI function calls
  const handleFunctionCall = useCallback(
    (name: string, args: Record<string, unknown>, callId: string) => {
      switch (name) {
        case 'navigate_to_step':
          onNavigateRef.current?.(args.step as number);
          sendFunctionResult(callId, { success: true, navigatedTo: args.step });
          break;
        case 'mark_step_complete':
          onStepCompleteRef.current?.(args.step as number);
          sendFunctionResult(callId, { success: true, completedStep: args.step });
          break;
        case 'start_timer':
          onTimerStartRef.current?.(args.label as string, args.seconds as number);
          sendFunctionResult(callId, { success: true, timerStarted: args.label });
          break;
        case 'read_ingredients':
          // The AI will read ingredients from its context
          sendFunctionResult(callId, { success: true });
          break;
        default:
          sendFunctionResult(callId, { success: false, error: 'Unknown function' });
      }
    },
    [sendFunctionResult]
  );

  // Handle incoming Realtime API events
  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      switch (event.type) {
        case 'session.created':
        case 'session.updated':
          // Session is ready
          break;

        case 'response.audio_transcript.delta':
          setState((prev) => ({
            ...prev,
            assistantMessage: prev.assistantMessage + (event.delta || ''),
            isSpeaking: true,
          }));
          break;

        case 'response.audio_transcript.done':
          // Keep the message but mark speaking done
          break;

        case 'response.done':
          setState((prev) => ({ ...prev, isSpeaking: false }));
          break;

        case 'input_audio_buffer.speech_started':
          setState((prev) => ({ ...prev, isListening: true, transcript: '' }));
          break;

        case 'input_audio_buffer.speech_stopped':
          setState((prev) => ({ ...prev, isListening: false }));
          break;

        case 'conversation.item.input_audio_transcription.completed':
          setState((prev) => ({
            ...prev,
            transcript: event.transcript || '',
            assistantMessage: '', // Clear previous assistant message for new turn
          }));
          break;

        case 'response.function_call_arguments.done':
          if (event.name && event.arguments && event.call_id) {
            try {
              const args = JSON.parse(event.arguments);
              handleFunctionCall(event.name, args, event.call_id);
            } catch {
              console.error('Failed to parse function arguments');
            }
          }
          break;

        case 'error':
          console.error('Realtime API error:', event);
          setState((prev) => ({
            ...prev,
            error: 'An error occurred with the voice assistant',
          }));
          break;
      }
    },
    [handleFunctionCall]
  );

  // Build context for session update
  const buildContextMessage = useCallback(() => {
    const currentInstruction = recipe.instructions.find((i) => i.step === activeStep);
    return `The user is now on Step ${activeStep}: "${currentInstruction?.text || 'Unknown step'}".
Completed steps: ${completedSteps.length > 0 ? completedSteps.join(', ') : 'None yet'}.
Total steps: ${recipe.instructions.length}.`;
  }, [recipe, activeStep, completedSteps]);

  // Send context update when step changes
  const sendContextUpdate = useCallback(() => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;

    // Send a system message with updated context
    dataChannelRef.current.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: `[System: ${buildContextMessage()}]`,
            },
          ],
        },
      })
    );
  }, [buildContextMessage]);

  // Update context when step changes
  useEffect(() => {
    if (state.connectionStatus === 'connected') {
      sendContextUpdate();
    }
  }, [activeStep, completedSteps, state.connectionStatus, sendContextUpdate]);

  // Connect function
  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, connectionStatus: 'connecting', error: null }));

    try {
      // 1. Get ephemeral token from our API
      const tokenResponse = await fetch('/api/realtime-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipeContext: {
            title: recipe.title,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions.map((i) => ({ step: i.step, text: i.text })),
            currentStep: activeStep,
            completedSteps,
            prepTime: recipe.prep_time_minutes,
            cookTime: recipe.cook_time_minutes,
            tips: recipe.tips,
          },
        }),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json();
        throw new Error(error.error || 'Failed to get session token');
      }

      const { ephemeralToken } = await tokenResponse.json();

      if (!ephemeralToken) {
        throw new Error('No ephemeral token received');
      }

      // 2. Create RTCPeerConnection
      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      // 3. Set up audio element for AI responses
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioElementRef.current = audioEl;

      pc.ontrack = (event) => {
        audioEl.srcObject = event.streams[0];
      };

      // 4. Get user's microphone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 24000,
        },
      });
      mediaStreamRef.current = stream;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // 5. Set up data channel for events
      const dc = pc.createDataChannel('oai-events');
      dataChannelRef.current = dc;

      dc.onopen = () => {
        setState((prev) => ({
          ...prev,
          connectionStatus: 'connected',
          isListening: true,
        }));
      };

      dc.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleRealtimeEvent(data);
        } catch {
          console.error('Failed to parse realtime event');
        }
      };

      dc.onerror = (error) => {
        console.error('Data channel error:', error);
        setState((prev) => ({
          ...prev,
          error: 'Connection error',
          connectionStatus: 'error',
        }));
      };

      dc.onclose = () => {
        setState((prev) => ({
          ...prev,
          connectionStatus: 'disconnected',
          isListening: false,
        }));
      };

      // 6. Create offer and connect to OpenAI
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(
        'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ephemeralToken}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        }
      );

      if (!sdpResponse.ok) {
        throw new Error('Failed to connect to OpenAI Realtime API');
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setState((prev) => ({
            ...prev,
            connectionStatus: 'error',
            error: 'Connection lost',
          }));
        }
      };
    } catch (error) {
      console.error('Connection error:', error);
      setState((prev) => ({
        ...prev,
        connectionStatus: 'error',
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  }, [recipe, activeStep, completedSteps, handleRealtimeEvent]);

  // Disconnect function
  const disconnect = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    if (audioElementRef.current) {
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }

    setState({
      connectionStatus: 'disconnected',
      isListening: false,
      isSpeaking: false,
      transcript: '',
      assistantMessage: '',
      error: null,
    });
  }, []);

  // Send text message (for hybrid text/voice interaction)
  const sendTextMessage = useCallback((text: string) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;

    dataChannelRef.current.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text }],
        },
      })
    );

    dataChannelRef.current.send(
      JSON.stringify({
        type: 'response.create',
      })
    );
  }, []);

  // Interrupt the assistant's response
  const interruptAssistant = useCallback(() => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') return;

    dataChannelRef.current.send(
      JSON.stringify({
        type: 'response.cancel',
      })
    );

    setState((prev) => ({ ...prev, isSpeaking: false }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    sendTextMessage,
    interruptAssistant,
  };
}
