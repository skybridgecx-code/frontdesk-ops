import { NextRequest } from 'next/server';
import { proxyAcquisitionRequest } from '../../_proxy';

export async function GET(request: NextRequest) {
  return proxyAcquisitionRequest({
    request,
    path: '/v1/acquisition/leads/summary',
    method: 'GET'
  });
}
