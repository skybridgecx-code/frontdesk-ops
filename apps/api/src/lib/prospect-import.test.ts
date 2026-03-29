import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ProspectPriority, ProspectSourceProvider, ProspectStatus, prisma } from '@frontdesk/db';
import { importProspectsForBusiness } from './prospect-import.js';

type PrismaStubSet = Partial<{
  businessFindFirst: typeof prisma.business.findFirst;
  prospectFindFirst: typeof prisma.prospect.findFirst;
  prospectCreate: typeof prisma.prospect.create;
  prospectUpdate: typeof prisma.prospect.update;
  prospectImportBatchCreate: typeof prisma.prospectImportBatch.create;
  prospectImportBatchUpdate: typeof prisma.prospectImportBatch.update;
}>;

function stubPrisma(stubs: PrismaStubSet) {
  const original = {
    businessFindFirst: prisma.business.findFirst,
    prospectFindFirst: prisma.prospect.findFirst,
    prospectCreate: prisma.prospect.create,
    prospectUpdate: prisma.prospect.update,
    prospectImportBatchCreate: prisma.prospectImportBatch.create,
    prospectImportBatchUpdate: prisma.prospectImportBatch.update
  };

  if (stubs.businessFindFirst) prisma.business.findFirst = stubs.businessFindFirst;
  if (stubs.prospectFindFirst) prisma.prospect.findFirst = stubs.prospectFindFirst;
  if (stubs.prospectCreate) prisma.prospect.create = stubs.prospectCreate;
  if (stubs.prospectUpdate) prisma.prospect.update = stubs.prospectUpdate;
  if (stubs.prospectImportBatchCreate) prisma.prospectImportBatch.create = stubs.prospectImportBatchCreate;
  if (stubs.prospectImportBatchUpdate) prisma.prospectImportBatch.update = stubs.prospectImportBatchUpdate;

  return () => {
    prisma.business.findFirst = original.businessFindFirst;
    prisma.prospect.findFirst = original.prospectFindFirst;
    prisma.prospect.create = original.prospectCreate;
    prisma.prospect.update = original.prospectUpdate;
    prisma.prospectImportBatch.create = original.prospectImportBatchCreate;
    prisma.prospectImportBatch.update = original.prospectImportBatchUpdate;
  };
}

test('importProspectsForBusiness creates new prospects with provenance and import batch counts', async (t) => {
  let capturedCreateData: Record<string, unknown> | null = null;
  let capturedBatchUpdateData: unknown;

  const restore = stubPrisma({
    businessFindFirst: (async () => ({ id: 'biz_demo', tenantId: 'tenant_demo' })) as typeof prisma.business.findFirst,
    prospectFindFirst: (async () => null) as typeof prisma.prospect.findFirst,
    prospectImportBatchCreate: ((async () => ({ id: 'batch_demo' })) as unknown) as typeof prisma.prospectImportBatch.create,
    prospectImportBatchUpdate: (async (args?: unknown) => {
      capturedBatchUpdateData = (args as { data?: unknown } | undefined)?.data;
      return { id: 'batch_demo' };
    }) as typeof prisma.prospectImportBatch.update,
    prospectCreate: (async (args?: unknown) => {
      capturedCreateData = ((args as { data?: Record<string, unknown> } | undefined)?.data ?? null) as Record<
        string,
        unknown
      > | null;
      return { prospectSid: 'PR_CREATED_1' };
    }) as typeof prisma.prospect.create
  });
  t.after(restore);

  const result = await importProspectsForBusiness({
    tenantId: 'tenant_demo',
    businessId: 'biz_demo',
    sourceProvider: ProspectSourceProvider.GOOGLE_PLACES,
    prospects: [
      {
        companyName: 'Reston Family Dental',
        contactPhone: '(703) 555-0101',
        sourceLabel: 'google_places',
        sourceProviderRecordId: 'places/abc123',
        sourceWebsiteUrl: 'https://restondental.example',
        sourceMapsUrl: 'https://maps.google.com/?cid=demo',
        sourceCategory: 'Dentist',
        sourceMetadataJson: {
          formattedAddress: '123 Main St, Reston, VA 20190'
        },
        status: ProspectStatus.READY,
        priority: ProspectPriority.HIGH
      }
    ]
  });

  assert.ok(capturedCreateData);
  const createdData = capturedCreateData as unknown as Record<string, unknown>;
  assert.equal(createdData.sourceProvider, ProspectSourceProvider.GOOGLE_PLACES);
  assert.equal(createdData.sourceProviderRecordId, 'places/abc123');
  assert.equal(createdData.sourceWebsiteUrl, 'https://restondental.example');
  assert.equal(createdData.sourceMapsUrl, 'https://maps.google.com/?cid=demo');
  assert.equal(createdData.sourceCategory, 'Dentist');
  assert.equal(createdData.lastImportBatchId, 'batch_demo');
  assert.equal(createdData.notes, null);
  assert.ok(createdData.firstSeenAt instanceof Date);
  assert.ok(createdData.lastSeenAt instanceof Date);
  assert.ok(typeof createdData.sourceFingerprint === 'string');
  assert.deepEqual(capturedBatchUpdateData, {
    createdCount: 1,
    updatedCount: 0,
    skippedCount: 0
  });
  assert.deepEqual(result, {
    importBatchId: 'batch_demo',
    importedCount: 1,
    createdCount: 1,
    updatedCount: 0,
    skippedCount: 0,
    prospects: [
      {
        prospectSid: 'PR_CREATED_1',
        companyName: 'Reston Family Dental',
        status: ProspectStatus.READY,
        priority: ProspectPriority.HIGH,
        sourceLabel: 'google_places',
        result: 'created'
      }
    ]
  });
});

