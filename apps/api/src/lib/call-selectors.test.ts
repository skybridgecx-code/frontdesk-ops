import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCallScopeSql, buildCallScopeWhere, CALL_PRIORITY_ORDER_SQL, normalizeCallScopeQuery, REVIEW_NEXT_ELIGIBILITY_SQL } from './call-selectors.js';

function flattenSql(sql: { strings: ReadonlyArray<string> }) {
  return sql.strings.join('?');
}

test('normalizeCallScopeQuery keeps only valid scope fields and trims q', () => {
  const scope = normalizeCallScopeQuery({
    triageStatus: 'OPEN',
    reviewStatus: 'UNREVIEWED',
    urgency: 'high',
    q: '  basement flooding  '
  });

  assert.deepEqual(scope, {
    triageStatus: 'OPEN',
    reviewStatus: 'UNREVIEWED',
    urgency: 'high',
    q: 'basement flooding'
  });
});

test('normalizeCallScopeQuery drops invalid and empty scope fields', () => {
  const scope = normalizeCallScopeQuery({
    triageStatus: 'BROKEN',
    reviewStatus: 'PENDING',
    urgency: 'urgent',
    q: '   '
  });

  assert.deepEqual(scope, {});
});

test('buildCallScopeWhere produces the expected Prisma filter shape', () => {
  const where = buildCallScopeWhere({
    triageStatus: 'OPEN',
    reviewStatus: 'UNREVIEWED',
    urgency: 'high',
    q: 'reston'
  });

  assert.deepEqual(where, {
    triageStatus: 'OPEN',
    reviewStatus: 'UNREVIEWED',
    urgency: 'high',
    OR: [
      { twilioCallSid: { contains: 'reston', mode: 'insensitive' } },
      { fromE164: { contains: 'reston', mode: 'insensitive' } },
      { toE164: { contains: 'reston', mode: 'insensitive' } },
      { leadName: { contains: 'reston', mode: 'insensitive' } },
      { leadPhone: { contains: 'reston', mode: 'insensitive' } },
      { leadIntent: { contains: 'reston', mode: 'insensitive' } },
      { serviceAddress: { contains: 'reston', mode: 'insensitive' } },
      { summary: { contains: 'reston', mode: 'insensitive' } }
    ]
  });
});

test('buildCallScopeSql only emits SQL for the normalized scope fields', () => {
  const sql = buildCallScopeSql({
    triageStatus: 'OPEN',
    reviewStatus: 'UNREVIEWED',
    urgency: 'high',
    q: 'reston'
  });

  const flattened = flattenSql(sql);

  assert.match(flattened, /AND "triageStatus" = \?/);
  assert.match(flattened, /AND "reviewStatus" = \?/);
  assert.match(flattened, /AND "urgency" = \?/);
  assert.match(flattened, /"twilioCallSid" ILIKE \?/);
  assert.match(flattened, /OR "summary" ILIKE \?/);
  assert.deepEqual(sql.values, [
    'OPEN',
    'UNREVIEWED',
    'high',
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

test('review-next eligibility SQL locks in archive exclusion', () => {
  const sql = flattenSql(REVIEW_NEXT_ELIGIBILITY_SQL);

  assert.match(sql, /"reviewStatus" IN \('UNREVIEWED', 'NEEDS_REVIEW'\)/);
  assert.match(sql, /"triageStatus" != 'ARCHIVED'/);
  assert.match(sql, /"archivedAt" IS NULL/);
});

test('priority ordering SQL keeps OPEN before CONTACTED and UNREVIEWED before NEEDS_REVIEW before REVIEWED', () => {
  const sql = flattenSql(CALL_PRIORITY_ORDER_SQL);

  const openIndex = sql.indexOf("WHEN 'OPEN' THEN 0");
  const contactedIndex = sql.indexOf("WHEN 'CONTACTED' THEN 1");
  const unreviewedIndex = sql.indexOf("WHEN 'UNREVIEWED' THEN 0");
  const needsReviewIndex = sql.indexOf("WHEN 'NEEDS_REVIEW' THEN 1");
  const reviewedIndex = sql.indexOf("WHEN 'REVIEWED' THEN 2");
  const emergencyIndex = sql.indexOf("WHEN 'emergency' THEN 0");
  const highIndex = sql.indexOf("WHEN 'high' THEN 1");
  const startedAtIndex = sql.indexOf('"startedAt" ASC');
  const createdAtIndex = sql.indexOf('"createdAt" ASC');

  assert.ok(openIndex !== -1 && contactedIndex !== -1 && openIndex < contactedIndex);
  assert.ok(
    unreviewedIndex !== -1 &&
      needsReviewIndex !== -1 &&
      reviewedIndex !== -1 &&
      unreviewedIndex < needsReviewIndex &&
      needsReviewIndex < reviewedIndex
  );
  assert.ok(emergencyIndex !== -1 && highIndex !== -1 && emergencyIndex < highIndex);
  assert.ok(startedAtIndex !== -1 && createdAtIndex !== -1 && startedAtIndex < createdAtIndex);
});
