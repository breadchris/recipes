import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/clients/supabaseServer';
import type {
  DinnerPartyEvent,
  DinnerPartyGuest,
  DinnerPartyEventMetadata,
  DinnerPartyGuestMetadata,
} from '@/lib/types/dinner-party';

interface RouteParams {
  params: Promise<{ eventId: string }>;
}

/**
 * GET /api/dinner-party/[eventId]
 * Get a single event with its guests
 */
export async function GET(request: Request, { params }: RouteParams) {
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

    // Get guests
    const { data: guests } = await supabase
      .from('content')
      .select('*')
      .eq('parent_content_id', eventId)
      .eq('type', 'dinner-party-guest')
      .order('created_at', { ascending: true });

    const eventWithGuests: DinnerPartyEvent = {
      ...event,
      metadata: event.metadata as DinnerPartyEventMetadata,
      guests: (guests || []).map((g) => ({
        ...g,
        metadata: g.metadata as DinnerPartyGuestMetadata,
      })) as DinnerPartyGuest[],
    };

    return NextResponse.json({ event: eventWithGuests });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/dinner-party/[eventId]
 * Update an event's metadata
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const supabase = createServerSupabaseClient();
    const body = await request.json();

    // Get existing event
    const { data: existingEvent, error: fetchError } = await supabase
      .from('content')
      .select('*')
      .eq('id', eventId)
      .eq('type', 'dinner-party-event')
      .single();

    if (fetchError || !existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const existingMetadata = existingEvent.metadata as DinnerPartyEventMetadata;

    // Merge updates with existing metadata
    const updatedMetadata: DinnerPartyEventMetadata = {
      ...existingMetadata,
      ...(body.event_name && { event_name: body.event_name }),
      ...(body.event_date && { event_date: body.event_date }),
      ...(body.time_window && { time_window: body.time_window }),
      ...(body.food_default && { food_default: body.food_default }),
      ...(body.status && { status: body.status }),
      ...(body.confirmed_threshold !== undefined && {
        confirmed_threshold: body.confirmed_threshold,
      }),
    };

    // Update event
    const { data: event, error: updateError } = await supabase
      .from('content')
      .update({
        data: updatedMetadata.event_name,
        metadata: updatedMetadata,
      })
      .eq('id', eventId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating event:', updateError);
      return NextResponse.json(
        { error: 'Failed to update event' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      event: {
        ...event,
        metadata: event.metadata as DinnerPartyEventMetadata,
      },
    });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/dinner-party/[eventId]
 * Delete an event and all its guests
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { eventId } = await params;
    const supabase = createServerSupabaseClient();

    // First delete all guests (children)
    const { error: guestsError } = await supabase
      .from('content')
      .delete()
      .eq('parent_content_id', eventId)
      .eq('type', 'dinner-party-guest');

    if (guestsError) {
      console.error('Error deleting guests:', guestsError);
    }

    // Then delete the event
    const { error: eventError } = await supabase
      .from('content')
      .delete()
      .eq('id', eventId)
      .eq('type', 'dinner-party-event');

    if (eventError) {
      return NextResponse.json(
        { error: 'Failed to delete event' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}
