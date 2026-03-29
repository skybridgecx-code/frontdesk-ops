import { prisma } from '@frontdesk/db';

export type AgentContext = {
  id: string | null;
  name: string;
  voiceName: string;
  systemPrompt: string;
};

const DEFAULT_AGENT_CONTEXT: AgentContext = {
  id: null,
  name: 'Default Agent',
  voiceName: 'alloy',
  systemPrompt:
    'You are a concise, helpful AI front desk for a home service business. Capture caller details, identify urgency, and guide the call efficiently.'
};

export async function loadAgentContext(agentProfileId: string | null): Promise<AgentContext> {
  if (!agentProfileId) {
    return DEFAULT_AGENT_CONTEXT;
  }

  const agent = await prisma.agentProfile.findUnique({
    where: { id: agentProfileId },
    select: {
      id: true,
      name: true,
      voiceName: true,
      systemPrompt: true,
      business: {
        select: {
          name: true
        }
      }
    }
  });

  if (!agent) {
    return DEFAULT_AGENT_CONTEXT;
  }

  return {
    id: agent.id,
    name: agent.name,
    voiceName: agent.voiceName ?? 'alloy',
    systemPrompt:
      agent.systemPrompt ??
      `You are the AI front desk for ${agent.business.name}. Capture caller details, identify urgency, and help the business respond efficiently.`
  };
}
