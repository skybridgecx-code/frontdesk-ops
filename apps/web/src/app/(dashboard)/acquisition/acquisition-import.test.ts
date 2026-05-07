import assert from 'node:assert/strict';
import test from 'node:test';
import { acquisitionTargets } from './acquisition-data';
import { buildImportPreview, mapCsvRowsToTargets, mergeImportedTargets, parseCsvText } from './acquisition-import';

test('csv import maps expected columns and default pipeline fields', () => {
  const csv = [
    '#,Company Name,Market,Services,Phone,Email,Website,Years in Business,Notes',
    '1,Demo Heating Co,North Metro,HVAC,+15550001111,owner@demoheating.test,https://demoheating.test,12,Needs faster callback process'
  ].join('\n');

  const parsed = parseCsvText(csv);
  const mapped = mapCsvRowsToTargets(parsed.headers, parsed.rows);

  assert.equal(mapped.length, 1);
  assert.equal(mapped[0]?.businessName, 'Demo Heating Co');
  assert.equal(mapped[0]?.location, 'North Metro');
  assert.equal(mapped[0]?.vertical, 'HVAC');
  assert.equal(mapped[0]?.stage, 'Researching');
  assert.equal(mapped[0]?.outreachStatus, 'Not contacted');
  assert.equal(mapped[0]?.demoStatus, 'Not booked');
  assert.equal(mapped[0]?.offerStage, 'Not proposed');
  assert.equal(mapped[0]?.source, 'Imported lead file');
});

test('dedupe prefers website, then company+location fallback', () => {
  const csv = [
    '#,Company Name,Market,Services,Phone,Email,Website,Years in Business,Notes',
    '1,Summit Peak Roofing Demo Co.,Maple Ridge,Roofing,+15550001111,owner@summit.test,summitpeak-demo.example,8,Duplicate of sample by website',
    '2,Unique Demo Partner,East Bay,Plumbing,+15550002222,owner@unique.test,,4,No website uses company+location key',
    '3,Unique Demo Partner,East Bay,Plumbing,+15550003333,owner2@unique.test,,6,Duplicate by company+location'
  ].join('\n');

  const parsed = parseCsvText(csv);
  const mapped = mapCsvRowsToTargets(parsed.headers, parsed.rows);
  const merged = mergeImportedTargets(acquisitionTargets, mapped);

  assert.equal(merged.addedCount, 1);
  assert.equal(merged.skippedCount, 2);
});

test('preview stats include sample rows and missing field counts', () => {
  const csv = [
    '#,Company Name,Market,Services,Phone,Email,Website,Years in Business,Notes',
    '1,A One,North,Roofing,,a@one.test,,1,',
    '2,A Two,South,HVAC,+15550004444,,two.test,2,',
    '3,A Three,West,Plumbing,,,,3,'
  ].join('\n');
  const parsed = parseCsvText(csv);
  const mapped = mapCsvRowsToTargets(parsed.headers, parsed.rows);
  const preview = buildImportPreview(mapped);

  assert.equal(preview.parsedRows, 3);
  assert.equal(preview.sampleRows.length, 3);
  assert.equal(preview.missingPhone, 2);
  assert.equal(preview.missingEmail, 2);
  assert.equal(preview.missingWebsite, 2);
});
