import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentContext } from '../agent-context.js';

const connectOpenAIMock = vi.hoisted(() => vi.fn());
const buildSessionConfigMock = vi.hoisted(() => vi.fn());
const maybeSendInitialGreetingMock = vi.hoisted(() => vi.fn());
const handleOpenAIMessageMock = vi.hoisted(() => vi.fn());

vi.mock('../../openai-realtime.js', () => ({
  connectOpenAIRealtimeWebSocket: connectOpenAIMock,
  buildRealtimeSessionConfig: buildSessionConfigMock
}));

vi.mock('../../handlers/twilio-media.js', () => ({
  maybeSendInitialGreeting: maybeSendInitialGreetingMock
}));

vi.mock('../../handlers/openai-events.js', () => ({
  handleOpenAIMessage: handleOpenAIMessageMock
}));

import { initOpenAIBridge } from '../openai-bridge.js';

class FakeOpenAISocket {
  readyState = 1;
  send = vi.fn();
  private handlers = new Map<string, Array<(...args: any[]) => void>>();

  on(event: string, handler: (...args: any[]) => void) {
    const current = this.handlers.get(event) ?? [];
    current.push(handler);
    this.handlers.set(event, current);
  }

  emit(event: string, ...args: any[]) {
    const handlers = this.handlers.get(event) ?? [];
    for (const handler of handlers) {
      handler(...args);
    }
  }
}

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    queryCallSid: 'CA123',
    phoneNumberId: 'PN1',
    tenantId: null,
    businessId: null,
    agentProfileId: 'AP1',
    queryAuthVerified: true,
    currentStreamSid: 'MZ123',
    currentInputItemId: null,
    assistantTranscriptBuffer: '',
    callerTranscriptBuffer: '',
    pendingResponseTrigger: null,
    hasUncommittedAudio: false,
    responseCreateInFlight: false,
    initialGreetingSent: false,
    twilioStartReceived: true,
    pendingAudio: [],
    openAIReady: false,
    openAISessionReady: false,
    openAISocket: null,
    twilioSocket: { send: vi.fn() },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    ...overrides
  } as any;
}

function makeEvents() {
  return {
    persistEvent: vi.fn().mockResolvedValue(undefined)
  } as any;
}

function makeTranscripts() {
  return {} as any;
}

function makeAgent(): AgentContext {
  return {
    id: 'agent_1',
    name: 'Sky',
    language: 'en',
    voiceName: 'alloy',
    systemPrompt: 'You are the front desk.'
  };
}

describe('initOpenAIBridge', () => {
  let state: ReturnType<typeof makeState>;
  let events: ReturnType<typeof makeEvents>;
  let transcripts: ReturnType<typeof makeTranscripts>;
  let fakeSocket: FakeOpenAISocket;
  let enqueuedTasks: Array<() => Promise<void>>;
  let enqueue: (task: () => Promise<void>) => void;

  beforeEach(() => {
    vi.clearAllMocks();

    state = makeState();
    events = makeEvents();
    transcripts = makeTranscripts();
    fakeSocket = new FakeOpenAISocket();
    enqueuedTasks = [];
    enqueue = (task) => {
      enqueuedTasks.push(task);
    };

    buildSessionConfigMock.mockReturnValue({
      type: 'session.update',
      session: { instructions: 'hello', voice: 'alloy' }
    });
    connectOpenAIMock.mockReturnValue(fakeSocket);
    maybeSendInitialGreetingMock.mockResolvedValue(false);
  });

  async function runEnqueued() {
    for (const task of enqueuedTasks) {
      await task();
    }
  }

  it('marks readiness and attempts greeting after websocket open + session.update', async () => {
    initOpenAIBridge(state, events, transcripts, makeAgent(), enqueue);

    fakeSocket.emit('open');
    await runEnqueued();

    expect(state.openAIReady).toBe(true);
    expect(state.openAISessionReady).toBe(true);
    expect(fakeSocket.send).toHaveBeenCalledWith(
      JSON.stringify({
        type: 'session.update',
        session: { instructions: 'hello', voice: 'alloy' }
      })
    );
    expect(state.log.info).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'openai realtime websocket opened' })
    );
    expect(state.log.info).toHaveBeenCalledWith(
      expect.objectContaining({ msg: 'openai session.update sent' })
    );
    expect(maybeSendInitialGreetingMock).toHaveBeenCalledWith(
      state,
      events,
      'openai_ready'
    );
  });
});
