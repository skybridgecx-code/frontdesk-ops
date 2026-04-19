import { CallStatus } from '@frontdesk/db';
import type {
  NormalizedVoiceCallStatus,
  NormalizedVoiceEvidenceEvent
} from './types.js';

export function mapNormalizedVoiceStatusToCallStatus(status: NormalizedVoiceCallStatus) {
  switch (status) {
    case 'ringing':
      return CallStatus.RINGING;
    case 'in_progress':
      return CallStatus.IN_PROGRESS;
    case 'completed':
      return CallStatus.COMPLETED;
    case 'busy':
      return CallStatus.BUSY;
    case 'no_answer':
      return CallStatus.NO_ANSWER;
    case 'failed':
      return CallStatus.FAILED;
    case 'canceled':
      return CallStatus.CANCELED;
  }
}

export function mapNormalizedEvidenceEventType(event: NormalizedVoiceEvidenceEvent) {
  switch (event.type) {
    case 'inbound_fallback':
      return 'twilio.inbound.fallback';
    case 'textback_sent':
      return 'textback.sent';
    case 'textback_skipped':
      return 'textback.skipped';
  }
}
