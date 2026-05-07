import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentTenant } from '@/lib/tenant';
import { AcquisitionClient } from './acquisition-client';

export const metadata: Metadata = {
  title: 'Sales Pipeline | SkyBridgeCX'
};

export default async function AcquisitionPage() {
  const tenant = await getCurrentTenant();

  if (tenant?.slug === 'skybridge-demo') {
    redirect('/dashboard');
  }

  return <AcquisitionClient workspaceSlug={tenant?.slug ?? null} />;
}
