/**
 * New lead email notification.
 *
 * Sent to configured operators when the AI extracts structured lead data
 * from a completed call. Contains the lead name, phone, intent, urgency,
 * address, and summary with a direct link to the call in the dashboard.
 */

import {
  isNotificationsConfigured,
  getNotificationEmails,
  getFromAddress,
  getDashboardUrl,
  getResendClient
} from './config.js';

export interface NewLeadEmailData {
  callSid: string;
  businessName: string;
  fromE164: string | null;
  leadName: string | null;
  leadPhone: string | null;
  leadIntent: string | null;
  urgency: string | null;
  serviceAddress: string | null;
  summary: string | null;
  callerTranscript: string | null;
  assistantTranscript: string | null;
  durationSeconds: number | null;
  answeredAt: Date | string | null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return 'Unknown';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return secs + 's';
  return mins + 'm ' + secs + 's';
}

function formatTime(date: Date | string | null): string {
  if (!date) return 'Unknown';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });
}

function urgencyColor(urgency: string | null): string {
  switch (urgency) {
    case 'emergency': return '#dc2626';
    case 'high': return '#ea580c';
    case 'medium': return '#ca8a04';
    default: return '#16a34a';
  }
}

function urgencyLabel(urgency: string | null): string {
  if (!urgency) return 'Not assessed';
  return urgency.charAt(0).toUpperCase() + urgency.slice(1);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function field(label: string, value: string | null): string {
  if (!value) return '';
  return '<tr><td style="padding:4px 12px 4px 0;color:#6b7280;font-size:14px;vertical-align:top;">' + escapeHtml(label) + '</td><td style="padding:4px 0;font-size:14px;">' + escapeHtml(value) + '</td></tr>';
}

function buildEmailHtml(data: NewLeadEmailData): string {
  const dashboardUrl = getDashboardUrl();
  const callUrl = dashboardUrl + '/calls/' + encodeURIComponent(data.callSid);
  const uColor = urgencyColor(data.urgency);
  const uLabel = urgencyLabel(data.urgency);

  const fields = [
    field('Caller', data.fromE164 ?? 'Unknown number'),
    field('Lead Name', data.leadName),
    field('Lead Phone', data.leadPhone),
    field('Intent', data.leadIntent),
    field('Address', data.serviceAddress),
    field('Duration', formatDuration(data.durationSeconds)),
    field('Time', formatTime(data.answeredAt))
  ].filter(Boolean).join('');

  const summaryBlock = data.summary
    ? '<div style="margin:16px 0;padding:12px 16px;background:#f9fafb;border-radius:8px;font-size:14px;line-height:1.5;color:#374151;">' + escapeHtml(data.summary) + '</div>'
    : '';

  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;">'
    + '<div style="max-width:600px;margin:0 auto;padding:24px 16px;">'
    + '<div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">'

    + '<div style="padding:24px 24px 16px;border-bottom:1px solid #e5e7eb;">'
    + '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">'
    + '<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:' + uColor + ';"></span>'
    + '<span style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:' + uColor + ';">' + escapeHtml(uLabel) + ' URGENCY</span>'
    + '</div>'
    + '<h1 style="margin:0;font-size:20px;font-weight:600;color:#111827;">New Lead from Call</h1>'
    + '<p style="margin:4px 0 0;font-size:14px;color:#6b7280;">' + escapeHtml(data.businessName) + '</p>'
    + '</div>'

    + '<div style="padding:20px 24px;">'
    + '<table style="width:100%;border-collapse:collapse;">' + fields + '</table>'
    + summaryBlock
    + '</div>'

    + '<div style="padding:16px 24px 24px;text-align:center;">'
    + '<a href="' + escapeHtml(callUrl) + '" style="display:inline-block;padding:12px 32px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">View Call Details</a>'
    + '</div>'

    + '</div>'
    + '<p style="text-align:center;margin:16px 0 0;font-size:12px;color:#9ca3af;">Sent by Frontdesk OS</p>'
    + '</div>'
    + '</body></html>';
}

function buildEmailText(data: NewLeadEmailData): string {
  const dashboardUrl = getDashboardUrl();
  const callUrl = dashboardUrl + '/calls/' + encodeURIComponent(data.callSid);
  const lines = [
    'New Lead from Call - ' + urgencyLabel(data.urgency) + ' Urgency',
    data.businessName,
    '',
    'Caller: ' + (data.fromE164 ?? 'Unknown'),
    data.leadName ? 'Lead Name: ' + data.leadName : null,
    data.leadPhone ? 'Lead Phone: ' + data.leadPhone : null,
    data.leadIntent ? 'Intent: ' + data.leadIntent : null,
    data.serviceAddress ? 'Address: ' + data.serviceAddress : null,
    'Duration: ' + formatDuration(data.durationSeconds),
    'Time: ' + formatTime(data.answeredAt),
    '',
    data.summary ? 'Summary: ' + data.summary : null,
    '',
    'View call: ' + callUrl
  ];
  return lines.filter((l) => l !== null).join('\n');
}

export async function sendNewLeadEmail(data: NewLeadEmailData): Promise<{ sent: boolean; error?: string }> {
  if (!isNotificationsConfigured()) {
    return { sent: false, error: 'Notifications not configured (missing RESEND_API_KEY or NOTIFICATION_EMAILS)' };
  }

  try {
    const resend = await getResendClient();
    const to = getNotificationEmails();
    const subject = data.urgency === 'emergency' || data.urgency === 'high'
      ? '[' + urgencyLabel(data.urgency) + '] New lead: ' + (data.leadName ?? data.fromE164 ?? 'Unknown caller')
      : 'New lead: ' + (data.leadName ?? data.fromE164 ?? 'Unknown caller');

    await resend.emails.send({
      from: getFromAddress(),
      to,
      subject,
      html: buildEmailHtml(data),
      text: buildEmailText(data)
    });

    return { sent: true };
  } catch (error) {
    return { sent: false, error: String(error) };
  }
}
