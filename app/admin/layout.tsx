import { notFound } from 'next/navigation';
import Link from 'next/link';

export const metadata = {
  title: 'Admin - Recipes',
  description: 'Recipe administration panel (development only)',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Exclude admin panel from production builds
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link
                href="/admin"
                className="text-lg font-semibold text-zinc-100 hover:text-zinc-300"
              >
                Admin
              </Link>
              <Link
                href="/admin/generate"
                className="text-sm text-zinc-400 hover:text-violet-400"
              >
                Generate
              </Link>
              <Link
                href="/admin/batch"
                className="text-sm text-zinc-400 hover:text-violet-400"
              >
                Batch
              </Link>
              <Link
                href="/admin/recipe-types"
                className="text-sm text-zinc-400 hover:text-violet-400"
              >
                Recipe Types
              </Link>
              <Link
                href="/admin/scraped"
                className="text-sm text-zinc-400 hover:text-violet-400"
              >
                Scraped
              </Link>
              <Link
                href="/admin/nutrition"
                className="text-sm text-zinc-400 hover:text-violet-400"
              >
                Nutrition
              </Link>
              <Link
                href="/admin/components"
                className="text-sm text-zinc-400 hover:text-violet-400"
              >
                Components
              </Link>
              <Link
                href="/random-dan"
                className="text-sm text-zinc-400 hover:text-violet-400"
              >
                Random Dan
              </Link>
              <Link
                href="/dinner-party"
                className="text-sm text-zinc-400 hover:text-violet-400"
              >
                Dinner Party
              </Link>
              <Link
                href="/"
                className="text-sm text-zinc-400 hover:text-zinc-300"
              >
                Back to Site
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs px-2 py-1 bg-amber-500/20 text-amber-400 rounded">
                DEV ONLY
              </span>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
