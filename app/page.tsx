'use client';

import { RecipeGenerator } from './generate/page';

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl px-4">
        <RecipeGenerator embedded rotatingPlaceholders />
      </div>
    </div>
  );
}
