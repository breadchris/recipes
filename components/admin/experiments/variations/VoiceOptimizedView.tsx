'use client';

import { useCallback, useEffect, useState } from 'react';
import { Recipe } from '@/lib/types';
import { VoiceCommand } from '@/lib/types/component-lab';
import { useSpeechRecognition } from '@/lib/hooks/useSpeechRecognition';
import { useSpeechSynthesis } from '@/lib/hooks/useSpeechSynthesis';

interface VoiceOptimizedViewProps {
  recipe: Recipe;
  activeStep: number;
  completedSteps: number[];
  checkedIngredients: number[];
  onStepChange: (step: number) => void;
  onStepComplete: (step: number) => void;
}

export function VoiceOptimizedView({
  recipe,
  activeStep,
  completedSteps,
  onStepChange,
  onStepComplete,
}: VoiceOptimizedViewProps) {
  const [autoRead, setAutoRead] = useState(true);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const currentInstruction = recipe.instructions.find((i) => i.step === activeStep);
  const totalSteps = recipe.instructions.length;
  const isCompleted = completedSteps.includes(activeStep);

  // Speech synthesis for reading steps
  const {
    isSpeaking,
    isSupported: synthSupported,
    speak,
    cancel: cancelSpeech,
  } = useSpeechSynthesis({
    rate: 0.85,
    onEnd: () => {
      // Could auto-advance here if desired
    },
  });

  // Handle voice commands
  const handleCommand = useCallback(
    (command: VoiceCommand) => {
      setLastCommand(command);

      // Clear command display after 2 seconds
      setTimeout(() => setLastCommand(null), 2000);

      switch (command) {
        case 'next':
          if (activeStep < totalSteps) {
            onStepChange(activeStep + 1);
          }
          break;
        case 'previous':
          if (activeStep > 1) {
            onStepChange(activeStep - 1);
          }
          break;
        case 'repeat':
          if (currentInstruction) {
            speak(`Step ${activeStep}. ${currentInstruction.text}`);
          }
          break;
        case 'done':
          onStepComplete(activeStep);
          break;
        case 'ingredients':
          const ingredientList = recipe.ingredients
            .map((ing) => `${ing.quantity} ${ing.unit} ${ing.item}`)
            .join('. ');
          speak(`Ingredients: ${ingredientList}`);
          break;
        case 'timer':
          const times = currentInstruction?.measurements?.times;
          if (times && times.length > 0) {
            speak(`Timer: ${times[0]}`);
          } else {
            speak('No timer for this step');
          }
          break;
        case 'stop':
          cancelSpeech();
          break;
        case 'start':
          if (currentInstruction) {
            speak(`Step ${activeStep}. ${currentInstruction.text}`);
          }
          break;
      }
    },
    [activeStep, totalSteps, currentInstruction, recipe.ingredients, speak, cancelSpeech, onStepChange, onStepComplete]
  );

  // Speech recognition for voice commands
  const {
    isListening,
    isSupported: recognitionSupported,
    transcript,
    error: recognitionError,
    startListening,
    stopListening,
    toggleListening,
  } = useSpeechRecognition({
    onCommand: handleCommand,
    continuous: true,
  });

  // Auto-read step when it changes
  useEffect(() => {
    if (autoRead && currentInstruction && synthSupported) {
      speak(`Step ${activeStep}. ${currentInstruction.text}`);
    }
  }, [activeStep, autoRead, currentInstruction, synthSupported, speak]);

  const isVoiceSupported = synthSupported || recognitionSupported;

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white">
      {/* Voice Status Bar */}
      <div className="bg-zinc-900 border-b border-zinc-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Listening indicator */}
            <button
              onClick={toggleListening}
              disabled={!recognitionSupported}
              className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${
                isListening
                  ? 'bg-green-600 text-white animate-pulse'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              } ${!recognitionSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              {isListening ? 'Listening...' : 'Start Voice'}
            </button>

            {/* Speaking indicator */}
            {isSpeaking && (
              <div className="flex items-center gap-2 text-violet-400">
                <div className="flex gap-1">
                  <span className="w-1 h-4 bg-violet-400 rounded-full animate-pulse" />
                  <span className="w-1 h-4 bg-violet-400 rounded-full animate-pulse delay-100" />
                  <span className="w-1 h-4 bg-violet-400 rounded-full animate-pulse delay-200" />
                </div>
                <span className="text-sm">Speaking</span>
                <button onClick={cancelSpeech} className="text-zinc-500 hover:text-zinc-300">
                  Stop
                </button>
              </div>
            )}
          </div>

          {/* Auto-read toggle */}
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={autoRead}
              onChange={(e) => setAutoRead(e.target.checked)}
              className="w-4 h-4 rounded bg-zinc-800 border-zinc-600 text-violet-500 focus:ring-violet-500"
            />
            Auto-read steps
          </label>
        </div>

        {/* Transcript / Command feedback */}
        {(transcript || lastCommand) && (
          <div className="mt-3 p-2 bg-zinc-800 rounded-lg">
            {lastCommand && (
              <div className="text-green-400 font-medium mb-1">
                Command: {lastCommand.toUpperCase()}
              </div>
            )}
            {transcript && <div className="text-zinc-400 text-sm">{transcript}</div>}
          </div>
        )}

        {/* Error display */}
        {recognitionError && (
          <div className="mt-2 text-red-400 text-sm">{recognitionError}</div>
        )}

        {/* Not supported warning */}
        {!isVoiceSupported && (
          <div className="mt-2 p-2 bg-amber-600/20 text-amber-400 rounded-lg text-sm">
            Voice features are not supported in this browser. Try Chrome or Edge.
          </div>
        )}
      </div>

      {/* Voice Commands Help */}
      <div className="bg-zinc-900/50 border-b border-zinc-800 px-4 py-2">
        <div className="text-xs text-zinc-500 flex flex-wrap gap-3">
          <span className="text-zinc-400">Commands:</span>
          {['Next', 'Previous', 'Repeat', 'Done', 'Ingredients', 'Timer'].map((cmd) => (
            <span key={cmd} className="px-2 py-0.5 bg-zinc-800 rounded">
              {cmd}
            </span>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12">
        {/* Step Counter */}
        <div className="text-zinc-500 text-xl mb-4">
          Step {activeStep} of {totalSteps}
        </div>

        {/* Current Step - Extra Large for visibility */}
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
              <span
                key={`time-${idx}`}
                className="px-6 py-3 bg-teal-600/20 text-teal-400 rounded-full text-2xl font-medium"
              >
                {time}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Large Touch Buttons for Fallback */}
      <div className="p-4 border-t border-zinc-800">
        <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => onStepChange(Math.max(1, activeStep - 1))}
            disabled={activeStep <= 1}
            className="py-6 bg-zinc-800 text-zinc-300 rounded-xl text-xl font-medium hover:bg-zinc-700 disabled:opacity-30 transition-colors"
          >
            Previous
          </button>

          <button
            onClick={() => currentInstruction && speak(`Step ${activeStep}. ${currentInstruction.text}`)}
            disabled={!synthSupported}
            className="py-6 bg-violet-600/20 text-violet-400 rounded-xl text-xl font-medium hover:bg-violet-600/30 transition-colors disabled:opacity-30"
          >
            Read
          </button>

          <button
            onClick={() => onStepChange(Math.min(totalSteps, activeStep + 1))}
            disabled={activeStep >= totalSteps}
            className="py-6 bg-zinc-800 text-zinc-300 rounded-xl text-xl font-medium hover:bg-zinc-700 disabled:opacity-30 transition-colors"
          >
            Next
          </button>
        </div>

        <button
          onClick={() => onStepComplete(activeStep)}
          className={`w-full mt-3 py-6 rounded-xl text-xl font-medium transition-colors ${
            isCompleted
              ? 'bg-green-600 text-white'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}
        >
          {isCompleted ? '✓ Step Complete' : 'Mark as Done'}
        </button>
      </div>
    </div>
  );
}
