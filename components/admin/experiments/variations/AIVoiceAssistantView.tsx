'use client';

import { useCallback, useState } from 'react';
import { Recipe } from '@/lib/types';
import { useRealtimeVoice } from '@/lib/hooks/useRealtimeVoice';
import { useTimerStore } from '@/lib/stores/timerStore';
import { parseTimeString } from '@/lib/parseTimeString';

interface AIVoiceAssistantViewProps {
  recipe: Recipe;
  activeStep: number;
  completedSteps: number[];
  checkedIngredients: number[];
  onStepChange: (step: number) => void;
  onStepComplete: (step: number) => void;
}

export function AIVoiceAssistantView({
  recipe,
  activeStep,
  completedSteps,
  onStepChange,
  onStepComplete,
}: AIVoiceAssistantViewProps) {
  const { startTimer } = useTimerStore();
  const [showTranscript, setShowTranscript] = useState(true);

  const currentInstruction = recipe.instructions.find((i) => i.step === activeStep);
  const totalSteps = recipe.instructions.length;
  const isCompleted = completedSteps.includes(activeStep);

  // Timer handler for AI function calls
  const handleTimerStart = useCallback(
    (label: string, seconds: number) => {
      startTimer(activeStep, 0, label, seconds);
    },
    [activeStep, startTimer]
  );

  // Initialize realtime voice hook
  const {
    connectionStatus,
    isListening,
    isSpeaking,
    transcript,
    assistantMessage,
    error,
    connect,
    disconnect,
    interruptAssistant,
  } = useRealtimeVoice({
    recipe,
    activeStep,
    completedSteps,
    onNavigate: onStepChange,
    onStepComplete,
    onTimerStart: handleTimerStart,
  });

  // Handle clicking on time measurements to start timers
  const handleTimeClick = (timeStr: string) => {
    const seconds = parseTimeString(timeStr);
    if (seconds && seconds > 0) {
      startTimer(activeStep, 0, timeStr, seconds);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white">
      {/* AI Status Bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Connection button */}
            {connectionStatus === 'disconnected' || connectionStatus === 'error' ? (
              <button
                onClick={connect}
                className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 rounded-full text-white font-medium transition-colors"
              >
                <MicrophoneIcon className="w-5 h-5" />
                Start AI Assistant
              </button>
            ) : connectionStatus === 'connecting' ? (
              <button
                disabled
                className="flex items-center gap-2 px-5 py-2.5 bg-yellow-600 rounded-full text-white font-medium"
              >
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                Connecting...
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-red-600 rounded-full text-white font-medium transition-colors group"
              >
                <span className="w-2 h-2 rounded-full bg-green-400 group-hover:bg-red-400" />
                <span className="group-hover:hidden">Connected</span>
                <span className="hidden group-hover:inline">Disconnect</span>
              </button>
            )}

            {/* Listening/Speaking indicators */}
            {connectionStatus === 'connected' && (
              <div className="flex items-center gap-3">
                {isListening && (
                  <div className="flex items-center gap-2 text-green-400">
                    <div className="flex gap-0.5">
                      <span className="w-1 h-3 bg-green-400 rounded-full animate-pulse" />
                      <span
                        className="w-1 h-4 bg-green-400 rounded-full animate-pulse"
                        style={{ animationDelay: '75ms' }}
                      />
                      <span
                        className="w-1 h-3 bg-green-400 rounded-full animate-pulse"
                        style={{ animationDelay: '150ms' }}
                      />
                    </div>
                    <span className="text-sm">Listening</span>
                  </div>
                )}
                {isSpeaking && (
                  <div className="flex items-center gap-2 text-violet-400">
                    <div className="flex gap-0.5 items-end">
                      <span
                        className="w-1 bg-violet-400 rounded-full animate-pulse"
                        style={{ height: '12px', animationDuration: '300ms' }}
                      />
                      <span
                        className="w-1 bg-violet-400 rounded-full animate-pulse"
                        style={{ height: '16px', animationDuration: '400ms', animationDelay: '75ms' }}
                      />
                      <span
                        className="w-1 bg-violet-400 rounded-full animate-pulse"
                        style={{ height: '10px', animationDuration: '350ms', animationDelay: '150ms' }}
                      />
                    </div>
                    <span className="text-sm">Speaking</span>
                    <button
                      onClick={interruptAssistant}
                      className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-0.5 bg-zinc-800 rounded"
                    >
                      Interrupt
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Transcript toggle */}
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={showTranscript}
              onChange={(e) => setShowTranscript(e.target.checked)}
              className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-violet-500 focus:ring-violet-500"
            />
            Show transcript
          </label>
        </div>

        {/* Error display */}
        {error && (
          <div className="mt-3 p-3 bg-red-600/20 border border-red-600/30 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Transcript panel */}
        {showTranscript && connectionStatus === 'connected' && (transcript || assistantMessage) && (
          <div className="mt-3 p-3 bg-zinc-800/50 rounded-lg max-h-32 overflow-y-auto">
            {transcript && (
              <div className="text-sm">
                <span className="text-zinc-500 font-medium">You:</span>{' '}
                <span className="text-zinc-300">{transcript}</span>
              </div>
            )}
            {assistantMessage && (
              <div className="text-sm mt-2">
                <span className="text-violet-400 font-medium">Assistant:</span>{' '}
                <span className="text-zinc-300">{assistantMessage}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Suggested prompts (when connected but idle) */}
      {connectionStatus === 'connected' && !isSpeaking && !transcript && (
        <div className="bg-zinc-900/50 border-b border-zinc-800 px-4 py-3">
          <div className="text-xs text-zinc-500 mb-2">Try saying:</div>
          <div className="flex flex-wrap gap-2">
            {[
              'Read the current step',
              'What ingredients do I need?',
              'Go to next step',
              'Set a 5 minute timer',
              "I'm done with this step",
            ].map((prompt) => (
              <span
                key={prompt}
                className="px-3 py-1.5 bg-zinc-800 text-zinc-400 rounded-full text-xs"
              >
                "{prompt}"
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Not connected prompt */}
      {connectionStatus === 'disconnected' && (
        <div className="bg-violet-600/10 border-b border-violet-600/20 px-4 py-3">
          <div className="flex items-center gap-3 text-violet-300">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-sm">
              Click "Start AI Assistant" to enable voice control. You can ask questions, navigate
              steps, and set timers hands-free.
            </span>
          </div>
        </div>
      )}

      {/* Main Content - Large step display */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 overflow-auto">
        {/* Step Counter */}
        <div className="text-zinc-500 text-xl mb-4">
          Step {activeStep} of {totalSteps}
          {isCompleted && <span className="ml-2 text-green-400">(Completed)</span>}
        </div>

        {/* Current Step - Large Display */}
        {currentInstruction && (
          <p className="text-3xl md:text-4xl lg:text-5xl font-medium text-center leading-relaxed max-w-4xl">
            {currentInstruction.text}
          </p>
        )}

        {/* Measurements */}
        {currentInstruction?.measurements && (
          <div className="flex flex-wrap gap-4 mt-8 justify-center">
            {currentInstruction.measurements.temperatures?.map((temp, idx) => (
              <span
                key={`temp-${idx}`}
                className="px-6 py-3 bg-red-600/20 text-red-400 rounded-full text-2xl font-medium"
              >
                {temp}
              </span>
            ))}
            {currentInstruction.measurements.times?.map((time, idx) => (
              <button
                key={`time-${idx}`}
                onClick={() => handleTimeClick(time)}
                className="px-6 py-3 bg-teal-600/20 text-teal-400 rounded-full text-2xl font-medium hover:bg-teal-600/30 transition-colors"
                title="Click to start timer"
              >
                {time}
              </button>
            ))}
          </div>
        )}

        {/* Step ingredients if available */}
        {currentInstruction?.keywords?.ingredients &&
          currentInstruction.keywords.ingredients.length > 0 && (
            <div className="mt-8 p-4 bg-zinc-900/50 rounded-lg max-w-2xl">
              <div className="text-sm text-zinc-500 mb-2">Ingredients for this step:</div>
              <div className="flex flex-wrap gap-2">
                {currentInstruction.keywords.ingredients.map((ing, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded-full text-sm"
                  >
                    {ing.quantity} {ing.unit} {ing.item}
                  </span>
                ))}
              </div>
            </div>
          )}
      </div>

      {/* Navigation Controls (fallback for manual control) */}
      <div className="p-4 border-t border-zinc-800">
        <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => onStepChange(Math.max(1, activeStep - 1))}
            disabled={activeStep <= 1}
            className="py-5 bg-zinc-800 text-zinc-300 rounded-xl text-lg font-medium hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>

          <button
            onClick={() => onStepComplete(activeStep)}
            className={`py-5 rounded-xl text-lg font-medium transition-colors ${
              isCompleted
                ? 'bg-green-600 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {isCompleted ? 'Done' : 'Mark Done'}
          </button>

          <button
            onClick={() => onStepChange(Math.min(totalSteps, activeStep + 1))}
            disabled={activeStep >= totalSteps}
            className="py-5 bg-violet-600 text-white rounded-xl text-lg font-medium hover:bg-violet-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

// Microphone icon component
function MicrophoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}
