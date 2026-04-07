import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@frontdesk/db', () => ({
  prisma: {
    call: {
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}));

vi.mock('@frontdesk/integrations/call-extraction', () => ({
  extractCallData: vi.fn()
}));

import { prisma } from '@frontdesk/db';
import { extractCallData } from '@frontdesk/integrations/call-extraction';
import { TranscriptManager } from '../transcript-manager.js';

const mockPrisma = prisma as any;
const mockExtract = extractCallData as any;

function makeLogger() {
  return { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } as any;
}

function makeEvents(callId: string | null = 'call-1') {
  return {
    ensureCallContext: vi.fn().mockResolvedValue(callId ? { callId, sequence: 0 } : null),
    persistEvent: vi.fn().mockResolvedValue(undefined)
  } as any;
}

describe('TranscriptManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('appendCallerTranscript', () => {
    it('appends to existing caller transcript with newline', async () => {
      const events = makeEvents('call-1');
      mockPrisma.call.findUnique.mockResolvedValue({ callerTranscript: 'Hello' });
      mockPrisma.call.update.mockResolvedValue({});

      const tm = new TranscriptManager(makeLogger(), events, 'CA123');
      await tm.appendCallerTranscript('I need help', 'item-1', 'stream-1');

      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-1' },
        data: { callerTranscript: 'Hello\nI need help' }
      });
    });

    it('sets transcript when none exists', async () => {
      const events = makeEvents('call-1');
      mockPrisma.call.findUnique.mockResolvedValue({ callerTranscript: null });
      mockPrisma.call.update.mockResolvedValue({});

      const tm = new TranscriptManager(makeLogger(), events, 'CA123');
      await tm.appendCallerTranscript('First message', 'item-1', 'stream-1');

      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-1' },
        data: { callerTranscript: 'First message' }
      });
    });

    it('persists event even when no call context', async () => {
      const events = makeEvents(null);
      const tm = new TranscriptManager(makeLogger(), events, 'CA123');
      await tm.appendCallerTranscript('test', 'item-1', 'stream-1');

      expect(mockPrisma.call.update).not.toHaveBeenCalled();
      expect(events.persistEvent).toHaveBeenCalledWith(
        'openai.input_audio_transcription.completed',
        expect.objectContaining({ transcriptLength: 4 })
      );
    });
  });

  describe('appendAssistantTranscriptAndExtract', () => {
    it('appends transcript and runs extraction', async () => {
      const events = makeEvents('call-1');
      mockPrisma.call.findUnique
        .mockResolvedValueOnce({ assistantTranscript: null })     // for append
        .mockResolvedValueOnce({ callerTranscript: 'Help me', assistantTranscript: 'Sure' }); // for extraction

      mockPrisma.call.update.mockResolvedValue({});
      mockExtract.mockResolvedValue({
        leadName: 'John',
        leadPhone: '+15551234567',
        leadIntent: 'repair',
        urgency: 'high',
        serviceAddress: '123 Main St',
        summary: 'Needs AC repair'
      });

      const tm = new TranscriptManager(makeLogger(), events, 'CA123');
      await tm.appendAssistantTranscriptAndExtract('How can I help?', 'stream-1');

      // First update: append transcript
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-1' },
        data: { assistantTranscript: 'How can I help?' }
      });

      // Second update: extraction data
      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-1' },
        data: {
          leadName: 'John',
          leadPhone: '+15551234567',
          leadIntent: 'repair',
          urgency: 'high',
          serviceAddress: '123 Main St',
          summary: 'Needs AC repair'
        }
      });

      expect(mockExtract).toHaveBeenCalledWith({
        callerTranscript: 'Help me',
        assistantTranscript: 'How can I help?'
      });
    });

    it('appends to existing assistant transcript', async () => {
      const events = makeEvents('call-1');
      mockPrisma.call.findUnique
        .mockResolvedValueOnce({ assistantTranscript: 'Previous turn' })
        .mockResolvedValueOnce({ callerTranscript: null, assistantTranscript: 'Previous turn\nNew turn' });

      mockPrisma.call.update.mockResolvedValue({});
      mockExtract.mockResolvedValue({
        leadName: null, leadPhone: null, leadIntent: null,
        urgency: null, serviceAddress: null, summary: null
      });

      const tm = new TranscriptManager(makeLogger(), events, 'CA123');
      await tm.appendAssistantTranscriptAndExtract('New turn', 'stream-1');

      expect(mockPrisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-1' },
        data: { assistantTranscript: 'Previous turn\nNew turn' }
      });
    });

    it('skips DB writes when no call context', async () => {
      const events = makeEvents(null);
      const tm = new TranscriptManager(makeLogger(), events, 'CA123');
      await tm.appendAssistantTranscriptAndExtract('test', 'stream-1');

      expect(mockPrisma.call.update).not.toHaveBeenCalled();
      expect(mockExtract).not.toHaveBeenCalled();
    });
  });
});
