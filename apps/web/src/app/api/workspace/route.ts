import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { FRONTDESK_WORKSPACE_COOKIE } from '@/lib/workspace';

type WorkspaceRequestBody = {
  tenantId?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as WorkspaceRequestBody;
  const tenantId = body.tenantId?.trim() ?? '';
  const cookieStore = await cookies();

  if (!tenantId) {
    cookieStore.delete(FRONTDESK_WORKSPACE_COOKIE);
    return NextResponse.json({ ok: true, tenantId: null });
  }

  cookieStore.set(FRONTDESK_WORKSPACE_COOKIE, tenantId, {
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365
  });

  return NextResponse.json({ ok: true, tenantId });
}
