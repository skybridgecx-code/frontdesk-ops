/**
 * Manages caller and assistant transcript accumulation during a live call.
 *
 * As the OpenAI Realtime API streams transcript deltas, completed turns are
 * appended to the Call record in the database (newline-separated). After each
 * assistant turn completes, call extraction runs against the full transcripts
 * to update structured lead fields (name, phone, intent, urgency, etc.) in
 * near real-time.
 *
 * After extraction completes, a notification email is sent to configured
 * operators with the extracted lead data and a link to the call dashboard.
 */

import { prisma } from '@frontdesk/db';
import { extractCallData } from '@frontdesk/integrations/call-extraction';
import { sendCallCompletedNotification } from '@frontdesk/notifications';
import type { FastifyBaseLogger } from 'fastify';
import type { EventPersistence } from './event-persistence.js';

export class TranscriptManager {
  private readonly log: FastifyBaseLogger;
  private readonly events: EventPersistence;
  private readonly queryCallSid: string | null;

  constructor(
    log: FastifyBaseLogger,
    events: EventPersistence,
    queryCallSid: string | null
  ) {
    this.log = log;
    this.events = events;
    this.queryCallSid = queryCallSid;
  }

  /**
   * Appends a completed caller transcript turn to the Call record.
   */
  async appendCallerTranscript(
    transcript: string,
    itemId: string | null,
    streamSid: string | null
  ): Promise<void> {
    const context = await this.events.ensureCallContext();

    if (context && transcript) {
      const existing = await prisma.call.findUnique({
        where: { id: context.callId },
        select: { callerTranscript: true }
      });
      await prisma.call.update({
        where: { id: context.callId },
        data: {
          callerTranscript: existing?.callerTranscript
            ? `${existing.callerTranscript}\n${transcript}`
            : transcript
        }
      });
    }

    await this.events.persistEvent('openai.input_audio_transcription.completed', {
      callSid: this.queryCallSid,
      streamSid,
      itemId,
      transcriptLength: transcript.length
    });
  }

  /**
   * Appends a completed assistant transcript turn, runs extraction,
   * then sends a notification email to configured operators.
   */
  async appendAssistantTranscriptAndExtract(
    transcript: string,
    streamSid: string | null
  ): Promise<void> {
    const context = await this.events.ensureCallContext();

    if (context && transcript) {
      const existing = await prisma.call.findUnique({
        where: { id: context.callId },
        select: { assistantTranscript: true }
      });
      await prisma.call.update({
        where: { id: context.callId },
        data: {
          assistantTranscript: existing?.assistantTranscript
            ? `${existing.assistantTranscript}\n${transcript}`
            : transcript
        }
      });
    }

    await this.events.persistEvent('openai.output_audio_transcript.done', {
      callSid: this.queryCallSid,
      streamSid,
      transcriptLength: transcript.length
    });

    if (!context) return;

    const currentCall = await prisma.call.findUnique({
      where: { id: context.callId },
      select: { callerTranscript: true, assistantTranscript: true }
    });

    const extracted = await extractCallData({
      callerTranscript: currentCall?.callerTranscript ?? null,
      assistantTranscript: transcript
    });

    await prisma.call.update({
      where: { id: context.callId },
      data: {
        leadName: extracted.leadName,
        leadPhone: extracted.leadPhone,
        leadIntent: extracted.leadIntent,
        urgency: extracted.urgency,
        serviceAddress: extracted.serviceAddress,
        summary: extracted.summary
      }
    });

    await this.events.persistEvent('openai.call_extraction.completed', {
      callSid: this.queryCallSid,
      streamSid,
      leadName: extracted.leadName,
      leadPhone: extracted.leadPhone,
      leadIntent: extracted.leadIntent,
      urgency: extracted.urgency,
      serviceAddress: extracted.serviceAddress,
      summaryLength: extracted.summary?.length ?? 0
    });

    this.log.info({
      msg: 'call extraction completed',
      callSid: this.queryCallSid,
      leadName: extracted.leadName,
      leadPhone: extracted.leadPhone,
      leadIntent: extracted.leadIntent,
      urgency: extracted.urgency
    });

    // --- Send notification email ---
    await this.sendLeadNotification(context.callId, extracted);
  }

  /**
   * Loads full call context and sends a lead notification email.
   * Failures are logged but never block the call flow.
   */
  private async sendLeadNotification(
    callId: string,
    extracted: {
      leadName: string | null;
      leadPhone: string | null;
      leadIntent: string | null;
      urgency: string | null;
      serviceAddress: string | null;
      summary: string | null;
    }
  ): Promise<void> {
    try {
      const call = await prisma.call.findUnique({
        where: { id: callId },
        select: {
          twilioCallSid: true,
          fromE164: true,
          callerTranscript: true,
          assistantTranscript: true,
          durationSeconds: true,
          answeredAt: true,
          business: { select: { name: true } }
        }
      });

      if (!call) return;

      const result = await sendCallCompletedNotification({
        callId,
        callSid: call.twilioCallSid,
        businessName: call.business.name,
        fromE164: call.fromE164,
        leadName: extracted.leadName,
        leadPhone: extracted.leadPhone,
        leadIntent: extracted.leadIntent,
        urgency: extracted.urgency,
        serviceAddress: extracted.serviceAddress,
        summary: extracted.summary,
        callerTranscript: call.callerTranscript,
        assistantTranscript: call.assistantTranscript,
        durationSeconds: call.durationSeconds,
        answeredAt: call.answeredAt
      });

      if (result.sent) {
        this.log.info({
          msg: 'lead notification email sent',
          callSid: this.queryCallSid,
          leadName: extracted.leadName
        });

        await this.events.persistEvent('notification.email.sent', {
          callSid: this.queryCallSid,
          leadName: extracted.leadName,
          urgency: extracted.urgency
        });
      } else {
        this.log.warn({
          msg: 'lead notification email skipped',
          callSid: this.queryCallSid,
          reason: result.error
        });
      }
    } catch (error) {
      this.log.error({
        msg: 'lead notification email failed',
        callSid: this.queryCallSid,
        error: String(error)
      });
    }
  }
}
