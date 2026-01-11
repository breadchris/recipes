import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/clients/supabaseServer';
import type {
  DinnerPartyEvent,
  DinnerPartyGuest,
  DinnerPartyEventMetadata,
  DinnerPartyGuestMetadata,
  CreateEventInput,
} from '@/lib/types/dinner-party';
import { normalizePhoneNumber } from '@/lib/types/dinner-party';

const DINNER_PARTY_GROUP_NAME = 'dinnerparty';
const HOST_EMAIL = 'chris@breadchris.com';

/**
 * GET /api/dinner-party
 * List all dinner party events with their guests
 */
export async function GET() {
  try {
    const supabase = createServerSupabaseClient();

    // Get group ID
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id')
      .eq('name', DINNER_PARTY_GROUP_NAME)
      .single();

    if (groupError || !group) {
      return NextResponse.json(
        { error: 'Dinner party group not found. Please run setup SQL.' },
        { status: 404 }
      );
    }

    // Get all events
    const { data: events, error: eventsError } = await supabase
      .from('content')
      .select('*')
      .eq('group_id', group.id)
      .eq('type', 'dinner-party-event')
      .is('parent_content_id', null)
      .order('created_at', { ascending: false });

    if (eventsError) {
      return NextResponse.json({ error: eventsError.message }, { status: 500 });
    }

    // For each event, get guests
    const eventsWithGuests: DinnerPartyEvent[] = await Promise.all(
      (events || []).map(async (event) => {
        const { data: guests } = await supabase
          .from('content')
          .select('*')
          .eq('parent_content_id', event.id)
          .eq('type', 'dinner-party-guest')
          .order('created_at', { ascending: true });

        return {
          ...event,
          metadata: event.metadata as DinnerPartyEventMetadata,
          guests: (guests || []).map((g) => ({
            ...g,
            metadata: g.metadata as DinnerPartyGuestMetadata,
          })) as DinnerPartyGuest[],
        };
      })
    );

    return NextResponse.json({ events: eventsWithGuests });
  } catch (error) {
    console.error('Error listing dinner party events:', error);
    return NextResponse.json(
      { error: 'Failed to list events' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/dinner-party
 * Create a new dinner party event with guests
 */
export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient();
    const body: CreateEventInput = await request.json();

    // Validate required fields
    if (!body.event_date || !body.time_window || !body.food_default) {
      return NextResponse.json(
        { error: 'Missing required fields: event_date, time_window, food_default' },
        { status: 400 }
      );
    }

    if (!body.guest_phone_numbers || body.guest_phone_numbers.length === 0) {
      return NextResponse.json(
        { error: 'At least one guest phone number is required' },
        { status: 400 }
      );
    }

    // Get group ID
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id')
      .eq('name', DINNER_PARTY_GROUP_NAME)
      .single();

    if (groupError || !group) {
      return NextResponse.json(
        { error: 'Dinner party group not found. Please run setup SQL.' },
        { status: 404 }
      );
    }

    // Get user ID for chris@breadchris.com
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const hostUser = authUsers?.users?.find((u) => u.email === HOST_EMAIL);

    if (!hostUser) {
      return NextResponse.json(
        { error: `User ${HOST_EMAIL} not found` },
        { status: 404 }
      );
    }

    const eventName = body.event_name || "Dinner at Chris's";

    // Create event metadata
    const eventMetadata: DinnerPartyEventMetadata = {
      event_name: eventName,
      event_date: body.event_date,
      time_window: body.time_window,
      food_default: body.food_default,
      status: 'draft',
    };

    // Insert event
    const { data: event, error: eventError } = await supabase
      .from('content')
      .insert({
        type: 'dinner-party-event',
        data: eventName,
        group_id: group.id,
        user_id: hostUser.id,
        metadata: eventMetadata,
      })
      .select()
      .single();

    if (eventError || !event) {
      console.error('Error creating event:', eventError);
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      );
    }

    // Create guest records
    const guestInserts = body.guest_phone_numbers.map((phone, index) => {
      const normalizedPhone = normalizePhoneNumber(phone);
      const guestName = body.guest_names?.[index] || undefined;

      const guestMetadata: DinnerPartyGuestMetadata = {
        phone_number: normalizedPhone,
        name: guestName,
        status: 'pending',
        sms_thread: [],
      };

      return {
        type: 'dinner-party-guest',
        data: guestName || normalizedPhone,
        group_id: group.id,
        user_id: hostUser.id,
        parent_content_id: event.id,
        metadata: guestMetadata,
      };
    });

    const { data: guests, error: guestsError } = await supabase
      .from('content')
      .insert(guestInserts)
      .select();

    if (guestsError) {
      console.error('Error creating guests:', guestsError);
      // Event was created but guests failed - still return event
    }

    return NextResponse.json({
      event: {
        ...event,
        metadata: event.metadata as DinnerPartyEventMetadata,
        guests: (guests || []).map((g) => ({
          ...g,
          metadata: g.metadata as DinnerPartyGuestMetadata,
        })),
      },
    });
  } catch (error) {
    console.error('Error creating dinner party event:', error);
    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}
