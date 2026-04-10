import { Resend } from 'resend';

let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — emails will not be sent');
    return null;
  }

  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }

  return resendClient;
}

export const FROM_EMAIL = 'SkybridgeCX <notifications@skybridgecx.co>';
export const SUPPORT_EMAIL = 'support@skybridgecx.co';
