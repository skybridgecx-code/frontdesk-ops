export const WEBHOOK_EVENTS = [
  'call.completed',
  'call.recording.ready',
  'prospect.created'
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

export function isWebhookEventType(value: string): value is WebhookEventType {
  return WEBHOOK_EVENTS.includes(value as WebhookEventType);
}
