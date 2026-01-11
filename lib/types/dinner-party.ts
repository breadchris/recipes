/**
 * Dinner Party Planner Types
 *
 * Data is stored in Supabase content table:
 * - Events: type = "dinner-party-event", parent_content_id = null
 * - Guests: type = "dinner-party-guest", parent_content_id = event.id
 */

// SMS message in thread
export interface SmsMessage {
  direction: 'outbound' | 'inbound';
  text: string;
  timestamp: string;
}

// Event metadata stored in content.metadata
export interface DinnerPartyEventMetadata {
  event_name: string;
  event_date: string;
  time_window: string;
  food_default: string;
  status: 'draft' | 'invited' | 'confirmed' | 'completed';
  confirmed_threshold?: number;
}

// Guest metadata stored in content.metadata
export interface DinnerPartyGuestMetadata {
  phone_number: string;
  name?: string;
  status: 'pending' | 'invited' | 'yes' | 'no' | 'constraints_captured';
  dietary_constraints?: string;
  invited_at?: string;
  responded_at?: string;
  constraints_asked_at?: string;
  party_link_sent?: boolean;
  sms_thread: SmsMessage[];
}

// Content record from Supabase
export interface ContentRecord {
  id: string;
  created_at: string;
  updated_at: string;
  type: string;
  data: string;
  group_id: string;
  user_id: string;
  parent_content_id: string | null;
  metadata: Record<string, unknown> | null;
}

// Event with typed metadata
export interface DinnerPartyEvent extends Omit<ContentRecord, 'metadata'> {
  metadata: DinnerPartyEventMetadata;
  guests?: DinnerPartyGuest[];
}

// Guest with typed metadata
export interface DinnerPartyGuest extends Omit<ContentRecord, 'metadata'> {
  metadata: DinnerPartyGuestMetadata;
}

// Form input for creating new event
export interface CreateEventInput {
  event_name?: string;
  event_date: string;
  time_window: string;
  food_default: string;
  guest_phone_numbers: string[];
  guest_names?: string[];
}

// API response types
export interface DinnerPartyListResponse {
  events: DinnerPartyEvent[];
}

export interface SendInvitesResponse {
  sent: number;
  failed: number;
  errors?: string[];
}

// Guest status summary for dashboard
export interface GuestStatusSummary {
  pending: number;
  invited: number;
  confirmed: number;
  declined: number;
  total: number;
}

export function getGuestStatusSummary(guests: DinnerPartyGuest[]): GuestStatusSummary {
  const summary: GuestStatusSummary = {
    pending: 0,
    invited: 0,
    confirmed: 0,
    declined: 0,
    total: guests.length,
  };

  for (const guest of guests) {
    switch (guest.metadata.status) {
      case 'pending':
        summary.pending++;
        break;
      case 'invited':
        summary.invited++;
        break;
      case 'yes':
      case 'constraints_captured':
        summary.confirmed++;
        break;
      case 'no':
        summary.declined++;
        break;
    }
  }

  return summary;
}

// Phone number normalization
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

// Format phone for display
export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
}
