import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/clients/supabaseServer';
import { sendSms, parseWebhookPayload } from '@/lib/simpletexting';
import type {
  DinnerPartyGuestMetadata,
  SmsMessage,
} from '@/lib/types/dinner-party';
import { normalizePhoneNumber } from '@/lib/types/dinner-party';

const DINNER_PARTY_GROUP_NAME = 'dinnerparty';

/**
 * POST /api/sms/webhook
 * Receive incoming SMS from SimpleTexting
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { from, text, timestamp } = parseWebhookPayload(body);

    console.log(`Received SMS from ${from}: "${text}"`);

    const supabase = createServerSupabaseClient();
    const normalizedPhone = normalizePhoneNumber(from);

    // Get group ID
    const { data: group } = await supabase
      .from('groups')
      .select('id')
      .eq('name', DINNER_PARTY_GROUP_NAME)
      .single();

    if (!group) {
      console.error('Dinner party group not found');
      return NextResponse.json({ status: 'error', message: 'Group not found' });
    }

    // Find guest by phone number in any active event
    const { data: guests } = await supabase
      .from('content')
      .select('*')
      .eq('group_id', group.id)
      .eq('type', 'dinner-party-guest');

    // Find matching guest by phone number who has been invited
    const matchingGuests = (guests || []).filter((g) => {
      const meta = g.metadata as DinnerPartyGuestMetadata;
      return (
        normalizePhoneNumber(meta.phone_number) === normalizedPhone &&
        ['invited', 'yes'].includes(meta.status)
      );
    });

    // Get the most recently invited guest
    const guest = matchingGuests.sort((a, b) => {
      const aInvited = (a.metadata as DinnerPartyGuestMetadata).invited_at || '';
      const bInvited = (b.metadata as DinnerPartyGuestMetadata).invited_at || '';
      return bInvited.localeCompare(aInvited);
    })[0];

    if (!guest) {
      console.log(`No matching guest found for phone ${normalizedPhone}`);
      return NextResponse.json({ status: 'unknown_sender' });
    }

    const guestMetadata = guest.metadata as DinnerPartyGuestMetadata;
    const now = new Date().toISOString();

    // Record incoming message
    const incomingMessage: SmsMessage = {
      direction: 'inbound',
      text,
      timestamp,
    };
    const updatedThread = [...(guestMetadata.sms_thread || []), incomingMessage];

    const response = text.trim().toUpperCase();
    const currentStatus = guestMetadata.status;

    // State machine logic
    if (currentStatus === 'invited') {
      if (response === 'YES' || response === 'Y') {
        // Send follow-up about dietary restrictions
        const followUp =
          "Awesome. Any strong no-gos? (e.g. seafood, spicy) Reply or ignore to accept default.";

        try {
          await sendSms(from, followUp);
        } catch (smsError) {
          console.error('Failed to send follow-up SMS:', smsError);
        }

        const outgoingMessage: SmsMessage = {
          direction: 'outbound',
          text: followUp,
          timestamp: now,
        };

        const updatedMetadata: DinnerPartyGuestMetadata = {
          ...guestMetadata,
          status: 'yes',
          responded_at: timestamp,
          constraints_asked_at: now,
          sms_thread: [...updatedThread, outgoingMessage],
        };

        await supabase
          .from('content')
          .update({ metadata: updatedMetadata })
          .eq('id', guest.id);

        // Send party link after a short delay (or immediately)
        await maybeSendPartyLink(supabase, guest.parent_content_id, guest.id);

        return NextResponse.json({ status: 'yes_recorded' });
      } else if (response === 'NO' || response === 'N') {
        const updatedMetadata: DinnerPartyGuestMetadata = {
          ...guestMetadata,
          status: 'no',
          responded_at: timestamp,
          sms_thread: updatedThread,
        };

        await supabase
          .from('content')
          .update({ metadata: updatedMetadata })
          .eq('id', guest.id);

        return NextResponse.json({ status: 'no_recorded' });
      } else {
        // Clarification needed
        const clarify = "Just reply YES or NO. Can you make it?";

        try {
          await sendSms(from, clarify);
        } catch (smsError) {
          console.error('Failed to send clarification SMS:', smsError);
        }

        const outgoingMessage: SmsMessage = {
          direction: 'outbound',
          text: clarify,
          timestamp: now,
        };

        const updatedMetadata: DinnerPartyGuestMetadata = {
          ...guestMetadata,
          sms_thread: [...updatedThread, outgoingMessage],
        };

        await supabase
          .from('content')
          .update({ metadata: updatedMetadata })
          .eq('id', guest.id);

        return NextResponse.json({ status: 'clarification_sent' });
      }
    } else if (currentStatus === 'yes') {
      // This is the dietary constraint response
      const constraints = text.trim();
      const hasConstraints =
        constraints.length > 0 &&
        !['NONE', 'NO', 'NOTHING', 'N/A', 'NA'].includes(
          constraints.toUpperCase()
        );

      const updatedMetadata: DinnerPartyGuestMetadata = {
        ...guestMetadata,
        status: 'constraints_captured',
        dietary_constraints: hasConstraints ? constraints : undefined,
        sms_thread: updatedThread,
      };

      await supabase
        .from('content')
        .update({ metadata: updatedMetadata })
        .eq('id', guest.id);

      return NextResponse.json({ status: 'constraints_captured' });
    }

    // Unknown state - just log the message
    const updatedMetadata: DinnerPartyGuestMetadata = {
      ...guestMetadata,
      sms_thread: updatedThread,
    };

    await supabase
      .from('content')
      .update({ metadata: updatedMetadata })
      .eq('id', guest.id);

    return NextResponse.json({ status: 'logged' });
  } catch (error) {
    console.error('Error processing SMS webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

/**
 * Send party link to confirmed guest
 */
