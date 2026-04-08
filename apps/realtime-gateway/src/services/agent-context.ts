/**
 * Agent context loader — resolves the AI agent profile for a call.
 *
 * Each phone number can optionally be linked to an AgentProfile that defines
 * the voice name, system prompt, and agent identity. If no profile is configured
 * (or the profile doesn't exist), a sensible default is returned.
 *
 * The system prompt from the agent profile is used to configure the OpenAI
 * Realtime API session at the start of each call.
 */

import { prisma } from '@frontdesk/db';

/** Resolved agent identity used to configure the OpenAI Realtime session. */
export interface AgentContext {
  id: string | null;
  name: string;
  voiceName: string;
  systemPrompt: string;
}

const DEFAULT_AGENT: AgentContext = {
  id: null,
  name: 'Default Agent',
  voiceName: 'alloy',
  systemPrompt:
    'You are a concise, helpful AI front desk for a home service business. Capture caller details, identify urgency, and guide the call efficiently.'
};

/**
 * Loads the agent profile from the database, falling back to a default if not found.
 *
 * If the agent has a custom `systemPrompt`, it's used as-is. Otherwise, a prompt
 * is generated using the business name (e.g. "You are the AI front desk for Acme HVAC...").
 *
 * @param agentProfileId - The AgentProfile ID from the phone number config, or null
 * @returns Resolved agent context with voice name and system prompt
 */
export async function loadAgentContext(agentProfileId: string | null): Promise<AgentContext> {
  if (!agentProfileId) return DEFAULT_AGENT;

  const agent = await prisma.agentProfile.findUnique({
    where: { id: agentProfileId },
    select: {
      id: true,
      name: true,
      voiceName: true,
      systemPrompt: true,
      business: { select: { name: true } }
    }
  });

  if (!agent) return DEFAULT_AGENT;

  return {
    id: agent.id,
    name: agent.name,
    voiceName: agent.voiceName ?? 'alloy',
    systemPrompt:
      agent.systemPrompt ??
      `You are the AI front desk for ${agent.business.name}. Capture caller details, identify urgency, and help the business respond efficiently.`
  };
}
