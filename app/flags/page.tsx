'use client';

import Link from 'next/link';
import { useFeatureFlagsStore, featureFlagDefinitions, type FeatureFlags } from '@/lib/stores/featureFlags';

export default function FlagsPage() {
  const { flags, setFlag } = useFeatureFlagsStore();

  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Feature Flags</h1>
          <Link
            href="/"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"
          >
            Back to Home
          </Link>
        </div>

        <div className="space-y-4">
          {(Object.keys(featureFlagDefinitions) as Array<keyof FeatureFlags>).map((key) => {
            const definition = featureFlagDefinitions[key];
            const isEnabled = flags[key];

            return (
              <div
                key={key}
                className="flex items-center justify-between p-4 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
              >
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-50">{definition.label}</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{definition.description}</p>
                </div>
                <button
                  onClick={() => setFlag(key, !isEnabled)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    isEnabled ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      isEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-xs text-zinc-500 dark:text-zinc-500">
          Feature flags are saved to your browser&apos;s local storage.
        </p>
      </div>
    </div>
  );
}
