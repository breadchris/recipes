/**
 * SimpleTexting API Client
 *
 * API Documentation: https://api-doc.simpletexting.com/
 * Base URL: https://api-app2.simpletexting.com/v2/api
 * Auth: Bearer token
 */

const SIMPLETEXTING_API_BASE = 'https://api-app2.simpletexting.com/v2/api';

export interface SendSmsRequest {
  to: string;
  text: string;
  from?: string;
}

export interface SendSmsResponse {
  id: string;
  status: string;
  to: string;
  text: string;
  created_at: string;
}

export interface SimpleTextingError {
  error: string;
  message: string;
  status_code: number;
}

/**
 * Send an SMS message via SimpleTexting API
 */
export async function sendSms(
  to: string,
  text: string,
  from?: string
): Promise<SendSmsResponse> {
  const apiKey = process.env.SIMPLETEXTING_API_KEY;
  if (!apiKey) {
    throw new Error('Missing SIMPLETEXTING_API_KEY environment variable');
  }

  const fromNumber = from || process.env.SIMPLETEXTING_PHONE_NUMBER;
  if (!fromNumber) {
    throw new Error('Missing SIMPLETEXTING_PHONE_NUMBER environment variable');
  }

  const response = await fetch(`${SIMPLETEXTING_API_BASE}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to,
      text,
      from: fromNumber,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorData: SimpleTextingError;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = {
        error: 'unknown',
        message: errorText,
        status_code: response.status,
      };
    }
    throw new Error(
      `SimpleTexting API error (${response.status}): ${errorData.message || errorText}`
    );
  }

  return response.json();
}

/**
 * Incoming SMS webhook payload from SimpleTexting
 * Note: Actual format may vary - adjust based on SimpleTexting docs
 */
export interface IncomingSmsWebhook {
  from: string;
  to: string;
  text: string;
  timestamp: string;
  message_id?: string;
}

/**
 * Parse and validate webhook payload from SimpleTexting
 */
export function parseWebhookPayload(body: unknown): IncomingSmsWebhook {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid webhook payload: expected object');
  }

  const payload = body as Record<string, unknown>;

  // SimpleTexting may send different field names - handle common variations
  const from =
    payload.from ||
    payload.sender ||
    payload.from_number ||
    payload.phone ||
    '';
  const to =
    payload.to || payload.recipient || payload.to_number || '';
  const text =
    payload.text ||
    payload.message ||
    payload.body ||
    payload.content ||
    '';
  const timestamp =
    payload.timestamp ||
    payload.created_at ||
    payload.received_at ||
    new Date().toISOString();
  const messageId =
    payload.message_id || payload.id || payload.sms_id || undefined;

  if (!from) {
    throw new Error('Invalid webhook payload: missing sender phone number');
  }

  return {
    from: String(from),
    to: String(to),
    text: String(text),
    timestamp: String(timestamp),
    message_id: messageId ? String(messageId) : undefined,
  };
}

/**
 * Validate SimpleTexting webhook signature (if supported)
 * Note: Implement based on SimpleTexting's actual signature verification method
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    // If no signature provided, skip verification (development mode)
    console.warn('Webhook signature verification skipped: no signature or secret');
    return true;
  }

  // TODO: Implement actual signature verification based on SimpleTexting docs
  // This is a placeholder - SimpleTexting may use HMAC-SHA256 or similar
  // const expectedSignature = crypto
  //   .createHmac('sha256', secret)
  //   .update(payload)
  //   .digest('hex');
  // return crypto.timingSafeEqual(
  //   Buffer.from(signature),
  //   Buffer.from(expectedSignature)
  // );

  return true;
}
