import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@frontdesk/db';
import { z } from 'zod';
import { dedupeImportedAcquisitionLeads, type AcquisitionLeadImportInput } from '../lib/acquisition-leads.js';

const listQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(500).optional()
  })
  .strict();

const importLeadItemSchema = z
  .object({
    businessName: z.string().min(1).max(240),
    vertical: z.string().max(160).nullable().optional(),
    services: z.string().max(240).nullable().optional(),
    location: z.string().max(160).nullable().optional(),
    phone: z.string().max(64).nullable().optional(),
    email: z.string().max(240).nullable().optional(),
    website: z.string().max(320).nullable().optional(),
    yearsInBusiness: z.string().max(120).nullable().optional(),
    painPointFound: z.string().max(500).nullable().optional(),
    outreachStatus: z.string().max(120).nullable().optional(),
    stage: z.string().max(120).nullable().optional(),
    demoStatus: z.string().max(120).nullable().optional(),
    offerStage: z.string().max(120).nullable().optional(),
    lastContactedAt: z.coerce.date().nullable().optional(),
    nextFollowUpAt: z.coerce.date().nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
    source: z.string().max(120).nullable().optional()
  })
  .strict();

const importBodySchema = z
  .object({
    leads: z.array(importLeadItemSchema).min(1).max(1000)
  })
  .strict();

const leadIdParamsSchema = z
  .object({
    leadId: z.string().min(1)
  })
  .strict();

const updateLeadBodySchema = z
  .object({
    stage: z.string().max(120).optional(),
    outreachStatus: z.string().max(120).optional(),
    demoStatus: z.string().max(120).optional(),
    offerStage: z.string().max(120).optional(),
    notes: z.string().max(4000).nullable().optional(),
    painPointFound: z.string().max(500).nullable().optional(),
    lastContactedAt: z.coerce.date().nullable().optional(),
    nextFollowUpAt: z.coerce.date().nullable().optional()
  })
  .strict();

type AcquisitionLeadRow = {
  id: string;
  businessName: string;
  vertical: string | null;
  services: string | null;
  location: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  yearsInBusiness: string | null;
  painPointFound: string | null;
  outreachStatus: string;
  stage: string;
  demoStatus: string;
  offerStage: string;
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  notes: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
};

type AcquisitionLeadIdentityRow = {
  website: string | null;
  businessName: string;
  location: string;
};

function requireTenant(request: FastifyRequest, reply: FastifyReply) {
  if (!request.tenantId) {
    reply.status(403).send({
      ok: false,
      error: 'Tenant scope required'
    });
    return null;
  }

  return request.tenantId;
}

