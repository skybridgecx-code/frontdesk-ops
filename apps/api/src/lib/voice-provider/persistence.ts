import { CallStatus, prisma } from '@frontdesk/db';
import type { Prisma } from '@frontdesk/db';
import { mapNormalizedEvidenceEventType, mapNormalizedVoiceStatusToCallStatus } from './event-mapping.js';
import type {
  NormalizedVoiceEvidenceEvent,
  NormalizedVoiceStatusUpdate,
  NormalizedVoiceTranscriptArtifact
} from './types.js';

type PersistedCallStatusState = {
  id: string;
  answeredAt: Date | null;
  endedAt: Date | null;
};

function isTerminalStatus(status: CallStatus) {
  return (
    status === CallStatus.COMPLETED ||
    status === CallStatus.BUSY ||
    status === CallStatus.NO_ANSWER ||
    status === CallStatus.FAILED ||
    status === CallStatus.CANCELED
  );
}

function parseDateOrNull(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toPrismaJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

async function persistCallEventWithRetry(input: {
  callId: string;
  type: string;
  payloadJson: unknown;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existingEventCount = await prisma.callEvent.count({
      where: { callId: input.callId }
    });

    try {
      await prisma.callEvent.create({
        data: {
          callId: input.callId,
          type: input.type,
          sequence: existingEventCount + 1,
          payloadJson: toPrismaJsonValue(input.payloadJson)
        }
      });
      return;
    } catch (error: unknown) {
      const isUniqueViolation =
        error instanceof Error &&
        (error.message.includes('Unique constraint') || error.message.includes('unique constraint'));
      if (!isUniqueViolation || attempt === 2) throw error;
    }
  }
}

export async function applyNormalizedStatusUpdateToCall(input: {
  call: PersistedCallStatusState;
  statusUpdate: NormalizedVoiceStatusUpdate;
}) {
  const mappedStatus = mapNormalizedVoiceStatusToCallStatus(input.statusUpdate.status);
  const updateData: {
    status: CallStatus;
    answeredAt?: Date;
    endedAt?: Date;
    durationSeconds?: number;
  } = {
    status: mappedStatus
  };

  if (!input.call.answeredAt) {
    const explicitAnsweredAt = parseDateOrNull(input.statusUpdate.answeredAt);
    if (explicitAnsweredAt) {
      updateData.answeredAt = explicitAnsweredAt;
    } else if (mappedStatus === CallStatus.IN_PROGRESS) {
      updateData.answeredAt = new Date();
    }
  }

  if (!input.call.endedAt) {
    const explicitEndedAt = parseDateOrNull(input.statusUpdate.endedAt);
    if (explicitEndedAt) {
      updateData.endedAt = explicitEndedAt;
    } else if (isTerminalStatus(mappedStatus)) {
      updateData.endedAt = new Date();
    }
  }

  if (input.statusUpdate.durationSeconds !== null && input.statusUpdate.durationSeconds !== undefined) {
    updateData.durationSeconds = input.statusUpdate.durationSeconds;
  }

  await prisma.call.update({
    where: { id: input.call.id },
    data: updateData
  });

  return {
    mappedStatus,
    updateData
  };
}

export async function persistNormalizedEvidenceEvent(input: {
  callId: string;
  event: NormalizedVoiceEvidenceEvent;
  payloadJson?: unknown;
}) {
  const eventType = mapNormalizedEvidenceEventType(input.event);
  await persistCallEventWithRetry({
    callId: input.callId,
    type: eventType,
    payloadJson: input.payloadJson ?? input.event
  });

  return eventType;
}

export async function persistNormalizedTranscriptArtifact(input: {
  callId: string;
  artifact: NormalizedVoiceTranscriptArtifact;
}) {
  const updateData: {
    summary?: string | null;
    callerTranscript?: string | null;
  } = {};

  if (input.artifact.summary !== undefined) {
    updateData.summary = input.artifact.summary;
  }

  // Keep transcript writes schema-compatible by using the existing callerTranscript slot.
  if (input.artifact.transcript !== undefined) {
    updateData.callerTranscript = input.artifact.transcript;
  }

  if (Object.keys(updateData).length === 0) {
    return { updated: false as const };
  }

  await prisma.call.update({
    where: { id: input.callId },
    data: updateData
  });

  return {
    updated: true as const,
    updateData
  };
}
