import { Suspense } from 'react';
import { SearchPage } from './search-page';

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white dark:bg-black" />}>
      <SearchPage />
    </Suspense>
  );
}
