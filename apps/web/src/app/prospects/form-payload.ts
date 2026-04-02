export type ProspectSavePayload = {
  companyName: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  city: string | null;
  state: string | null;
  sourceLabel: string | null;
  serviceInterest: string | null;
  notes: string | null;
  status: string;
  priority: string | null;
  nextActionAt: string | null;
};

export function buildProspectSavePayload(formData: FormData): ProspectSavePayload {
  const nextActionAtRaw = String(formData.get('nextActionAt') ?? '').trim();

  return {
    companyName: String(formData.get('companyName') ?? '').trim(),
    contactName: String(formData.get('contactName') ?? '').trim() || null,
    contactPhone: String(formData.get('contactPhone') ?? '').trim() || null,
    contactEmail: String(formData.get('contactEmail') ?? '').trim() || null,
    city: String(formData.get('city') ?? '').trim() || null,
    state: String(formData.get('state') ?? '').trim() || null,
    sourceLabel: String(formData.get('sourceLabel') ?? '').trim() || null,
    serviceInterest: String(formData.get('serviceInterest') ?? '').trim() || null,
    notes: String(formData.get('notes') ?? '').trim() || null,
    status: String(formData.get('status') ?? ''),
    priority: String(formData.get('priority') ?? '') || null,
    nextActionAt: nextActionAtRaw ? new Date(nextActionAtRaw).toISOString() : null
  };
}
