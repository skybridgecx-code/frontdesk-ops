import { prisma } from '@frontdesk/db';
import { composeFrontdeskSessionContext } from '@frontdesk/domain';

export type AgentContext = {
  id: string | null;
  name: string;
  voiceName: string;
  systemPrompt: string;
};

const businessContextSelect = {
  id: true,
  name: true,
  vertical: true,
  timezone: true,
  businessHours: {
    orderBy: {
      weekday: 'asc' as const
    },
    select: {
      weekday: true,
      openTime: true,
      closeTime: true,
      isClosed: true
    }
  },
  serviceAreas: {
    orderBy: {
      createdAt: 'asc' as const
    },
    select: {
      label: true,
      city: true,
      state: true,
      postalCode: true
    }
  }
};

function buildAgentContext(input: {
  agentId: string | null;
  agentName: string | null;
  voiceName: string | null;
  systemPrompt: string | null;
  business: {
    name: string | null;
    vertical: string | null;
    timezone: string | null;
    businessHours: Array<{
      weekday:
        | 'MONDAY'
        | 'TUESDAY'
        | 'WEDNESDAY'
        | 'THURSDAY'
        | 'FRIDAY'
        | 'SATURDAY'
        | 'SUNDAY';
      openTime: string | null;
      closeTime: string | null;
      isClosed: boolean;
    }>;
    serviceAreas: Array<{
      label: string;
      city: string | null;
      state: string | null;
      postalCode: string | null;
    }>;
  } | null;
  phoneNumber: {
    label: string | null;
    routingMode: string | null;
  } | null;
}): AgentContext {
  const systemPrompt = composeFrontdeskSessionContext({
    businessName: input.business?.name ?? null,
    businessVertical: input.business?.vertical ?? null,
    timezone: input.business?.timezone ?? null,
    phoneNumberLabel: input.phoneNumber?.label ?? null,
    routingMode: input.phoneNumber?.routingMode ?? null,
    agentName: input.agentName,
    agentSystemPrompt: input.systemPrompt,
    businessHours: input.business?.businessHours ?? [],
    serviceAreas: input.business?.serviceAreas ?? []
  }).instructions;

  return {
    id: input.agentId,
    name: input.agentName ?? 'Default Agent',
    voiceName: input.voiceName ?? 'alloy',
    systemPrompt
  };
}

export async function loadAgentContext(input: {
  agentProfileId: string | null;
  phoneNumberId: string | null;
}): Promise<AgentContext> {
  const [agent, phoneNumber] = await Promise.all([
    input.agentProfileId
      ? prisma.agentProfile.findUnique({
          where: { id: input.agentProfileId },
          select: {
            id: true,
            name: true,
            voiceName: true,
            systemPrompt: true,
            business: {
              select: businessContextSelect
            }
          }
        })
      : Promise.resolve(null),
    input.phoneNumberId
      ? prisma.phoneNumber.findUnique({
          where: { id: input.phoneNumberId },
          select: {
            label: true,
            routingMode: true,
            business: {
              select: businessContextSelect
            }
          }
        })
      : Promise.resolve(null)
  ]);

  return buildAgentContext({
    agentId: agent?.id ?? null,
    agentName: agent?.name ?? null,
    voiceName: agent?.voiceName ?? null,
    systemPrompt: agent?.systemPrompt ?? null,
    business: agent?.business ?? phoneNumber?.business ?? null,
    phoneNumber: phoneNumber
      ? {
          label: phoneNumber.label,
          routingMode: phoneNumber.routingMode
        }
      : null
  });
}
