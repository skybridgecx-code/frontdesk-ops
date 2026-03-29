export function createTranscriptState() {
  let currentInputItemId: string | null = null;
  let assistantTranscriptBuffer = '';
  let callerTranscriptBuffer = '';

  return {
    getCurrentInputItemId() {
      return currentInputItemId;
    },
    setCurrentInputItemId(itemId: string | null) {
      currentInputItemId = itemId;
    },
    appendCallerDelta(delta: string) {
      callerTranscriptBuffer += delta;
      return callerTranscriptBuffer.length;
    },
    consumeCallerTranscript(transcript: string | null) {
      return transcript ?? callerTranscriptBuffer;
    },
    resetCallerTranscript() {
      callerTranscriptBuffer = '';
    },
    appendAssistantDelta(delta: string) {
      assistantTranscriptBuffer += delta;
      return assistantTranscriptBuffer.length;
    },
    consumeAssistantTranscript(transcript: string | null) {
      return transcript ?? assistantTranscriptBuffer;
    },
    resetAssistantTranscript() {
      assistantTranscriptBuffer = '';
    }
  };
}