test('importProspectsForBusiness updates a re-seen provider record without overwriting operator notes or workflow state', async (t) => {
  let capturedFindWhere: unknown;
  let capturedUpdateData: unknown;
  let capturedBatchUpdateData: unknown;

  const restore = stubPrisma({
    businessFindFirst: (async () => ({ id: 'biz_demo', tenantId: 'tenant_demo' })) as typeof prisma.business.findFirst,
    prospectFindFirst: (async (args?: unknown) => {
      capturedFindWhere = (args as { where?: unknown } | undefined)?.where;
      return {
        id: 'prospect_1',
        prospectSid: 'PR_EXISTING_1',
        companyName: 'Reston Family Dental',
        contactName: null,
        contactPhone: null,
        contactEmail: null,
        city: null,
        state: null,
        sourceLabel: 'google_places',
        sourceWebsiteUrl: null,
        sourceMapsUrl: null,
        sourceLinkedinUrl: null,
        sourceCategory: null,
        sourceRoleTitle: null,
        sourceProviderRecordId: null,
        sourceFingerprint: 'oldfingerprint',
        sourceMetadataJson: null,
        serviceInterest: null,
        notes: 'Operator-owned note',
        status: ProspectStatus.ATTEMPTED,
        priority: ProspectPriority.HIGH
      };
    }) as typeof prisma.prospect.findFirst,
    prospectImportBatchCreate: ((async () => ({ id: 'batch_demo' })) as unknown) as typeof prisma.prospectImportBatch.create,
    prospectImportBatchUpdate: (async (args?: unknown) => {
      capturedBatchUpdateData = (args as { data?: unknown } | undefined)?.data;
      return { id: 'batch_demo' };
    }) as typeof prisma.prospectImportBatch.update,
    prospectUpdate: (async (args?: unknown) => {
      capturedUpdateData = (args as { data?: unknown } | undefined)?.data;
      return { id: 'prospect_1' };
    }) as typeof prisma.prospect.update
  });
  t.after(restore);

  const result = await importProspectsForBusiness({
    tenantId: 'tenant_demo',
    businessId: 'biz_demo',
    sourceProvider: ProspectSourceProvider.GOOGLE_PLACES,
    prospects: [
      {
        companyName: 'Reston Family Dental',
        contactName: 'Alicia Grant',
        contactPhone: '(703) 555-0101',
        sourceLabel: 'google_places',
        sourceProviderRecordId: 'places/abc123',
        sourceWebsiteUrl: 'https://restondental.example',
        sourceMapsUrl: 'https://maps.google.com/?cid=demo',
        sourceCategory: 'Dentist',
        sourceMetadataJson: {
          formattedAddress: '123 Main St, Reston, VA 20190'
        },
        serviceInterest: 'After-hours overflow'
      }
    ]
  });

  const findWhere = capturedFindWhere as {
    tenantId: string;
    businessId: string;
    sourceProvider: ProspectSourceProvider;
    OR: Array<{ sourceProviderRecordId?: string; sourceFingerprint?: string }>;
  };
  assert.equal(findWhere.tenantId, 'tenant_demo');
  assert.equal(findWhere.businessId, 'biz_demo');
  assert.equal(findWhere.sourceProvider, ProspectSourceProvider.GOOGLE_PLACES);
  assert.deepEqual(findWhere.OR[0], { sourceProviderRecordId: 'places/abc123' });
  assert.ok(typeof findWhere.OR[1]?.sourceFingerprint === 'string');
  const updateData = capturedUpdateData as Record<string, unknown>;
  assert.equal(updateData.contactName, 'Alicia Grant');
  assert.equal(updateData.contactPhone, '(703) 555-0101');
  assert.equal(updateData.sourceWebsiteUrl, 'https://restondental.example');
  assert.equal(updateData.sourceMapsUrl, 'https://maps.google.com/?cid=demo');
  assert.equal(updateData.sourceCategory, 'Dentist');
  assert.equal(updateData.serviceInterest, 'After-hours overflow');
  assert.equal(updateData.notes, undefined);
  assert.deepEqual(updateData.lastImportBatch, {
    connect: {
      id: 'batch_demo'
    }
  });
  assert.ok(updateData.lastSeenAt instanceof Date);
  assert.deepEqual(capturedBatchUpdateData, {
    createdCount: 0,
    updatedCount: 1,
    skippedCount: 0
  });
  assert.deepEqual(result.prospects[0], {
    prospectSid: 'PR_EXISTING_1',
    companyName: 'Reston Family Dental',
    status: ProspectStatus.ATTEMPTED,
    priority: ProspectPriority.HIGH,
    sourceLabel: 'google_places',
    result: 'updated'
  });
});

