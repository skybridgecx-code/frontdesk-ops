import { NextRequest } from 'next/server';
import { proxyAcquisitionRequest } from '../../_proxy';

type LeadRouteContext = {
  params: Promise<{ leadId: string }> | { leadId: string };
};

async function resolveLeadId(context: LeadRouteContext) {
  const params = await context.params;
  return params.leadId;
}

export async function PATCH(request: NextRequest, context: LeadRouteContext) {
  const leadId = await resolveLeadId(context);
  const body = await request.json().catch(() => null);
  return proxyAcquisitionRequest({
    request,
    path: `/v1/acquisition/leads/${leadId}`,
    method: 'PATCH',
    body
  });
}
