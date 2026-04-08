import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { BusinessVertical, prisma } from '@frontdesk/db';
import { businessIdParams } from '../lib/params.js';

const updateBusinessBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  legalName: z.string().min(1).max(160).nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  timezone: z.string().min(1).max(80).optional(),
  vertical: z.nativeEnum(BusinessVertical).optional()
});

const createLocationBodySchema = z.object({
  name: z.string().min(1).max(120),
  addressLine1: z.string().max(160).nullable().optional(),
  addressLine2: z.string().max(160).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  state: z.string().max(80).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  countryCode: z.string().max(2).nullable().optional(),
  isPrimary: z.boolean().optional()
});

export async function registerBusinessWriteRoutes(app: FastifyInstance) {
  app.patch('/v1/businesses/:businessId', async (request, reply) => {
    const { businessId } = businessIdParams.parse(request.params);
    const parsed = updateBusinessBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
    }

    const existing = await prisma.business.findFirst({
      where: {
        id: businessId,
        ...(request.tenantId ? { tenantId: request.tenantId } : {})
      },
      select: { id: true }
    });

    if (!existing) {
      return reply.notFound(`Business not found for id=${businessId}`);
    }

    const business = await prisma.business.update({
      where: { id: existing.id },
      data: parsed.data,
      select: {
        id: true,
        tenantId: true,
        slug: true,
        name: true,
        legalName: true,
        vertical: true,
        websiteUrl: true,
        timezone: true,
        updatedAt: true
      }
    });

    return {
      ok: true,
      business
    };
  });

  app.post('/v1/businesses/:businessId/locations', async (request, reply) => {
    const { businessId } = businessIdParams.parse(request.params);
    const parsed = createLocationBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
    }

    const existingBusiness = await prisma.business.findFirst({
      where: {
        id: businessId,
        ...(request.tenantId ? { tenantId: request.tenantId } : {})
      },
      select: { id: true }
    });

    if (!existingBusiness) {
      return reply.notFound(`Business not found for id=${businessId}`);
    }

    if (parsed.data.isPrimary) {
      await prisma.location.updateMany({
        where: { businessId },
        data: { isPrimary: false }
      });
    }

    const location = await prisma.location.create({
      data: {
        businessId,
        name: parsed.data.name,
        addressLine1: parsed.data.addressLine1 ?? null,
        addressLine2: parsed.data.addressLine2 ?? null,
        city: parsed.data.city ?? null,
        state: parsed.data.state ?? null,
        postalCode: parsed.data.postalCode ?? null,
        countryCode: parsed.data.countryCode ?? 'US',
        isPrimary: parsed.data.isPrimary ?? false
      },
      select: {
        id: true,
        businessId: true,
        name: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        countryCode: true,
        isPrimary: true,
        createdAt: true
      }
    });

    return {
      ok: true,
      location
    };
  });
}
