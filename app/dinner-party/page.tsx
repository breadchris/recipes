'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { DinnerPartyEvent } from '@/lib/types/dinner-party';
import { getGuestStatusSummary, formatPhoneNumber } from '@/lib/types/dinner-party';

export default function DinnerPartyDashboard() {
  const [events, setEvents] = useState<DinnerPartyEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  async function fetchEvents() {
    try {
      const res = await fetch('/api/dinner-party');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch events');
      }

      setEvents(data.events || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={fetchEvents}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Your Events</h1>
        <Link
          href="/dinner-party/new"
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded text-sm font-medium"
        >
          New Event
        </Link>
      </div>

      {events.length === 0 ? (
        <div className="text-center py-12 bg-zinc-900 rounded-lg border border-zinc-800">
          <p className="text-zinc-400 mb-4">No dinner parties yet</p>
          <Link
            href="/dinner-party/new"
            className="text-violet-400 hover:text-violet-300"
          >
            Create your first event
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({ event }: { event: DinnerPartyEvent }) {
  const summary = getGuestStatusSummary(event.guests || []);
  const eventDate = new Date(event.metadata.event_date);
  const isUpcoming = eventDate >= new Date();

  const statusColors = {
    draft: 'bg-zinc-600',
    invited: 'bg-yellow-600',
    confirmed: 'bg-green-600',
    completed: 'bg-zinc-500',
  };

  return (
    <Link
      href={`/dinner-party/${event.id}`}
      className="block p-6 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">
            {event.metadata.event_name}
          </h2>
          <p className="text-zinc-400 text-sm">
            {eventDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}{' '}
            at {event.metadata.time_window}
          </p>
        </div>
        <span
          className={`px-2 py-1 text-xs rounded ${
            statusColors[event.metadata.status]
          }`}
        >
          {event.metadata.status}
        </span>
      </div>

      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-green-400">&#10003;</span>
          <span>{summary.confirmed} confirmed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-yellow-400">&#8987;</span>
          <span>{summary.pending + summary.invited} pending</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-red-400">&#10007;</span>
          <span>{summary.declined} declined</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-zinc-800">
        <p className="text-zinc-500 text-sm">
          Food: {event.metadata.food_default}
        </p>
      </div>
    </Link>
  );
}
