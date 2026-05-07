import { NextRequest } from 'next/server';
import { proxyAcquisitionRequest } from '../../_proxy';

export async function DELETE(request: NextRequest) {
  return proxyAcquisitionRequest({
    request,
    path: '/v1/acquisition/leads/imported',
    method: 'DELETE'
  });
}
