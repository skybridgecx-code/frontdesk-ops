import type { FastifyInstance } from 'fastify';
import { prisma } from '@frontdesk/db';
import { businessIdParams } from '../lib/params.js';

export async function registerBusinessRoutes(app: FastifyInstance) {
  app.get('/v1/businesses/:businessId', async (request, reply) => {
    const { businessId } = businessIdParams.parse(request.params);

    const business = await prisma.business.findUnique({
      where: {
        id: businessId
      },
      select: {
        id: true,
        tenantId: true,
        slug: true,
        name: true,
        legalName: true,
        vertical: true,
        websiteUrl: true,
        timezone: true,
        createdAt: true,
        updatedAt: true,
        locations: {
          orderBy: {
            createdAt: 'asc'
          },
          select: {
            id: true,
            name: true,
            addressLine1: true,
            city: true,
            state: true,
            postalCode: true,
            isPrimary: true
          }
        },
        phoneNumbers: {
          orderBy: {
            createdAt: 'asc'
          },
          select: {
            id: true,
            e164: true,
            label: true,
            externalSid: true,
            isActive: true,
            routingMode: true,
            primaryAgentProfileId: true,
            afterHoursAgentProfileId: true,
            enableMissedCallTextBack: true,
            primaryAgentProfile: {
              select: {
                id: true,
                name: true,
                voiceName: true,
                isActive: true
              }
            },
            afterHoursAgentProfile: {
              select: {
                id: true,
                name: true,
                voiceName: true,
                isActive: true
              }
            }
          }
        },
        agentProfiles: {
          orderBy: {
            createdAt: 'asc'
          },
          select: {
            id: true,
            name: true,
            channel: true,
            language: true,
            voiceName: true,
            isActive: true
          }
        },
        businessHours: {
          orderBy: {
            weekday: 'asc'
          },
          select: {
            id: true,
            weekday: true,
            openTime: true,
            closeTime: true,
            isClosed: true
          }
        },
        serviceAreas: {
          orderBy: {
            createdAt: 'asc'
          },
          select: {
            id: true,
            label: true,
            city: true,
            state: true,
            postalCode: true
          }
        }
      }
    });

    if (!business) {
      return reply.notFound(`Business not found for id=${businessId}`);
    }

    return {
      ok: true,
      business
    };
  });
}
