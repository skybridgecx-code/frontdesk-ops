import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NewLeadEmailData } from './new-lead-email.js';

const mockSend = vi.fn().mockResolvedValue({ id: 'email_123' });

vi.mock('./config.js', () => ({
  isNotificationsConfigured: vi.fn().mockReturnValue(true),
  getNotificationEmails: vi.fn().mockReturnValue(['operator@test.com']),
  getFromAddress: vi.fn().mockReturnValue('Test <test@test.com>'),
  getDashboardUrl: vi.fn().mockReturnValue('https://app.test.com'),
  getResendClient: vi.fn().mockResolvedValue({
    emails: { send: mockSend }
  })
}));

const sampleData: NewLeadEmailData = {
  callSid: 'CA_test_123',
  businessName: 'Patriot HVAC',
  fromE164: '+15551234567',
  leadName: 'John Smith',
  leadPhone: '+15559876543',
  leadIntent: 'AC repair',
  urgency: 'high',
  serviceAddress: '123 Main St, Reston VA',
  summary: 'Caller needs AC repair. Unit is not cooling. Available tomorrow morning.',
  callerTranscript: 'Hi, my AC is broken...',
  assistantTranscript: 'I can help with that...',
  durationSeconds: 145,
  answeredAt: '2026-04-07T14:30:00.000Z'
};

describe('sendNewLeadEmail', () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it('sends email with correct recipient and subject for high urgency', async () => {
    const { sendNewLeadEmail } = await import('./new-lead-email.js');
    const result = await sendNewLeadEmail(sampleData);

    expect(result.sent).toBe(true);
    expect(mockSend).toHaveBeenCalledOnce();

    const call = mockSend.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.to).toEqual(['operator@test.com']);
    expect(call.from).toBe('Test <test@test.com>');
    expect(call.subject).toContain('[High]');
    expect(call.subject).toContain('John Smith');
  });

  it('sends email with plain subject for low urgency', async () => {
    const { sendNewLeadEmail } = await import('./new-lead-email.js');
    await sendNewLeadEmail({ ...sampleData, urgency: 'low' });

    const call = mockSend.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.subject).not.toContain('[');
    expect(call.subject).toContain('John Smith');
  });

  it('uses fromE164 in subject when leadName is null', async () => {
    const { sendNewLeadEmail } = await import('./new-lead-email.js');
    await sendNewLeadEmail({ ...sampleData, leadName: null });

    const call = mockSend.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.subject).toContain('+15551234567');
  });

  it('includes call link in HTML body', async () => {
    const { sendNewLeadEmail } = await import('./new-lead-email.js');
    await sendNewLeadEmail(sampleData);

    const call = mockSend.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.html).toContain('https://app.test.com/calls/CA_test_123');
  });

  it('includes call link in text body', async () => {
    const { sendNewLeadEmail } = await import('./new-lead-email.js');
    await sendNewLeadEmail(sampleData);

    const call = mockSend.mock.calls[0]![0] as Record<string, unknown>;
    expect(call.text).toContain('https://app.test.com/calls/CA_test_123');
  });

  it('includes all lead fields in HTML', async () => {
    const { sendNewLeadEmail } = await import('./new-lead-email.js');
    await sendNewLeadEmail(sampleData);

    const call = mockSend.mock.calls[0]![0] as Record<string, unknown>;
    const html = call.html as string;
    expect(html).toContain('John Smith');
    expect(html).toContain('+15559876543');
    expect(html).toContain('AC repair');
    expect(html).toContain('123 Main St');
    expect(html).toContain('Patriot HVAC');
    expect(html).toContain('not cooling');
  });

  it('returns sent: false when not configured', async () => {
    const configMock = await import('./config.js');
    vi.mocked(configMock.isNotificationsConfigured).mockReturnValueOnce(false);

    const { sendNewLeadEmail } = await import('./new-lead-email.js');
    const result = await sendNewLeadEmail(sampleData);

    expect(result.sent).toBe(false);
    expect(result.error).toContain('not configured');
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns sent: false on Resend error', async () => {
    mockSend.mockRejectedValueOnce(new Error('Resend API error'));

    const { sendNewLeadEmail } = await import('./new-lead-email.js');
    const result = await sendNewLeadEmail(sampleData);

    expect(result.sent).toBe(false);
    expect(result.error).toContain('Resend API error');
  });
});
