import Link from 'next/link';

export const metadata = {
  title: 'Dinner Party Planner',
  description: 'Plan and manage dinner party events',
};

export default function DinnerPartyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <nav className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-6">
              <Link
                href="/dinner-party"
                className="text-lg font-semibold text-zinc-100 hover:text-zinc-300"
              >
                Dinner Party
              </Link>
              <Link
                href="/dinner-party/new"
                className="text-sm text-zinc-400 hover:text-violet-400"
              >
                New Event
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/admin"
                className="text-sm text-zinc-400 hover:text-zinc-300"
              >
                Back to Admin
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
