import type { Metadata } from 'next';
import { RidgelineRoofingDemoDashboard } from './demo-dashboard-client';

export const metadata: Metadata = {
  title: 'Ridgeline Roofing Demo Dashboard | SkyBridgeCX',
  description: 'Sample SkyBridgeCX roofing workflow dashboard using demo data only.'
};

export default function RidgelineRoofingDemoPage() {
  return <RidgelineRoofingDemoDashboard />;
}
