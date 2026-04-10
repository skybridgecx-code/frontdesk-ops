import { FROM_EMAIL, getResendClient } from './email-client.js';
import {
  missedCallEmail,
  paymentConfirmationEmail,
  paymentFailedEmail,
  voicemailEmail,
  welcomeEmail
} from './email-templates.js';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

function hasResultError(value: unknown): value is { error: unknown } {
  return Boolean(value && typeof value === 'object' && 'error' in value);
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const resend = getResendClient();

  if (!resend) {
    console.warn('[email] Skipping email send — Resend not configured');
    return false;
  }

  try {
    const result = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html
    });

    if (hasResultError(result) && result.error) {
      console.error('[email] Send failed:', result.error);
      return false;
    }

    console.log(`[email] Sent "${params.subject}" to ${params.to}`);
    return true;
  } catch (error) {
    console.error('[email] Send error:', error);
    return false;
  }
}

export async function sendWelcomeEmail(
  to: string,
  name: string,
  businessName: string | null
): Promise<boolean> {
  const { subject, html } = welcomeEmail({ name, businessName });
  return sendEmail({ to, subject, html });
}

export async function sendMissedCallEmail(
  to: string,
  params: {
    businessName: string;
    callerPhone: string;
    callerName: string | null;
    callTime: string;
    callId: string;
  }
): Promise<boolean> {
  const { subject, html } = missedCallEmail(params);
  return sendEmail({ to, subject, html });
}

export async function sendVoicemailEmail(
  to: string,
  params: {
    businessName: string;
    callerPhone: string;
    callerName: string | null;
    callReason: string | null;
    voicemailDuration: number | null;
    callTime: string;
    callId: string;
  }
): Promise<boolean> {
  const { subject, html } = voicemailEmail(params);
  return sendEmail({ to, subject, html });
}

export async function sendPaymentConfirmationEmail(
  to: string,
  params: {
    name: string;
    planName: string;
    amount: string;
  }
): Promise<boolean> {
  const { subject, html } = paymentConfirmationEmail(params);
  return sendEmail({ to, subject, html });
}

export async function sendPaymentFailedEmail(
  to: string,
  params: {
    name: string;
    planName: string;
  }
): Promise<boolean> {
  const { subject, html } = paymentFailedEmail(params);
  return sendEmail({ to, subject, html });
}
