import type {
  NormalizedVoiceInboundCall,
  NormalizedVoiceEvidenceEvent,
  NormalizedVoiceStatusUpdate,
  NormalizedVoiceTranscriptArtifact,
  VoiceProvider
} from './types.js';

export interface VoiceProviderAdapter {
  readonly provider: VoiceProvider;

  normalizeInboundCall?(input: unknown): NormalizedVoiceInboundCall | null;

  normalizeStatusUpdate?(input: unknown): NormalizedVoiceStatusUpdate | null;

  normalizeTranscriptArtifact?(input: unknown): NormalizedVoiceTranscriptArtifact | null;

  normalizeEvidenceEvent?(input: unknown): NormalizedVoiceEvidenceEvent | null;
}
