import Link from 'next/link';

export const metadata = {
  title: 'Random Dan - Recipes',
  description: 'Watch random sections from What\'s Eating Dan videos',
};

export default function RandomDanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link
                href="/random-dan"
                className="text-lg font-semibold text-zinc-100 hover:text-zinc-300"
              >
                Random Dan
              </Link>
              <Link
                href="/"
                className="text-sm text-zinc-400 hover:text-zinc-300"
              >
                Back to Recipes
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}
