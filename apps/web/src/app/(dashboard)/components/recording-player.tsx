'use client';

type RecordingPlayerProps = {
  recordingUrl:      string | null;
  recordingDuration: number | null;
  recordingStatus:   string | null;
};

function formatRecordingDuration(seconds: number | null) {
  if (seconds === null || seconds < 0) return null;
  if (seconds < 60) return `0:${String(seconds).padStart(2, '0')}`;
  const minutes   = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}

export function RecordingPlayer({ recordingUrl, recordingDuration, recordingStatus }: RecordingPlayerProps) {
  const hasRecordingMetadata =
    recordingUrl !== null || recordingDuration !== null || recordingStatus !== null;

  if (!hasRecordingMetadata) return null;

  const formattedDuration = formatRecordingDuration(recordingDuration);
  const isProcessing      = recordingStatus === 'in-progress' || recordingStatus === 'completed';

  return (
    <section
      className="rounded-xl p-5 sm:p-6"
      style={{
        background: 'var(--surface)',
        border:     '1px solid var(--border)',
        boxShadow:  'var(--shadow-sm)',
      }}
    >
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2
          className="text-base font-semibold"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
        >
          Call Recording
        </h2>
        {formattedDuration ? (
          <span
            className="rounded-md px-2.5 py-1 text-xs font-medium"
            style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
          >
            {formattedDuration}
          </span>
        ) : null}
      </div>

      {recordingUrl ? (
        <audio className="w-full min-w-0 rounded-lg" controls preload="none">
          <source src={recordingUrl} type="audio/mpeg" />
          Your browser does not support audio playback.
        </audio>
      ) : isProcessing ? (
        <div
          className="flex items-center gap-2.5 rounded-lg px-4 py-3 text-sm"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
          role="status"
        >
          <span
            className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent"
            style={{ animation: 'spinSmooth 0.8s linear infinite' }}
            aria-hidden="true"
          />
          Recording processing…
        </div>
      ) : recordingStatus === 'absent' ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          No recording available for this call.
        </p>
      ) : recordingStatus === 'failed' ? (
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          Recording failed.
        </p>
      ) : null}
    </section>
  );
}
