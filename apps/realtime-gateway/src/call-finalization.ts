import type { FastifyBaseLogger } from 'fastify';
import { prisma } from '@frontdesk/db';
import { extractCallData } from '@frontdesk/integrations/call-extraction';

export function createCallFinalizer(input: {
  queryCallSid: string | null;
  getCurrentStreamSid: () => string | null;
  ensureCallContext: () => Promise<{ callId: string; sequence: number } | null>;
  persistEvent: (type: string, payloadJson: Record<string, unknown>) => Promise<void>;
  closeOpenAIRealtimeSocket: () => void;
  log: FastifyBaseLogger;
}) {
  let finalizationRequested = false;
  let mediaSocketClosed = false;
  let extractionCompleted = false;
  let extractionInFlight: Promise<void> | null = null;
  let finalizationTimeout: ReturnType<typeof setTimeout> | null = null;

  function clearFinalizationTimeout() {
    if (finalizationTimeout) {
      clearTimeout(finalizationTimeout);
      finalizationTimeout = null;
    }
  }

  async function runCallExtraction(trigger: string) {
    if (extractionCompleted) {
      return;
    }

    if (extractionInFlight) {
      await extractionInFlight;
      return;
    }

    extractionInFlight = (async () => {
      const context = await input.ensureCallContext();
      if (!context) {
        return;
      }

      const currentCall = await prisma.call.findUnique({
        where: { id: context.callId },
        select: {
          callerTranscript: true,
          assistantTranscript: true
        }
      });

      const callerTranscript = currentCall?.callerTranscript ?? null;
      const assistantTranscript = currentCall?.assistantTranscript ?? null;

      if (!callerTranscript && !assistantTranscript) {
        await input.persistEvent('openai.call_extraction.skipped', {
          callSid: input.queryCallSid,
          streamSid: input.getCurrentStreamSid(),
          trigger,
          reason: 'missing_transcript'
        });

        input.log.warn({
          msg: 'call extraction skipped because transcripts were missing',
          callSid: input.queryCallSid,
          trigger
        });

        return;
      }

      const extracted = await extractCallData({
        callerTranscript,
        assistantTranscript
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

      extractionCompleted = true;
      clearFinalizationTimeout();

      await input.persistEvent('openai.call_extraction.completed', {
        callSid: input.queryCallSid,
        streamSid: input.getCurrentStreamSid(),
        trigger,
        leadName: extracted.leadName,
        leadPhone: extracted.leadPhone,
        leadIntent: extracted.leadIntent,
        urgency: extracted.urgency,
        serviceAddress: extracted.serviceAddress,
        summaryLength: extracted.summary?.length ?? 0
      });

      input.log.info({
        msg: 'call extraction completed',
        callSid: input.queryCallSid,
        trigger,
        leadName: extracted.leadName,
        leadPhone: extracted.leadPhone,
        leadIntent: extracted.leadIntent,
        urgency: extracted.urgency
      });
    })().finally(() => {
      extractionInFlight = null;

      if (mediaSocketClosed && extractionCompleted) {
        input.closeOpenAIRealtimeSocket();
      }
    });

    await extractionInFlight;
  }

  function scheduleFinalizationTimeout(reason: string, enqueue: (task: () => Promise<void>) => void) {
    clearFinalizationTimeout();

    finalizationTimeout = setTimeout(() => {
      enqueue(async () => {
        await input.persistEvent('openai.finalization.timeout', {
          callSid: input.queryCallSid,
          streamSid: input.getCurrentStreamSid(),
          reason
        });

        await runCallExtraction(`timeout:${reason}`);
        input.closeOpenAIRealtimeSocket();
      });
    }, 4000);
  }

  return {
    clearFinalizationTimeout,
    scheduleFinalizationTimeout,
    runCallExtraction,
    markFinalizationRequested() {
      finalizationRequested = true;
    },
    isFinalizationRequested() {
      return finalizationRequested;
    },
    markMediaSocketClosed() {
      mediaSocketClosed = true;
    },
    isExtractionCompleted() {
      return extractionCompleted;
    }
  };
}
