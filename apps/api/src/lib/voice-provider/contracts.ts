import type {
  NormalizedVoiceEvidenceEvent,
  NormalizedVoiceStatusUpdate,
  NormalizedVoiceTranscriptArtifact,
  VoiceProvider
} from './types.js';

export interface VoiceProviderAdapter {
  readonly provider: VoiceProvider;

  normalizeStatusUpdate?(input: unknown): NormalizedVoiceStatusUpdate | null;

  normalizeTranscriptArtifact?(input: unknown): NormalizedVoiceTranscriptArtifact | null;

  normalizeEvidenceEvent?(input: unknown): NormalizedVoiceEvidenceEvent | null;
}
