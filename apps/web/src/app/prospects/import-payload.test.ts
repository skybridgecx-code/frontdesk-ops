import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApolloImportPayload, buildGooglePlacesImportPayload } from './import-payload';

test('buildGooglePlacesImportPayload trims fields and applies bounded defaults', () => {
  const formData = new FormData();
  formData.set('textQuery', ' dentists in Reston VA ');
  formData.set('pageSize', '99');
  formData.set('includedType', ' dentist ');
  formData.set('serviceInterest', 'Commercial HVAC');

  assert.deepEqual(buildGooglePlacesImportPayload(formData), {
    textQuery: 'dentists in Reston VA',
    pageSize: 20,
    includedType: 'dentist',
    serviceInterest: 'Commercial HVAC',
    defaultStatus: 'READY',
    defaultPriority: 'HIGH'
  });
});

test('buildApolloImportPayload parses comma lists and rejects empty filters', () => {
  const formData = new FormData();
  formData.set('qKeywords', ' dentists ');
  formData.set('personTitles', 'operations manager, office manager,  ');
  formData.set('organizationLocations', 'Virginia, US\nMaryland, US');
  formData.set('perPage', '12');

  assert.deepEqual(buildApolloImportPayload(formData), {
    qKeywords: 'dentists',
    personTitles: ['operations manager', 'office manager'],
    organizationLocations: ['Virginia, US', 'Maryland, US'],
    perPage: 12,
    defaultStatus: 'READY',
    defaultPriority: 'MEDIUM'
  });

  const invalid = new FormData();
  assert.throws(() => buildApolloImportPayload(invalid), /at least one search filter/);
});