test('importProspectsForBusiness skips exact duplicates while still marking them re-seen', async (t) => {
  let capturedUpdateData: unknown;
  let capturedBatchUpdateData: unknown;
  const matchingFingerprint = createHash('sha256')
    .update('MANUAL|sterling property group|marcus reed|7035551102|mreed@sterlingproperty.example|sterling|va')
    .digest('hex')
    .slice(0, 32);

  const restore = stubPrisma({
    businessFindFirst: (async () => ({ id: 'biz_demo', tenantId: 'tenant_demo' })) as typeof prisma.business.findFirst,
    prospectFindFirst: (async () => ({
      id: 'prospect_2',
      prospectSid: 'PR_EXISTING_2',
      companyName: 'Sterling Property Group',
      contactName: 'Marcus Reed',
      contactPhone: '703-555-1102',
      contactEmail: 'mreed@sterlingproperty.example',
      city: 'Sterling',
      state: 'VA',
      sourceLabel: 'manual_list',
      sourceWebsiteUrl: null,
      sourceMapsUrl: null,
      sourceLinkedinUrl: null,
      sourceCategory: null,
      sourceRoleTitle: null,
      sourceProviderRecordId: null,
      sourceFingerprint: matchingFingerprint,
      sourceMetadataJson: null,
      serviceInterest: 'Overflow voice coverage',
      notes: 'Operator-owned note',
      status: ProspectStatus.READY,
      priority: ProspectPriority.MEDIUM
    })) as typeof prisma.prospect.findFirst,
    prospectImportBatchCreate: ((async () => ({ id: 'batch_demo' })) as unknown) as typeof prisma.prospectImportBatch.create,
    prospectImportBatchUpdate: (async (args?: unknown) => {
      capturedBatchUpdateData = (args as { data?: unknown } | undefined)?.data;
      return { id: 'batch_demo' };
    }) as typeof prisma.prospectImportBatch.update,
    prospectUpdate: (async (args?: unknown) => {
      capturedUpdateData = (args as { data?: unknown } | undefined)?.data;
      return { id: 'prospect_2' };
    }) as typeof prisma.prospect.update
  });
  t.after(restore);

  const result = await importProspectsForBusiness({
    tenantId: 'tenant_demo',
    businessId: 'biz_demo',
    prospects: [
      {
        companyName: 'Sterling Property Group',
        contactName: 'Marcus Reed',
        contactPhone: '703-555-1102',
        contactEmail: 'mreed@sterlingproperty.example',
        city: 'Sterling',
        state: 'VA',
        sourceLabel: 'manual_list',
        serviceInterest: 'Overflow voice coverage'
      }
    ]
  });

  assert.ok(capturedUpdateData);
  const skippedUpdateData = capturedUpdateData as Record<string, unknown>;
  assert.deepEqual(skippedUpdateData.lastImportBatch, {
    connect: {
      id: 'batch_demo'
    }
  });
  assert.ok(skippedUpdateData.lastSeenAt instanceof Date);
  assert.deepEqual(capturedBatchUpdateData, {
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 1
  });
  assert.deepEqual(result.prospects[0], {
    prospectSid: 'PR_EXISTING_2',
    companyName: 'Sterling Property Group',
    status: ProspectStatus.READY,
    priority: ProspectPriority.MEDIUM,
    sourceLabel: 'manual_list',
    result: 'skipped'
  });
});
