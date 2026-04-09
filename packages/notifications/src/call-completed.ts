/**
 * Call completed notification orchestrator.
 *
 * Called from the realtime gateway after call extraction completes.
 * Loads the full call + business context from the database, then
 * sends the new lead email to configured operators.
 */

import { sendNewLeadEmail } from './new-lead-email.js';

export interface CallCompletedNotificationInput {
  callId: string;
  callSid: string;
  businessName: string;
  fromE164: string | null;
  leadName: string | null;
  leadPhone: string | null;
  leadIntent: string | null;
  urgency: string | null;
  serviceAddress: string | null;
  summary: string | null;
  callerTranscript: string | null;
  assistantTranscript: string | null;
  durationSeconds: number | null;
  answeredAt: Date | string | null;
}

export async function sendCallCompletedNotification(
  input: CallCompletedNotificationInput
): Promise<{ sent: boolean; error?: string }> {
  return sendNewLeadEmail({
    callSid: input.callSid,
    businessName: input.businessName,
    fromE164: input.fromE164,
    leadName: input.leadName,
    leadPhone: input.leadPhone,
    leadIntent: input.leadIntent,
    urgency: input.urgency,
    serviceAddress: input.serviceAddress,
    summary: input.summary,
    callerTranscript: input.callerTranscript,
    assistantTranscript: input.assistantTranscript,
    durationSeconds: input.durationSeconds,
    answeredAt: input.answeredAt
  });
}
