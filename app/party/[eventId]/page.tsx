import { notFound } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/clients/supabaseServer';
import type {
  DinnerPartyEventMetadata,
  DinnerPartyGuestMetadata,
} from '@/lib/types/dinner-party';
import { formatPhoneNumber } from '@/lib/types/dinner-party';

interface PageProps {
  params: Promise<{ eventId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { eventId } = await params;
  const supabase = createServerSupabaseClient();

  const { data: event } = await supabase
    .from('content')
    .select('metadata')
    .eq('id', eventId)
    .eq('type', 'dinner-party-event')
    .single();

  if (!event) {
    return { title: 'Party Not Found' };
  }

  const metadata = event.metadata as DinnerPartyEventMetadata;
  return {
    title: metadata.event_name || 'Dinner Party',
    description: `Join us for ${metadata.food_default} on ${metadata.event_date}`,
  };
}

export default async function PartyPage({ params }: PageProps) {
  const { eventId } = await params;
  const supabase = createServerSupabaseClient();

  // Get event
  const { data: event } = await supabase
    .from('content')
    .select('*')
    .eq('id', eventId)
    .eq('type', 'dinner-party-event')
    .single();

  if (!event) {
    notFound();
  }

  const eventMetadata = event.metadata as DinnerPartyEventMetadata;

  // Get confirmed guests
  const { data: guests } = await supabase
    .from('content')
    .select('*')
    .eq('parent_content_id', eventId)
    .eq('type', 'dinner-party-guest')
    .order('created_at', { ascending: true });

  const confirmedGuests = (guests || []).filter((g) => {
    const meta = g.metadata as DinnerPartyGuestMetadata;
    return ['yes', 'constraints_captured'].includes(meta.status);
  });

  const eventDate = new Date(eventMetadata.event_date);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Generate Google Calendar link
  const calendarDate = eventMetadata.event_date.replace(/-/g, '');
  const calendarTitle = encodeURIComponent(eventMetadata.event_name);
  const calendarDetails = encodeURIComponent(
    `Food: ${eventMetadata.food_default}`
  );
  const googleCalendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${calendarTitle}&dates=${calendarDate}/${calendarDate}&details=${calendarDetails}`;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-md mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-3">
            {eventMetadata.event_name}
          </h1>
          <p className="text-zinc-400 text-lg">{formattedDate}</p>
          <p className="text-zinc-500">at {eventMetadata.time_window}</p>
        </div>

        {/* Food Info */}
        <div className="mb-10 p-4 bg-zinc-900 rounded-lg border border-zinc-800 text-center">
          <p className="text-zinc-500 text-sm mb-1">Menu</p>
          <p className="text-xl font-medium">{eventMetadata.food_default}</p>
        </div>

        {/* Guest List */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold mb-4 text-center">
            Who's Coming ({confirmedGuests.length})
          </h2>
          {confirmedGuests.length === 0 ? (
            <p className="text-center text-zinc-500">
              No confirmed guests yet
            </p>
          ) : (
            <ul className="space-y-2">
              {confirmedGuests.map((guest) => {
                const meta = guest.metadata as DinnerPartyGuestMetadata;
                return (
                  <li
                    key={guest.id}
                    className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg"
                  >
                    <span className="text-green-400 text-lg">✓</span>
                    <span>
                      {meta.name || formatPhoneNumber(meta.phone_number).slice(-4)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Add to Calendar */}
        <div className="text-center">
          <a
            href={googleCalendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg font-medium transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Add to Calendar
          </a>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-zinc-800 text-center">
          <p className="text-zinc-600 text-sm">
            See you there!
          </p>
        </div>
      </div>
    </div>
  );
}
