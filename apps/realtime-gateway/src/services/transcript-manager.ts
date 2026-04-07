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
   * Appends a completed caller transcript turn and persists it.
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
   * Appends a completed assistant transcript turn, persists it,
   * then runs call extraction against the full transcripts.
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
