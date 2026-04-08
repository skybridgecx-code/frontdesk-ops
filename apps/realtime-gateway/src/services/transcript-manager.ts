/**
 * Manages caller and assistant transcript accumulation during a live call.
 *
 * As the OpenAI Realtime API streams transcript deltas, completed turns are
 * appended to the Call record in the database (newline-separated). After each
 * assistant turn completes, call extraction runs against the full transcripts
 * to update structured lead fields (name, phone, intent, urgency, etc.) in
 * near real-time.
 *
 * Each method is fire-and-forget safe — if no call context exists (e.g. the
 * call record hasn't been created yet), operations are silently skipped.
 */

import { prisma } from '@frontdesk/db';
import { extractCallData } from '@frontdesk/integrations/call-extraction';
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
   *
   * Reads the current `callerTranscript`, appends the new turn with a newline
   * separator, and persists a `openai.input_audio_transcription.completed` event.
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
   * Appends a completed assistant transcript turn, then runs call extraction.
   *
   * 1. Reads the current `assistantTranscript` and appends the new turn.
   * 2. Persists a `openai.output_audio_transcript.done` event.
   * 3. Loads the full caller + assistant transcripts.
   * 4. Calls `extractCallData()` to get structured lead fields.
   * 5. Updates the Call record with extracted data.
   * 6. Persists a `openai.call_extraction.completed` event.
   *
   * Extraction runs after every assistant turn so the operator dashboard
   * shows progressively refined lead data during the call.
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
  }
}
