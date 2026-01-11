'use client';

import { useState } from 'react';
import type { RecipeVersionInfo } from '@/lib/types/admin';
import { DEFAULT_RECIPE_PROMPT } from '@/lib/admin/openai/default-prompt';

interface VersionControlPanelProps {
  versionInfo: RecipeVersionInfo;
  availableVersions: number[];
  onVersionChange: (version: number) => void;
  onRegenerate: (prompt: string) => Promise<void>;
  isRegenerating: boolean;
  onRegenerate2Stage?: (prompt: string) => Promise<void>;
  isRegenerating2Stage?: boolean;
}

export function VersionControlPanel({
  versionInfo,
  availableVersions,
  onVersionChange,
  onRegenerate,
  isRegenerating,
  onRegenerate2Stage,
  isRegenerating2Stage = false,
}: VersionControlPanelProps) {
  const [showPrompt, setShowPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(DEFAULT_RECIPE_PROMPT);

  const handleVersionChange = (version: number) => {
    onVersionChange(version);
  };

  const handlePromptReset = () => {
    setEditedPrompt(DEFAULT_RECIPE_PROMPT);
  };

  const handleRegenerate = async () => {
    await onRegenerate(editedPrompt);
  };

  const handleRegenerate2Stage = async () => {
    if (onRegenerate2Stage) {
      await onRegenerate2Stage(editedPrompt);
    }
  };

  const isAnyRegenerating = isRegenerating || isRegenerating2Stage;
  const isPromptModified = editedPrompt !== DEFAULT_RECIPE_PROMPT;

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-zinc-800 border-b border-zinc-700">
      <div className="px-4 py-2 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500">Version:</label>
          <select
            value={versionInfo.version}
            onChange={(e) => handleVersionChange(parseInt(e.target.value))}
            disabled={isAnyRegenerating}
            className="text-sm bg-zinc-900 border border-zinc-600 rounded px-2 py-1 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          >
            {availableVersions.map((v) => (
              <option key={v} value={v}>
                v{v} {v === versionInfo.version ? '(current)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-zinc-500 flex items-center gap-2">
          <span>{formatDate(versionInfo.created_at)}</span>
          <span
            className={`px-1.5 py-0.5 rounded text-xs ${
              versionInfo.generation_type === 'regenerated-2stage'
                ? 'bg-violet-900/50 text-violet-300'
                : versionInfo.generation_type === 'regenerated'
                ? 'bg-purple-900/50 text-purple-300'
                : 'bg-zinc-700 text-zinc-400'
            }`}
          >
            {versionInfo.generation_type}
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
          >
            {showPrompt ? 'Hide Prompt' : 'Show Prompt'}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={isAnyRegenerating}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            {isRegenerating ? (
              <>
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Regenerating...
              </>
            ) : (
              'Regenerate'
            )}
          </button>
          {onRegenerate2Stage && (
            <button
              onClick={handleRegenerate2Stage}
              disabled={isAnyRegenerating}
              title="Clean transcript first, then generate recipe with section references"
              className="text-xs bg-violet-600 text-white px-3 py-1 rounded hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              {isRegenerating2Stage ? (
                <>
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  2-Stage...
                </>
              ) : (
                '2-Stage'
              )}
            </button>
          )}
        </div>
      </div>

      {showPrompt && (
        <div className="px-4 pb-3 border-t border-zinc-700 bg-zinc-900">
          <div className="flex items-center justify-between py-2">
            <span className="text-xs font-medium text-zinc-300">
              AI Prompt Template
              {isPromptModified && <span className="ml-2 text-amber-400">(modified)</span>}
            </span>
            {isPromptModified && (
              <button onClick={handlePromptReset} className="text-xs text-zinc-500 hover:text-zinc-300">
                Reset to default
              </button>
            )}
          </div>
          <textarea
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            disabled={isAnyRegenerating}
            className="w-full h-48 text-xs font-mono bg-zinc-800 border border-zinc-600 rounded p-2 text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 resize-y"
            placeholder="Enter prompt for recipe extraction..."
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-zinc-500">{editedPrompt.length} characters</span>
            <div className="text-xs text-zinc-500">
              Model: {versionInfo.model} | Temperature: {versionInfo.temperature}
            </div>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Edit the prompt above and click Regenerate. Changes are not saved permanently.
          </div>
        </div>
      )}
    </div>
  );
}
