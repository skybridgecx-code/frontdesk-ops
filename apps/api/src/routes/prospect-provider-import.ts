import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ProspectPriority, ProspectStatus } from '@frontdesk/db';
import {
  ApolloApiError,
  GooglePlacesApiError,
  MissingApolloApiKeyError,
  MissingGooglePlacesApiKeyError,
  searchApolloPeopleProspects,
  searchGooglePlacesProspects
} from '@frontdesk/integrations';
import { BusinessNotFoundError, importProspectsForBusiness } from '../lib/prospect-import.js';

const googlePlacesImportBodySchema = z
  .object({
    textQuery: z.string().min(1).max(240),
    pageSize: z.number().int().min(1).max(20).optional(),
    includedType: z.string().min(1).max(80).optional(),
    regionCode: z.string().min(2).max(10).optional(),
    languageCode: z.string().min(2).max(20).optional(),
    strictTypeFiltering: z.boolean().optional(),
    defaultStatus: z.nativeEnum(ProspectStatus).optional(),
    defaultPriority: z.nativeEnum(ProspectPriority).nullable().optional(),
    defaultSourceLabel: z.string().min(1).max(120).optional(),
    serviceInterest: z.string().min(1).max(240).optional()
  })
  .strict();

const apolloImportBodySchema = z
  .object({
    personTitles: z.array(z.string().min(1).max(120)).max(10).optional(),
    personLocations: z.array(z.string().min(1).max(120)).max(10).optional(),
    organizationLocations: z.array(z.string().min(1).max(120)).max(10).optional(),
    qKeywords: z.string().min(1).max(240).optional(),
    perPage: z.number().int().min(1).max(25).optional(),
    page: z.number().int().min(1).max(20).optional(),
    defaultStatus: z.nativeEnum(ProspectStatus).optional(),
    defaultPriority: z.nativeEnum(ProspectPriority).nullable().optional(),
    defaultSourceLabel: z.string().min(1).max(120).optional(),
    serviceInterest: z.string().min(1).max(240).optional()
  })
  .strict()
  .refine(
    (value) =>
      Boolean(
        value.qKeywords ||
          value.personTitles?.length ||
          value.personLocations?.length ||
          value.organizationLocations?.length
      ),
    {
      message: 'Provide at least one Apollo search filter',
      path: ['qKeywords']
    }
  );

function trimValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value.map(trimValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, trimValue(nested)]));
  }

  return value;
}

function mapProviderError(error: unknown, reply: FastifyReply) {
  if (error instanceof MissingGooglePlacesApiKeyError || error instanceof MissingApolloApiKeyError) {
    return reply.status(503).send({
      ok: false,
      error: error.message
    });
  }

  if (error instanceof GooglePlacesApiError || error instanceof ApolloApiError) {
    return reply.status(502).send({
      ok: false,
      error: error.message
    });
  }

  if (error instanceof BusinessNotFoundError) {
    return reply.notFound(error.message);
  }

  throw error;
}

export async function registerProspectProviderImportRoutes(app: FastifyInstance) {
  app.post('/v1/businesses/:businessId/prospects/import/google-places', async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    const parsed = googlePlacesImportBodySchema.safeParse(trimValue(request.body));

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    try {
      const prospects = await searchGooglePlacesProspects({
        textQuery: parsed.data.textQuery,
        pageSize: parsed.data.pageSize,
        includedType: parsed.data.includedType,
        regionCode: parsed.data.regionCode,
        languageCode: parsed.data.languageCode,
        strictTypeFiltering: parsed.data.strictTypeFiltering
      });

      const result = await importProspectsForBusiness({
        businessId,
        defaultSourceLabel: parsed.data.defaultSourceLabel,
        prospects: prospects.map((prospect) => ({
          ...prospect,
          serviceInterest: parsed.data.serviceInterest,
          status: parsed.data.defaultStatus,
          priority: parsed.data.defaultPriority
        }))
      });

      return {
        ok: true,
        importedCount: result.importedCount,
        prospects: result.prospects
      };
    } catch (error) {
      return mapProviderError(error, reply);
    }
  });

  app.post('/v1/businesses/:businessId/prospects/import/apollo', async (request, reply) => {
    const { businessId } = request.params as { businessId: string };
    const parsed = apolloImportBodySchema.safeParse(trimValue(request.body));

    if (!parsed.success) {
      return reply.status(400).send({
        ok: false,
        error: parsed.error.flatten()
      });
    }

    try {
      const prospects = await searchApolloPeopleProspects({
        personTitles: parsed.data.personTitles,
        personLocations: parsed.data.personLocations,
        organizationLocations: parsed.data.organizationLocations,
        qKeywords: parsed.data.qKeywords,
        perPage: parsed.data.perPage,
        page: parsed.data.page
      });

      const result = await importProspectsForBusiness({
        businessId,
        defaultSourceLabel: parsed.data.defaultSourceLabel,
        prospects: prospects.map((prospect) => ({
          ...prospect,
          serviceInterest: parsed.data.serviceInterest,
          status: parsed.data.defaultStatus,
          priority: parsed.data.defaultPriority
        }))
      });

      return {
        ok: true,
        importedCount: result.importedCount,
        prospects: result.prospects
      };
    } catch (error) {
      return mapProviderError(error, reply);
    }
  });
}
