'use client';

type RecordingPlayerProps = {
  recordingUrl: string | null;
  recordingDuration: number | null;
  recordingStatus: string | null;
};

function formatRecordingDuration(seconds: number | null) {
  if (seconds === null || seconds < 0) {
    return null;
  }

  if (seconds < 60) {
    return `0:${String(seconds).padStart(2, '0')}`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${String(remainder).padStart(2, '0')}s`;
}

export function RecordingPlayer({ recordingUrl, recordingDuration, recordingStatus }: RecordingPlayerProps) {
  const hasRecordingMetadata =
    recordingUrl !== null || recordingDuration !== null || recordingStatus !== null;

  if (!hasRecordingMetadata) {
    return null;
  }

  const formattedDuration = formatRecordingDuration(recordingDuration);
  const isProcessing = recordingStatus === 'in-progress' || recordingStatus === 'completed';

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Call Recording</h2>
        {formattedDuration ? <span className="text-sm text-gray-500">{formattedDuration}</span> : null}
      </div>

      {recordingUrl ? (
        <audio className="w-full min-w-0" controls preload="none">
          <source src={recordingUrl} type="audio/mpeg" />
          Your browser does not support audio playback.
        </audio>
      ) : isProcessing ? (
        <div className="flex items-center gap-2 text-sm text-gray-600" role="status">
          <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-indigo-600" aria-hidden="true" />
          Recording processing...
        </div>
      ) : recordingStatus === 'absent' ? (
        <p className="text-sm text-gray-600">No recording available for this call</p>
      ) : recordingStatus === 'failed' ? (
        <p className="text-sm text-gray-500">Recording failed</p>
      ) : null}
    </section>
  );
}
