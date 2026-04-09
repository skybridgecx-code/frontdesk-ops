import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStarterProspectImportBody,
  mapStarterProspectCsvRows,
  parseStarterProspectCsv
} from './prospect-csv-import';

test('parseStarterProspectCsv reads the starter import headers', () => {
  const rows = parseStarterProspectCsv(
    [
      'company,trade,city,website,phone,email,address,notes',
      'Patriot Plumbing,Plumbing,"Houston, TX",https://patriot.example,713-555-0100,owner@example.com,123 Main St,After-hours leak'
    ].join('\n')
  );

  assert.deepEqual(rows, [
    {
      company: 'Patriot Plumbing',
      trade: 'Plumbing',
      city: 'Houston, TX',
      website: 'https://patriot.example',
      phone: '713-555-0100',
      email: 'owner@example.com',
      address: '123 Main St',
      notes: 'After-hours leak'
    }
  ]);
});

test('mapStarterProspectCsvRows preserves unsupported fields in notes and parses city/state', () => {
  const mapped = mapStarterProspectCsvRows([
    {
      company: 'Patriot Plumbing',
      trade: 'Plumbing',
      city: 'Houston, TX',
      website: 'https://patriot.example',
      phone: '713-555-0100',
      email: 'owner@example.com',
      address: '123 Main St',
      notes: 'After-hours leak'
    }
  ]);

  assert.deepEqual(mapped, [
    {
      companyName: 'Patriot Plumbing',
      contactPhone: '713-555-0100',
      contactEmail: 'owner@example.com',
      city: 'Houston',
      state: 'TX',
      serviceInterest: 'Plumbing',
      notes: 'After-hours leak\nWebsite: https://patriot.example\nAddress: 123 Main St'
    }
  ]);
});

test('buildStarterProspectImportBody uses the houston starter source label', () => {
  assert.deepEqual(
    buildStarterProspectImportBody([
      {
        company: 'Patriot Plumbing',
        trade: null,
        city: null,
        website: null,
        phone: null,
        email: null,
        address: null,
        notes: null
      }
    ]),
    {
      defaultSourceLabel: 'houston_starter_list',
      prospects: [
        {
          companyName: 'Patriot Plumbing',
          contactPhone: null,
          contactEmail: null,
          city: null,
          state: null,
          serviceInterest: null,
          notes: null
        }
      ]
    }
  );
});
