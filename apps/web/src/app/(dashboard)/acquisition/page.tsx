import type { Metadata } from 'next';
import { AcquisitionClient } from './acquisition-client';

export const metadata: Metadata = {
  title: 'Sales Pipeline | SkyBridgeCX'
};

export default function AcquisitionPage() {
  return <AcquisitionClient />;
}
