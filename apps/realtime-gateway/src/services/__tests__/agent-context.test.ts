import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@frontdesk/db', () => ({
  prisma: {
    agentProfile: {
      findUnique: vi.fn()
    }
  }
}));

import { prisma } from '@frontdesk/db';
import { loadAgentContext } from '../agent-context.js';

const mockPrisma = prisma as any;

describe('loadAgentContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default agent when agentProfileId is null', async () => {
    const result = await loadAgentContext(null);
    expect(result.id).toBeNull();
    expect(result.name).toBe('Default Agent');
    expect(result.voiceName).toBe('alloy');
    expect(result.systemPrompt).toContain('home service business');
  });

  it('returns default agent when profile not found', async () => {
    mockPrisma.agentProfile.findUnique.mockResolvedValue(null);
    const result = await loadAgentContext('nonexistent-id');
    expect(result.id).toBeNull();
    expect(result.name).toBe('Default Agent');
  });

  it('returns agent with custom prompt', async () => {
    mockPrisma.agentProfile.findUnique.mockResolvedValue({
      id: 'agent-1',
      name: 'Cool HVAC Bot',
      voiceName: 'shimmer',
      systemPrompt: 'You are Cool HVAC Bot.',
      business: { name: 'Cool HVAC Co' }
    });

    const result = await loadAgentContext('agent-1');
    expect(result).toEqual({
      id: 'agent-1',
      name: 'Cool HVAC Bot',
      voiceName: 'shimmer',
      systemPrompt: 'You are Cool HVAC Bot.'
    });
  });

  it('generates prompt from business name when systemPrompt is null', async () => {
    mockPrisma.agentProfile.findUnique.mockResolvedValue({
      id: 'agent-2',
      name: 'Agent',
      voiceName: null,
      systemPrompt: null,
      business: { name: 'Best Plumbing LLC' }
    });

    const result = await loadAgentContext('agent-2');
    expect(result.voiceName).toBe('alloy');
    expect(result.systemPrompt).toContain('Best Plumbing LLC');
  });
});
