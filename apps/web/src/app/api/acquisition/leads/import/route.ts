import { NextRequest } from 'next/server';
import { proxyAcquisitionRequest } from '../../_proxy';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  return proxyAcquisitionRequest({
    request,
    path: '/v1/acquisition/leads/import',
    method: 'POST',
    body
  });
}
