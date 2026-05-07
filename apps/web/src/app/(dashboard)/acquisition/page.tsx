import type { Metadata } from 'next';
import { AcquisitionClient } from './acquisition-client';

export const metadata: Metadata = {
  title: 'Client Acquisition | SkyBridgeCX'
};

export default function AcquisitionPage() {
  return <AcquisitionClient />;
}
