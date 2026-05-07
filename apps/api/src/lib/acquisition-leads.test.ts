import { describe, expect, it } from 'vitest';
import {
  dedupeImportedAcquisitionLeads,
  dedupeLeadIdentityKey,
  normalizeWebsiteKey,
  prepareImportedAcquisitionLead
} from './acquisition-leads.js';

describe('acquisition lead import helpers', () => {
  it('normalizes website for dedupe', () => {
    expect(normalizeWebsiteKey('https://www.Example.com/')).toBe('example.com');
  });

  it('falls back dedupe key to business + location when website is missing', () => {
    const key = dedupeLeadIdentityKey({
      businessName: ' Summit HVAC ',
      location: ' North Market ',
      website: null
    });
    expect(key).toBe('n:summit hvac|north market');
  });

  it('applies safe default pipeline values', () => {
    const prepared = prepareImportedAcquisitionLead({
      businessName: 'Demo Plumbing',
      location: 'East Bay'
    });

    expect(prepared).toEqual(
      expect.objectContaining({
        businessName: 'Demo Plumbing',
        location: 'East Bay',
        stage: 'Researching',
        outreachStatus: 'Not contacted',
        demoStatus: 'Not booked',
        offerStage: 'Not proposed',
        source: 'Imported lead file'
      })
    );
  });

  it('deduplicates by website first and then business + location', () => {
    const deduped = dedupeImportedAcquisitionLeads({
      existing: [
        { businessName: 'A One', location: 'North', website: 'aone.example' },
        { businessName: 'B Two', location: 'West', website: null }
      ],
      incoming: [
        { businessName: 'A One Duplicate', location: 'Elsewhere', website: 'https://www.aone.example/' },
        { businessName: 'B Two', location: 'West', website: null },
        { businessName: 'C Three', location: 'South', website: '' }
      ]
    });

    expect(deduped.prepared).toHaveLength(1);
    expect(deduped.prepared[0]?.businessName).toBe('C Three');
    expect(deduped.skipped).toBe(2);
  });
});
