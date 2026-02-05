'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Settings, X, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import {
  useFeatureFlagsStore,
  featureFlagDefinitions,
  pageFlagDefinitions,
  type FeatureFlags,
  type PageSpecificFlags,
} from '@/lib/stores/featureFlags';

export function DevFeatureFlagsFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [globalExpanded, setGlobalExpanded] = useState(true);
  const [pageExpanded, setPageExpanded] = useState(true);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  const { flags, pageFlags, setFlag, setPageFlag, resetFlags, resetPageFlags } = useFeatureFlagsStore();

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  // Get page-specific flags for current page
  const currentPageFlags = Object.entries(pageFlagDefinitions).filter(
    ([, def]) => pathname.startsWith(def.page)
  );

  const hasPageFlags = currentPageFlags.length > 0;

  if (!mounted) {
    return null;
  }

  return (
    <>
      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 w-12 h-12 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        title="Feature Flags"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 w-80 max-h-[70vh] overflow-y-auto bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl">
          {/* Header */}
          <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-violet-400" />
              <span className="font-semibold text-white">Feature Flags</span>
            </div>
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">DEV</span>
          </div>

          {/* Page-Specific Flags */}
          {hasPageFlags && (
            <div className="border-b border-zinc-700">
              <button
                onClick={() => setPageExpanded(!pageExpanded)}
                className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-zinc-800/50"
              >
                <span className="text-sm font-medium text-violet-400">Page Flags</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">{pathname}</span>
                  {pageExpanded ? (
                    <ChevronUp className="w-4 h-4 text-zinc-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-500" />
                  )}
                </div>
              </button>

              {pageExpanded && (
                <div className="px-4 pb-3 space-y-3">
                  {currentPageFlags.map(([key, def]) => {
                    const flagKey = key as keyof PageSpecificFlags;
                    const currentValue = pageFlags[flagKey];

                    if (def.options) {
                      return (
                        <div key={key}>
                          <label className="block text-sm text-white mb-1">{def.label}</label>
                          <p className="text-xs text-zinc-500 mb-2">{def.description}</p>
                          <select
                            value={currentValue as string}
                            onChange={(e) => setPageFlag(flagKey, e.target.value as PageSpecificFlags[typeof flagKey])}
                            className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
                          >
                            {def.options.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {def.options.find(o => o.value === currentValue)?.description && (
                            <p className="text-xs text-zinc-400 mt-1 italic">
                              {def.options.find(o => o.value === currentValue)?.description}
                            </p>
                          )}
                        </div>
                      );
                    }

                    return null;
                  })}
                  <button
                    onClick={resetPageFlags}
                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset page flags
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Global Flags */}
          <div>
            <button
              onClick={() => setGlobalExpanded(!globalExpanded)}
              className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-zinc-800/50"
            >
              <span className="text-sm font-medium text-zinc-300">Global Flags</span>
              {globalExpanded ? (
                <ChevronUp className="w-4 h-4 text-zinc-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-zinc-500" />
              )}
            </button>

            {globalExpanded && (
              <div className="px-4 pb-3 space-y-3">
                {Object.entries(featureFlagDefinitions).map(([key, def]) => {
                  const flagKey = key as keyof FeatureFlags;
                  const isEnabled = flags[flagKey];

                  return (
                    <label
                      key={key}
                      className="flex items-start gap-3 cursor-pointer group"
                    >
                      <div className="relative mt-0.5">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => setFlag(flagKey, e.target.checked)}
                          className="sr-only"
                        />
                        <div
                          className={`w-9 h-5 rounded-full transition-colors ${
                            isEnabled ? 'bg-violet-600' : 'bg-zinc-700'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white shadow transition-transform absolute top-0.5 ${
                              isEnabled ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <span className="text-sm text-white group-hover:text-violet-300 transition-colors">
                          {def.label}
                        </span>
                        <p className="text-xs text-zinc-500">{def.description}</p>
                      </div>
                    </label>
                  );
                })}
                <button
                  onClick={resetFlags}
                  className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset global flags
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
