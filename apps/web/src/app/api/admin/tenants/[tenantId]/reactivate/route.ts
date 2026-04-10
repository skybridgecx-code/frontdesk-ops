import { NextRequest } from 'next/server';
import { proxyAdminRequest } from '../../../_proxy';

type TenantRouteContext = {
  params: Promise<{ tenantId: string }> | { tenantId: string };
};

async function resolveTenantId(context: TenantRouteContext) {
  const params = await Promise.resolve(context.params);
  return params.tenantId;
}

export async function POST(request: NextRequest, context: TenantRouteContext) {
  const tenantId = await resolveTenantId(context);

  return proxyAdminRequest({
    request,
    path: `/v1/admin/tenants/${tenantId}/reactivate`,
    method: 'POST'
  });
}
