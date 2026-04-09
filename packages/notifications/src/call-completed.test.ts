import { describe, it, expect, vi } from 'vitest';

const mockSendNewLeadEmail = vi.fn().mockResolvedValue({ sent: true });

vi.mock('./new-lead-email.js', () => ({
  sendNewLeadEmail: mockSendNewLeadEmail
}));

describe('sendCallCompletedNotification', () => {
  it('delegates to sendNewLeadEmail with correct fields', async () => {
    const { sendCallCompletedNotification } = await import('./call-completed.js');

    const input = {
      callId: 'call_123',
      callSid: 'CA_test',
      businessName: 'Test HVAC',
      fromE164: '+15551234567',
      leadName: 'Jane Doe',
      leadPhone: null,
      leadIntent: 'Furnace repair',
      urgency: 'medium' as const,
      serviceAddress: null,
      summary: 'Needs furnace looked at.',
      callerTranscript: 'My furnace...',
      assistantTranscript: 'Let me help...',
      durationSeconds: 90,
      answeredAt: null
    };

    const result = await sendCallCompletedNotification(input);

    expect(result.sent).toBe(true);
    expect(mockSendNewLeadEmail).toHaveBeenCalledWith({
      callSid: 'CA_test',
      businessName: 'Test HVAC',
      fromE164: '+15551234567',
      leadName: 'Jane Doe',
      leadPhone: null,
      leadIntent: 'Furnace repair',
      urgency: 'medium',
      serviceAddress: null,
      summary: 'Needs furnace looked at.',
      callerTranscript: 'My furnace...',
      assistantTranscript: 'Let me help...',
      durationSeconds: 90,
      answeredAt: null
    });
  });
});
