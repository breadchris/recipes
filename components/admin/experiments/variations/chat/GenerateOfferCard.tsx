'use client';

import { GenerateOffer } from '@/lib/types/recipe-chat';

interface GenerateOfferCardProps {
  offer: GenerateOffer;
  onGenerate: (title: string) => void;
  isGenerating: boolean;
}

export function GenerateOfferCard({ offer, onGenerate, isGenerating }: GenerateOfferCardProps) {
  return (
    <div className="bg-violet-600/10 border border-violet-600/30 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-violet-600/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm text-zinc-300 mb-3">
            {offer.reason || `I couldn't find many recipes for "${offer.title}".`} Would you like me to generate a custom recipe?
          </p>
          <button
            onClick={() => {
              console.log('[GenerateOfferCard] Button clicked', { title: offer.title });
              onGenerate(offer.title);
            }}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-600/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            {isGenerating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Generate "{offer.title}"
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
