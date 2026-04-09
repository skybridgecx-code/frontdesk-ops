/**
 * Notification configuration.
 *
 * For v1, notification recipients are configured via environment variables.
 * Per-business notification preferences will be added when multi-tenant
 * onboarding is built.
 */

import type { Resend } from 'resend';

let resendClient: Resend | null = null;

export function isNotificationsConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && getNotificationEmails().length > 0);
}

export function getNotificationEmails(): string[] {
  const raw = process.env.NOTIFICATION_EMAILS ?? '';
  return raw
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && e.includes('@'));
}

export function getFromAddress(): string {
  return process.env.NOTIFICATION_FROM_EMAIL ?? 'Frontdesk OS <notifications@frontdesk-os.com>';
}

export function getDashboardUrl(): string {
  return (process.env.FRONTDESK_WEB_URL ?? 'http://localhost:3000').replace(/\/$/, '');
}

export async function getResendClient(): Promise<Resend> {
  if (resendClient) return resendClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY is not set');

  const { Resend } = await import('resend');
  resendClient = new Resend(apiKey);
  return resendClient;
}
