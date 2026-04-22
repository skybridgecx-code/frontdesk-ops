import type { Metadata } from 'next';
import { OnboardingWizardClient } from './onboarding-wizard-client';

export const metadata: Metadata = {
  title: 'Onboarding | SkyBridgeCX'
};

export default function OnboardingPage() {
  return <OnboardingWizardClient />;
}
