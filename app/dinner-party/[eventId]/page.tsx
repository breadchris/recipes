'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { DinnerPartyEvent, DinnerPartyGuest } from '@/lib/types/dinner-party';
import { getGuestStatusSummary, formatPhoneNumber } from '@/lib/types/dinner-party';

interface PageProps {
  params: Promise<{ eventId: string }>;
}

export default function EventPage({ params }: PageProps) {
  const { eventId } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<DinnerPartyEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    sent: number;
    failed: number;
  } | null>(null);

  useEffect(() => {
    fetchEvent();
  }, [eventId]);

  async function fetchEvent() {
    try {
      const res = await fetch(`/api/dinner-party/${eventId}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch event');
      }

      setEvent(data.event);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch event');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendInvites() {
    setSendingInvites(true);
    setInviteResult(null);

    try {
      const res = await fetch(`/api/dinner-party/${eventId}/send-invites`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send invites');
      }

      setInviteResult({ sent: data.sent, failed: data.failed });
      // Refresh event data
      await fetchEvent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invites');
    } finally {
      setSendingInvites(false);
    }
  }

  async function handleDeleteEvent() {
    if (!confirm('Are you sure you want to delete this event?')) return;

    try {
      const res = await fetch(`/api/dinner-party/${eventId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete event');
      }

      router.push('/dinner-party');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
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
          onClick={fetchEvent}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-zinc-400">Event not found</p>
        <Link href="/dinner-party" className="text-violet-400 hover:underline">
          Back to events
        </Link>
      </div>
    );
  }

  const summary = getGuestStatusSummary(event.guests || []);
  const pendingCount = summary.pending + summary.invited;
  const eventDate = new Date(event.metadata.event_date);

  // Get dietary constraints from confirmed guests
  const dietaryConstraints = (event.guests || [])
    .filter(
      (g) =>
        ['yes', 'constraints_captured'].includes(g.metadata.status) &&
        g.metadata.dietary_constraints
    )
    .map((g) => ({
      name: g.metadata.name || formatPhoneNumber(g.metadata.phone_number),
      constraint: g.metadata.dietary_constraints!,
    }));

  // Generate Uber Eats link
  const uberEatsUrl = `https://www.ubereats.com/search?q=${encodeURIComponent(
    event.metadata.food_default
  )}`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">
            {event.metadata.event_name}
          </h1>
          <p className="text-zinc-400">
            {eventDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}{' '}
            at {event.metadata.time_window}
          </p>
          <p className="text-zinc-500 text-sm mt-1">
            Food: {event.metadata.food_default}
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/party/${eventId}`}
            target="_blank"
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm"
          >
            View Party Page
          </a>
          <button
            onClick={handleDeleteEvent}
            className="px-3 py-2 bg-red-900 hover:bg-red-800 rounded text-sm"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 text-center">
          <div className="text-2xl font-bold text-green-400">
            {summary.confirmed}
          </div>
          <div className="text-sm text-zinc-500">Confirmed</div>
        </div>
        <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 text-center">
          <div className="text-2xl font-bold text-yellow-400">
            {summary.invited}
          </div>
          <div className="text-sm text-zinc-500">Invited</div>
        </div>
        <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 text-center">
          <div className="text-2xl font-bold text-zinc-400">
            {summary.pending}
          </div>
          <div className="text-sm text-zinc-500">Pending</div>
        </div>
        <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800 text-center">
          <div className="text-2xl font-bold text-red-400">
            {summary.declined}
          </div>
          <div className="text-sm text-zinc-500">Declined</div>
        </div>
      </div>

      {/* Send Invites */}
      {summary.pending > 0 && (
        <div className="mb-8 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Send Invites</h3>
              <p className="text-sm text-zinc-500">
                {summary.pending} guest(s) haven't been invited yet
              </p>
            </div>
            <button
              onClick={handleSendInvites}
              disabled={sendingInvites}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:bg-violet-800 disabled:cursor-not-allowed rounded font-medium"
            >
              {sendingInvites ? 'Sending...' : 'Send Invites'}
            </button>
          </div>
          {inviteResult && (
            <div className="mt-3 text-sm">
              <span className="text-green-400">{inviteResult.sent} sent</span>
              {inviteResult.failed > 0 && (
                <span className="text-red-400 ml-3">
                  {inviteResult.failed} failed
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Dietary Constraints */}
      {dietaryConstraints.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Dietary Restrictions</h2>
          <div className="p-4 bg-zinc-900 rounded-lg border border-zinc-800">
            <ul className="space-y-2">
              {dietaryConstraints.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-zinc-400">{item.name}:</span>
                  <span className="text-red-300">{item.constraint}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Food Ordering */}
      {summary.confirmed >= 4 && (
        <div className="mb-8 p-4 bg-green-900/20 rounded-lg border border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-green-300">Ready to Order!</h3>
              <p className="text-sm text-zinc-400">
                {summary.confirmed} confirmed guests - time to order{' '}
                {event.metadata.food_default}
              </p>
            </div>
            <a
              href={uberEatsUrl}
              target="_blank"
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-medium"
            >
              Order on Uber Eats
            </a>
          </div>
        </div>
      )}

      {/* Guest List */}
      <div>
        <h2 className="text-lg font-semibold mb-4">
          Guests ({summary.total})
        </h2>
        <div className="space-y-2">
          {(event.guests || []).map((guest) => (
            <GuestRow key={guest.id} guest={guest} />
          ))}
        </div>
      </div>
    </div>
  );
}

function GuestRow({ guest }: { guest: DinnerPartyGuest }) {
  const [expanded, setExpanded] = useState(false);
  const statusIcons: Record<string, { icon: string; color: string }> = {
    pending: { icon: '○', color: 'text-zinc-500' },
    invited: { icon: '◐', color: 'text-yellow-400' },
    yes: { icon: '●', color: 'text-green-400' },
    constraints_captured: { icon: '✓', color: 'text-green-400' },
    no: { icon: '✗', color: 'text-red-400' },
  };

  const status = statusIcons[guest.metadata.status] || statusIcons.pending;

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-800/50"
      >
        <div className="flex items-center gap-3">
          <span className={`text-lg ${status.color}`}>{status.icon}</span>
          <div>
            <div className="font-medium">
              {guest.metadata.name ||
                formatPhoneNumber(guest.metadata.phone_number)}
            </div>
            {guest.metadata.name && (
              <div className="text-sm text-zinc-500">
                {formatPhoneNumber(guest.metadata.phone_number)}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500 capitalize">
            {guest.metadata.status.replace('_', ' ')}
          </span>
          <span className="text-zinc-600">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && guest.metadata.sms_thread.length > 0 && (
        <div className="px-4 pb-4 border-t border-zinc-800">
          <div className="pt-4 space-y-2">
            {guest.metadata.sms_thread.map((msg, i) => (
              <div
                key={i}
                className={`p-2 rounded text-sm ${
                  msg.direction === 'outbound'
                    ? 'bg-violet-900/30 ml-8'
                    : 'bg-zinc-800 mr-8'
                }`}
              >
                <div className="text-zinc-300">{msg.text}</div>
                <div className="text-xs text-zinc-600 mt-1">
                  {new Date(msg.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