function serializeLead(row: AcquisitionLeadRow) {
  return {
    ...row,
    lastContactedAt: row.lastContactedAt?.toISOString() ?? null,
    nextFollowUpAt: row.nextFollowUpAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

export async function registerAcquisitionLeadRoutes(app: FastifyInstance) {
  app.get('/v1/acquisition/leads', async (request, reply) => {
    const tenantId = requireTenant(request, reply);
    if (!tenantId) {
      return;
    }

    const parsed = listQuerySchema.safeParse(request.query ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    const limit = parsed.data.limit ?? 500;

    const rows = await prisma.$queryRaw<AcquisitionLeadRow[]>`
      SELECT
        "id",
        "businessName",
        "vertical",
        "services",
        "location",
        "phone",
        "email",
        "website",
        "yearsInBusiness",
        "painPointFound",
        "outreachStatus",
        "stage",
        "demoStatus",
        "offerStage",
        "lastContactedAt",
        "nextFollowUpAt",
        "notes",
        "source",
        "createdAt",
        "updatedAt"
      FROM "AcquisitionLead"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "nextFollowUpAt" ASC NULLS LAST, "updatedAt" DESC
      LIMIT ${limit}
    `;

    return {
      ok: true,
      leads: rows.map(serializeLead)
    };
  });

  app.get('/v1/acquisition/leads/summary', async (request, reply) => {
    const tenantId = requireTenant(request, reply);
    if (!tenantId) {
      return;
    }

    const rows = await prisma.$queryRaw<
      Array<{
        businessName: string;
        stage: string;
        outreachStatus: string;
        nextFollowUpAt: Date | null;
        painPointFound: string | null;
        location: string;
      }>
    >`
      SELECT
        "businessName",
        "stage",
        "outreachStatus",
        "nextFollowUpAt",
        "painPointFound",
        "location"
      FROM "AcquisitionLead"
      WHERE "tenantId" = ${tenantId}
    `;

    const now = Date.now();
    const followUpsDue = rows.filter(
      (row) => row.nextFollowUpAt && row.nextFollowUpAt.getTime() <= now && row.stage !== 'Won' && row.stage !== 'Not now'
    ).length;
    const demosBooked = rows.filter((row) => row.stage === 'Demo booked').length;
    const contacted = rows.filter((row) => row.stage !== 'Researching').length;

    const actions = rows
      .filter((row) => row.stage !== 'Won' && row.stage !== 'Not now')
      .sort((a, b) => {
        const aTime = a.nextFollowUpAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bTime = b.nextFollowUpAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return aTime - bTime;
      })
      .slice(0, 5)
      .map((row) => ({
        businessName: row.businessName,
        stage: row.stage,
        nextFollowUpAt: row.nextFollowUpAt?.toISOString() ?? null,
        detail: [row.location, row.painPointFound ?? row.outreachStatus].filter(Boolean).join(' · ')
      }));

    return {
      ok: true,
      summary: {
        totalLeads: rows.length,
        contacted,
        demosBooked,
        followUpsDue
      },
      actions
    };
  });

  app.post('/v1/acquisition/leads/import', async (request, reply) => {
    const tenantId = requireTenant(request, reply);
    if (!tenantId) {
      return;
    }

    const parsed = importBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    const existing = await prisma.$queryRaw<AcquisitionLeadIdentityRow[]>`
      SELECT "website", "businessName", "location"
      FROM "AcquisitionLead"
      WHERE "tenantId" = ${tenantId}
    `;

    const deduped = dedupeImportedAcquisitionLeads({
      existing,
      incoming: parsed.data.leads as AcquisitionLeadImportInput[]
    });

    for (const lead of deduped.prepared) {
      await prisma.$executeRaw`
        INSERT INTO "AcquisitionLead" (
          "id",
          "tenantId",
          "businessName",
          "vertical",
          "services",
          "location",
          "phone",
          "email",
          "website",
          "yearsInBusiness",
          "painPointFound",
          "outreachStatus",
          "stage",
          "demoStatus",
          "offerStage",
          "lastContactedAt",
          "nextFollowUpAt",
          "notes",
          "source",
          "createdAt",
          "updatedAt"
        ) VALUES (
          ${lead.id},
          ${tenantId},
          ${lead.businessName},
          ${lead.vertical},
          ${lead.services},
          ${lead.location},
          ${lead.phone},
          ${lead.email},
          ${lead.website},
          ${lead.yearsInBusiness},
          ${lead.painPointFound},
          ${lead.outreachStatus},
          ${lead.stage},
          ${lead.demoStatus},
          ${lead.offerStage},
          ${lead.lastContactedAt},
          ${lead.nextFollowUpAt},
          ${lead.notes},
          ${lead.source},
          NOW(),
          NOW()
        )
      `;
    }

    const rows = await prisma.$queryRaw<AcquisitionLeadRow[]>`
      SELECT
        "id",
        "businessName",
        "vertical",
        "services",
        "location",
        "phone",
        "email",
        "website",
        "yearsInBusiness",
        "painPointFound",
        "outreachStatus",
        "stage",
        "demoStatus",
        "offerStage",
        "lastContactedAt",
        "nextFollowUpAt",
        "notes",
        "source",
        "createdAt",
        "updatedAt"
      FROM "AcquisitionLead"
      WHERE "tenantId" = ${tenantId}
      ORDER BY "nextFollowUpAt" ASC NULLS LAST, "updatedAt" DESC
      LIMIT 500
    `;

    return {
      ok: true,
      importedCount: deduped.prepared.length,
      skippedCount: deduped.skipped,
      leads: rows.map(serializeLead)
    };
  });

  app.patch('/v1/acquisition/leads/:leadId', async (request, reply) => {
    const tenantId = requireTenant(request, reply);
    if (!tenantId) {
      return;
    }

    const { leadId } = leadIdParamsSchema.parse(request.params);
    const parsed = updateLeadBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    const existingRows = await prisma.$queryRaw<AcquisitionLeadRow[]>`
      SELECT
        "id",
        "businessName",
        "vertical",
        "services",
        "location",
        "phone",
        "email",
        "website",
        "yearsInBusiness",
        "painPointFound",
        "outreachStatus",
        "stage",
        "demoStatus",
        "offerStage",
        "lastContactedAt",
        "nextFollowUpAt",
        "notes",
        "source",
        "createdAt",
        "updatedAt"
      FROM "AcquisitionLead"
      WHERE "tenantId" = ${tenantId} AND "id" = ${leadId}
      LIMIT 1
    `;

    const existing = existingRows[0];
    if (!existing) {
      return reply.status(404).send({
        ok: false,
        error: `Acquisition lead not found for id=${leadId}`
      });
    }

    const next = {
      stage: parsed.data.stage ?? existing.stage,
      outreachStatus: parsed.data.outreachStatus ?? existing.outreachStatus,
      demoStatus: parsed.data.demoStatus ?? existing.demoStatus,
      offerStage: parsed.data.offerStage ?? existing.offerStage,
      notes: parsed.data.notes !== undefined ? parsed.data.notes : existing.notes,
      painPointFound:
        parsed.data.painPointFound !== undefined ? parsed.data.painPointFound : existing.painPointFound,
      lastContactedAt:
        parsed.data.lastContactedAt !== undefined ? parsed.data.lastContactedAt : existing.lastContactedAt,
      nextFollowUpAt:
        parsed.data.nextFollowUpAt !== undefined ? parsed.data.nextFollowUpAt : existing.nextFollowUpAt
    };

    const updatedRows = await prisma.$queryRaw<AcquisitionLeadRow[]>`
      UPDATE "AcquisitionLead"
      SET
        "stage" = ${next.stage},
        "outreachStatus" = ${next.outreachStatus},
        "demoStatus" = ${next.demoStatus},
        "offerStage" = ${next.offerStage},
        "notes" = ${next.notes},
        "painPointFound" = ${next.painPointFound},
        "lastContactedAt" = ${next.lastContactedAt},
        "nextFollowUpAt" = ${next.nextFollowUpAt},
        "updatedAt" = NOW()
      WHERE "tenantId" = ${tenantId} AND "id" = ${leadId}
      RETURNING
        "id",
        "businessName",
        "vertical",
        "services",
        "location",
        "phone",
        "email",
        "website",
        "yearsInBusiness",
        "painPointFound",
        "outreachStatus",
        "stage",
        "demoStatus",
        "offerStage",
        "lastContactedAt",
        "nextFollowUpAt",
        "notes",
        "source",
        "createdAt",
        "updatedAt"
    `;

    const updated = updatedRows[0];
    if (!updated) {
      return reply.status(404).send({
        ok: false,
        error: `Acquisition lead not found for id=${leadId}`
      });
    }

    return {
      ok: true,
      lead: serializeLead(updated)
    };
  });

  app.delete('/v1/acquisition/leads/imported', async (request, reply) => {
    const tenantId = requireTenant(request, reply);
    if (!tenantId) {
      return;
    }

    const deletedRows = await prisma.$queryRaw<Array<{ id: string }>>`
      DELETE FROM "AcquisitionLead"
      WHERE "tenantId" = ${tenantId}
        AND "source" = 'Imported lead file'
      RETURNING "id"
    `;

    return {
      ok: true,
      deletedCount: deletedRows.length
    };
  });
}
