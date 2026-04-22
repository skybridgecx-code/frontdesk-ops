import type { Metadata } from 'next';
import { getCurrentTenant, getOnboardingStatus } from '@/lib/tenant';
import { EmptyState } from '../../components/empty-state';
import { PhoneSetupFlow } from './phone-setup-flow';

export const metadata: Metadata = {
  title: 'Phone Setup | SkyBridgeCX'
};

export const dynamic = 'force-dynamic';

export default async function PhoneSetupPage() {
  const [tenant, onboardingStatus] = await Promise.all([getCurrentTenant(), getOnboardingStatus()]);

  if (!tenant) {
    return (
      <EmptyState
        title="Phone setup unavailable"
        description="Your account is not linked to a tenant yet. Contact support if this persists."
      />
    );
  }

  const businesses = tenant.businesses.map((business) => ({
    id: business.id,
    name: business.name
  }));

  return (
    <PhoneSetupFlow
      tenantName={tenant.name}
      businesses={businesses}
      hasPhoneNumbers={Boolean(onboardingStatus?.hasPhoneNumbers)}
    />
  );
}
