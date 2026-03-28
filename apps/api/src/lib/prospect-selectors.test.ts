import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProspectScopeSql,
  buildProspectScopeWhere,
  normalizeProspectScopeQuery,
  PROSPECT_PRIORITY_ORDER_SQL,
  REVIEW_NEXT_PROSPECT_ELIGIBILITY_SQL
} from './prospect-selectors.js';

function flattenSql(value: { strings?: ReadonlyArray<string>; values?: unknown[] }) {
  return {
    text: (value.strings ?? []).join('?'),
    values: value.values ?? []
  };
}

test('normalizeProspectScopeQuery keeps only valid scope fields and trims q', () => {
  assert.deepEqual(
    normalizeProspectScopeQuery({
      status: 'READY',
      priority: 'HIGH',
      q: '  reston dental  '
    }),
    {
      status: 'READY',
      priority: 'HIGH',
      q: 'reston dental'
    }
  );
});

test('normalizeProspectScopeQuery drops invalid and empty scope fields', () => {
  assert.deepEqual(
    normalizeProspectScopeQuery({
      status: 'INVALID',
      priority: 'urgent',
      q: '   '
    }),
    {}
  );
});

test('buildProspectScopeWhere produces the expected Prisma filter shape', () => {
  assert.deepEqual(
    buildProspectScopeWhere({
      status: 'READY',
      priority: 'HIGH',
      q: 'reston'
    }),
    {
      status: 'READY',
      priority: 'HIGH',
      OR: [
        { prospectSid: { contains: 'reston', mode: 'insensitive' } },
        { companyName: { contains: 'reston', mode: 'insensitive' } },
        { contactName: { contains: 'reston', mode: 'insensitive' } },
        { contactPhone: { contains: 'reston', mode: 'insensitive' } },
        { contactEmail: { contains: 'reston', mode: 'insensitive' } },
        { city: { contains: 'reston', mode: 'insensitive' } },
        { state: { contains: 'reston', mode: 'insensitive' } },
        { sourceLabel: { contains: 'reston', mode: 'insensitive' } },
        { serviceInterest: { contains: 'reston', mode: 'insensitive' } },
        { notes: { contains: 'reston', mode: 'insensitive' } }
      ]
    }
  );
});

test('buildProspectScopeSql only emits SQL for the normalized scope fields', () => {
  const flattened = flattenSql(
    buildProspectScopeSql({
      status: 'READY',
      priority: 'HIGH',
      q: 'reston'
    })
  );

  assert.match(flattened.text, /"status" = \?/);
  assert.match(flattened.text, /"priority" = \?/);
  assert.match(flattened.text, /"prospectSid" ILIKE \?/);
  assert.deepEqual(flattened.values, [
    'READY',
    'HIGH',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%',
    '%reston%'
  ]);
});

test('review-next prospect eligibility SQL locks in archive exclusion', () => {
  const flattened = flattenSql(REVIEW_NEXT_PROSPECT_ELIGIBILITY_SQL);
  assert.match(flattened.text, /"status" IN \('READY', 'NEW', 'ATTEMPTED'\)/);
  assert.match(flattened.text, /"archivedAt" IS NULL/);
  assert.match(flattened.text, /"status" != 'ARCHIVED'/);
});

test('prospect priority ordering SQL keeps READY before NEW before ATTEMPTED and high before medium before low', () => {
  const flattened = flattenSql(PROSPECT_PRIORITY_ORDER_SQL);
  assert.match(flattened.text, /WHEN 'READY' THEN 0/);
  assert.match(flattened.text, /WHEN 'NEW' THEN 1/);
  assert.match(flattened.text, /WHEN 'ATTEMPTED' THEN 2/);
  assert.match(flattened.text, /WHEN 'HIGH' THEN 0/);
  assert.match(flattened.text, /WHEN 'MEDIUM' THEN 1/);
  assert.match(flattened.text, /"nextActionAt" ASC/);
  assert.match(flattened.text, /"createdAt" ASC/);
});
