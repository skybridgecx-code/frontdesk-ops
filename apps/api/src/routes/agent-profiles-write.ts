import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AgentChannel, prisma } from '@frontdesk/db';
import { businessIdParams, agentProfileIdParams } from '../lib/params.js';

const createAgentProfileBodySchema = z.object({
  name: z.string().min(1).max(120),
  channel: z.nativeEnum(AgentChannel).default(AgentChannel.VOICE),
  language: z.string().min(2).max(16).default('en'),
  voiceName: z.string().min(1).max(80).nullable().optional(),
  systemPrompt: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional()
});

const updateAgentProfileBodySchema = z.object({
  name: z.string().min(1).max(120).optional(),
  channel: z.nativeEnum(AgentChannel).optional(),
  language: z.string().min(2).max(16).optional(),
  voiceName: z.string().min(1).max(80).nullable().optional(),
  systemPrompt: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional()
});

export async function registerAgentProfileWriteRoutes(app: FastifyInstance) {
  app.post('/v1/businesses/:businessId/agent-profiles', async (request, reply) => {
    const { businessId } = businessIdParams.parse(request.params);
    const parsed = createAgentProfileBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, tenantId: true }
    });

    if (!business) {
      return reply.notFound(`Business not found for id=${businessId}`);
    }

    const agentProfile = await prisma.agentProfile.create({
      data: {
        tenantId: business.tenantId,
        businessId: business.id,
        name: parsed.data.name,
        channel: parsed.data.channel,
        language: parsed.data.language,
        voiceName: parsed.data.voiceName ?? null,
        systemPrompt: parsed.data.systemPrompt ?? null,
        isActive: parsed.data.isActive ?? true
      },
      select: {
        id: true,
        tenantId: true,
        businessId: true,
        name: true,
        channel: true,
        language: true,
        voiceName: true,
        systemPrompt: true,
        isActive: true,
        createdAt: true
      }
    });

    return {
      ok: true,
      agentProfile
    };
  });

  app.patch('/v1/agent-profiles/:agentProfileId', async (request, reply) => {
    const { agentProfileId } = agentProfileIdParams.parse(request.params);
    const parsed = updateAgentProfileBodySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({ ok: false, error: parsed.error.flatten() });
    }

    const existing = await prisma.agentProfile.findUnique({
      where: { id: agentProfileId },
      select: { id: true }
    });

    if (!existing) {
      return reply.notFound(`AgentProfile not found for id=${agentProfileId}`);
    }

    const agentProfile = await prisma.agentProfile.update({
      where: { id: agentProfileId },
      data: parsed.data,
      select: {
        id: true,
        tenantId: true,
        businessId: true,
        name: true,
        channel: true,
        language: true,
        voiceName: true,
        systemPrompt: true,
        isActive: true,
        updatedAt: true
      }
    });

    return {
      ok: true,
      agentProfile
    };
  });
}