async function maybeSendPartyLink(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  eventId: string,
  guestId: string
) {
  try {
    // Get the guest
    const { data: guest } = await supabase
      .from('content')
      .select('*')
      .eq('id', guestId)
      .single();

    if (!guest) return;

    const guestMetadata = guest.metadata as DinnerPartyGuestMetadata;

    // Check if party link already sent
    if (guestMetadata.party_link_sent) return;

    // Generate party link
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || 'https://recipes.breadchris.com';
    const partyUrl = `${baseUrl}/party/${eventId}`;

    const message = `You're in! See who else is coming: ${partyUrl}`;

    try {
      await sendSms(guestMetadata.phone_number, message);
    } catch (smsError) {
      console.error('Failed to send party link SMS:', smsError);
      return;
    }

    const now = new Date().toISOString();
    const outgoingMessage: SmsMessage = {
      direction: 'outbound',
      text: message,
      timestamp: now,
    };

    const updatedMetadata: DinnerPartyGuestMetadata = {
      ...guestMetadata,
      party_link_sent: true,
      sms_thread: [...(guestMetadata.sms_thread || []), outgoingMessage],
    };

    await supabase
      .from('content')
      .update({ metadata: updatedMetadata })
      .eq('id', guestId);
  } catch (error) {
    console.error('Error sending party link:', error);
  }
}

/**
 * GET /api/sms/webhook
 * SimpleTexting may use GET for some webhook configurations
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Some SMS providers send webhooks via GET with query params
  const from = searchParams.get('from') || searchParams.get('From') || '';
  const text =
    searchParams.get('text') ||
    searchParams.get('Body') ||
    searchParams.get('message') ||
    '';

  if (from && text) {
    // Create a fake request body and process it
    const body = {
      from,
      text,
      timestamp: new Date().toISOString(),
    };

    // Reuse POST logic by creating a new request
    const postRequest = new Request(request.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    return POST(postRequest);
  }

  // Return OK for webhook verification
  return NextResponse.json({ status: 'ok' });
}
