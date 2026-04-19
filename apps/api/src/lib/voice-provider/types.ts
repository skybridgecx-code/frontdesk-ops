export type VoiceProvider = 'twilio' | 'retell';

export type NormalizedVoiceCallStatus =
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'busy'
  | 'no_answer'
  | 'failed'
  | 'canceled';

export type NormalizedVoiceCallContext = {
  provider: VoiceProvider;
  providerCallId: string;
  tenantId?: string | null;
  businessId?: string | null;
  phoneNumberId?: string | null;
  fromE164?: string | null;
  toE164?: string | null;
};

export type NormalizedVoiceStatusUpdate = NormalizedVoiceCallContext & {
  status: NormalizedVoiceCallStatus;
  answeredAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
};

export type NormalizedVoiceTranscriptArtifact = NormalizedVoiceCallContext & {
  transcript?: string | null;
  summary?: string | null;
};

export type NormalizedVoiceEvidenceEvent =
  | (NormalizedVoiceCallContext & {
      type: 'inbound_fallback';
      reason?: string | null;
    })
  | (NormalizedVoiceCallContext & {
      type: 'textback_sent';
    })
  | (NormalizedVoiceCallContext & {
      type: 'textback_skipped';
      reason?: string | null;
    });
