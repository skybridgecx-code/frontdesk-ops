import type { PublicLeadPayload } from './home-lead-payload';

const DEFAULT_APP_BASE_URL = 'http://127.0.0.1:3001';
const READY_QUEUE_PATH = '/prospects?status=READY';

export type OperatorLeadWebhookPayload = {
  text: string;
  event: 'public_demo_request.created';
  sourceLabel: string;
  companyName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  city: string | null;
  state: string | null;
  serviceInterest: string | null;
  notes: string | null;
  links: {
    queueUrl: string;
    prospectUrl: string;
  };
};

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function buildOperatorLeadWebhookPayload(input: {
  prospectSid: string;
  lead: PublicLeadPayload;
  appBaseUrl?: string;
}): OperatorLeadWebhookPayload {
  const appBaseUrl = trimTrailingSlash(input.appBaseUrl ?? DEFAULT_APP_BASE_URL);
  const queueUrl = `${appBaseUrl}${READY_QUEUE_PATH}`;
  const prospectUrl = `${appBaseUrl}/prospects/${input.prospectSid}?returnTo=${encodeURIComponent(READY_QUEUE_PATH)}`;
  const textParts = [
    `New public demo request: ${input.lead.companyName}`,
    `Queue: ${queueUrl}`,
    `Prospect: ${prospectUrl}`,
    input.lead.contactName ? `Contact: ${input.lead.contactName}` : null,
    input.lead.contactPhone ? `Phone: ${input.lead.contactPhone}` : null,
    input.lead.contactEmail ? `Email: ${input.lead.contactEmail}` : null,
    input.lead.serviceInterest ? `Interest: ${input.lead.serviceInterest}` : null,
    input.lead.notes ? `Notes: ${input.lead.notes}` : null
  ].filter(Boolean);

  return {
    text: textParts.join('\n'),
    event: 'public_demo_request.created',
    sourceLabel: input.lead.sourceLabel,
    companyName: input.lead.companyName,
    contactName: input.lead.contactName,
    contactPhone: input.lead.contactPhone,
    contactEmail: input.lead.contactEmail,
    city: input.lead.city,
    state: input.lead.state,
    serviceInterest: input.lead.serviceInterest,
    notes: input.lead.notes,
    links: {
      queueUrl,
      prospectUrl
    }
  };
}
