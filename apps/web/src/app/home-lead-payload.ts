export type PublicLeadPayload = {
  companyName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  city: string | null;
  state: string | null;
  serviceInterest: string | null;
  notes: string | null;
  sourceLabel: string;
  status: 'READY';
  priority: 'MEDIUM';
};

function normalizeText(value: FormDataEntryValue | null) {
  const normalized = String(value ?? '').trim();
  return normalized ? normalized : null;
}

export function buildPublicLeadPayload(formData: FormData): PublicLeadPayload {
  const companyName = normalizeText(formData.get('companyName'));
  const contactName = normalizeText(formData.get('contactName'));
  const contactPhone = normalizeText(formData.get('contactPhone'));
  const contactEmail = normalizeText(formData.get('contactEmail'));

  if (!companyName) {
    throw new Error('Company name is required');
  }

  if (!contactName && !contactPhone && !contactEmail) {
    throw new Error('Add at least one contact method');
  }

  return {
    companyName,
    contactName,
    contactPhone,
    contactEmail,
    city: normalizeText(formData.get('city')),
    state: normalizeText(formData.get('state')),
    serviceInterest: normalizeText(formData.get('serviceInterest')),
    notes: normalizeText(formData.get('notes')),
    sourceLabel: 'public_demo_request',
    status: 'READY',
    priority: 'MEDIUM'
  };
}
