import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/clients/supabaseServer';
import { sendSms } from '@/lib/simpletexting';
import type {
  DinnerPartyEventMetadata,
  DinnerPartyGuestMetadata,
  SmsMessage,
} from '@/lib/types/dinner-party';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

/**
 * POST /api/dinner-party/[eventId]/send-invites
 * Send SMS invites to all pending guests
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const supabase = createServerSupabaseClient();

    // Get event
    const { data: event, error: eventError } = await supabase
      .from('content')
      .select('*')
      .eq('id', eventId)
      .eq('type', 'dinner-party-event')
      .single();

    if (eventError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const eventMetadata = event.metadata as DinnerPartyEventMetadata;

    // Get pending guests
    const { data: guests, error: guestsError } = await supabase
      .from('content')
      .select('*')
      .eq('parent_content_id', eventId)
      .eq('type', 'dinner-party-guest');

    if (guestsError) {
      return NextResponse.json(
        { error: 'Failed to fetch guests' },
        { status: 500 }
      );
    }

    const pendingGuests = (guests || []).filter(
      (g) => (g.metadata as DinnerPartyGuestMetadata).status === 'pending'
    );

    if (pendingGuests.length === 0) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        message: 'No pending guests to invite',
      });
    }

    // Format the date nicely
    const eventDate = new Date(eventMetadata.event_date);
    const dateOptions: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    };
    const formattedDate = eventDate.toLocaleDateString('en-US', dateOptions);

    // Compose invite message
    const hostName = 'Chris';
    const inviteMessage = `${hostName} is hosting dinner on ${formattedDate} at ${eventMetadata.time_window}. Food's covered. Can you make it? Reply YES or NO.`;

    // Send SMS to each pending guest
    const results = await Promise.allSettled(
      pendingGuests.map(async (guest) => {
        const guestMetadata = guest.metadata as DinnerPartyGuestMetadata;

        try {
          await sendSms(guestMetadata.phone_number, inviteMessage);

          // Update guest status and add message to thread
          const now = new Date().toISOString();
          const newMessage: SmsMessage = {
            direction: 'outbound',
            text: inviteMessage,
            timestamp: now,
          };

          const updatedMetadata: DinnerPartyGuestMetadata = {
            ...guestMetadata,
            status: 'invited',
            invited_at: now,
            sms_thread: [...(guestMetadata.sms_thread || []), newMessage],
          };

          await supabase
            .from('content')
            .update({ metadata: updatedMetadata })
            .eq('id', guest.id);

          return { id: guest.id, success: true };
        } catch (error) {
          console.error(
            `Failed to send SMS to ${guestMetadata.phone_number}:`,
            error
          );
          return {
            id: guest.id,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      })
    );

    // Count successes and failures
    const sent = results.filter(
      (r) => r.status === 'fulfilled' && r.value.success
    ).length;
    const failed = results.filter(
      (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    ).length;

    const errors = results
      .filter((r) => r.status === 'fulfilled' && !r.value.success)
      .map((r) => (r as PromiseFulfilledResult<{ error?: string }>).value.error)
      .filter(Boolean) as string[];

    // Update event status if any invites were sent
    if (sent > 0 && eventMetadata.status === 'draft') {
      await supabase
        .from('content')
        .update({
          metadata: { ...eventMetadata, status: 'invited' },
        })
        .eq('id', eventId);
    }

    return NextResponse.json({
      sent,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error sending invites:', error);
    return NextResponse.json(
      { error: 'Failed to send invites' },
      { status: 500 }
    );
  }
}
