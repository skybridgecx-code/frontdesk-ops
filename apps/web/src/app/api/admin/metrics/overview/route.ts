import { NextRequest } from 'next/server';
import { proxyAdminRequest } from '../../_proxy';

export async function GET(request: NextRequest) {
  return proxyAdminRequest({
    request,
    path: '/v1/admin/metrics/overview',
    method: 'GET'
  });
}
