'use client';

import { useEffect, useMemo, useState } from 'react';

const transcript = [
  {
    speaker: 'Caller',
    text: 'My water heater is leaking in the basement and I need someone tonight.'
  },
  {
    speaker: 'MoLeads',
    text: 'I can help. What is the service address, and what is the best callback number?'
  },
  {
    speaker: 'Caller',
    text: 'I am at 2148 Cedar Lane. Water is starting to spread and the breaker is off.'
  },
  {
    speaker: 'MoLeads',
    text: 'Understood. I am marking this urgent and sending the details to your after-hours contact.'
  }
];

const extraction = [
  { label: 'Issue', value: 'Water heater leak' },
  { label: 'Location', value: '2148 Cedar Lane' },
  { label: 'Callback', value: 'Captured' },
  { label: 'Urgency', value: 'After-hours dispatch' }
];

const routingStages = [
  'Answer the call',
  'Capture the details',
  'Route the next step'
];

const stageTitles = ['Answering', 'Details captured', 'Action ready', 'Routed'];

const stageRail = [
  'Call opened',
  'Issue captured',
  'Urgency flagged',
  'Handoff ready'
];

export function InteractiveCallFlow() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    if (stage >= transcript.length - 1) {
      setIsPlaying(false);
      return;
    }

    const timeout = window.setTimeout(() => {
      setStage((current) => Math.min(current + 1, transcript.length - 1));
    }, 1150);

    return () => window.clearTimeout(timeout);
  }, [isPlaying, stage]);

  const visibleTranscript = useMemo(() => transcript.slice(0, stage + 1), [stage]);

  function replayFlow() {
    setStage(0);
    setIsPlaying(true);
  }

  const progress = ((stage + 1) / transcript.length) * 100;
  const activeStageLabel = stageRail[Math.min(stage, stageRail.length - 1)];

  return (
    <div className="relative overflow-hidden rounded-[2.4rem] border border-[#1f2741] bg-[linear-gradient(180deg,#0b1120,#121a31_50%,#0d1426)] p-6 text-white shadow-[0_36px_100px_rgba(15,23,42,0.24)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(124,92,255,0.22),transparent_18%),radial-gradient(circle_at_84%_16%,rgba(59,130,246,0.16),transparent_16%),radial-gradient(circle_at_50%_88%,rgba(16,185,129,0.10),transparent_24%)]" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-[0.34em] text-[#a5b0ff]">Watch intake flow</div>
            <div className="mt-2 text-3xl font-semibold tracking-[-0.06em] text-white">
              See the call become actionable.
            </div>
          </div>
          <button
            type="button"
            onClick={replayFlow}
            aria-pressed={isPlaying}
            className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-[#eef1ff] transition hover:bg-white/12"
          >
            <span aria-hidden="true">▶</span>
            {isPlaying ? 'Playing' : 'Replay flow'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          {stageRail.map((item, index) => {
            const active = stage >= index;
            return (
              <div
                key={item}
                className={`rounded-2xl border px-3 py-2 text-[11px] uppercase tracking-[0.24em] transition ${
                  active ? 'border-white/14 bg-white/10 text-white' : 'border-white/8 bg-white/5 text-[#9aa7d6]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-400 shadow-[0_0_0_5px_rgba(16,185,129,0.08)]' : 'bg-[#5d678b]'}`}
                  />
                  <span>{item}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,#7c5cff,#8bcbff)] transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-4 text-[11px] uppercase tracking-[0.28em] text-[#a5b0ff]">
          Current state: {activeStageLabel}
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-4 rounded-[2rem] border border-white/10 bg-white/6 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs uppercase tracking-[0.34em] text-[#a5b0ff]">Conversation</div>
              <div className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#dce0f5]">
                Live
              </div>
            </div>

            <div className="space-y-4">
              {visibleTranscript.map((line, index) => {
                const active = index === stage;
                const isMoLeads = line.speaker === 'MoLeads';

                return (
                  <div
                    key={`${line.speaker}-${line.text}`}
                    className={`max-w-2xl rounded-[1.5rem] border px-4 py-3 text-sm leading-7 transition-all duration-500 ${
                      isMoLeads
                        ? 'ml-auto border-white/10 bg-white/8 text-[#eef1ff]'
                        : active
                          ? 'border-[#7c5cff]/35 bg-white/10 text-white shadow-[0_0_0_1px_rgba(124,92,255,0.08)]'
                          : 'border-white/10 bg-white/5 text-[#e6eaff]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-[11px] uppercase tracking-[0.26em] text-[#a5b0ff]">{line.speaker}</div>
                      {active ? (
                        <div className="rounded-full border border-white/10 bg-white/8 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-[#dce0f5]">
                          Live
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-2">{line.text}</div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/7 p-4">
              <div className="text-[11px] uppercase tracking-[0.28em] text-[#a5b0ff]">Signal</div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-[78%] rounded-full bg-[linear-gradient(90deg,#7c5cff,#8bcbff)] animate-glow-pulse" />
              </div>
              <div className="mt-3 text-sm leading-7 text-[#e6eaff]">
                The call becomes structured while the caller is still on the line.
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-[2rem] border border-white/10 bg-white/7 p-5 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div className="text-xs uppercase tracking-[0.34em] text-[#a5b0ff]">Structured output</div>
              <div className="rounded-full bg-[#111827] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white">
                {stageTitles[Math.min(stage, stageTitles.length - 1)]}
              </div>
            </div>

            <div className="grid gap-3">
              {extraction.map((item, index) => {
                const visible = stage >= index - 1;
                const hot = stage >= index;

                return (
                  <div
                    key={item.label}
                    className={`rounded-2xl border px-4 py-3 transition-all duration-500 ${
                      hot
                        ? 'border-white/12 bg-white/10 shadow-[0_14px_30px_rgba(111,63,245,0.08)]'
                        : visible
                          ? 'border-white/10 bg-white/6'
                          : 'border-dashed border-white/8 bg-white/5 opacity-70'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-xs uppercase tracking-[0.28em] text-[#a5b0ff]">{item.label}</div>
                      {hot ? <span className="text-[10px] uppercase tracking-[0.24em] text-[#dce0f5]">Captured</span> : null}
                    </div>
                    <div className="mt-2 text-sm font-medium text-white">{item.value}</div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/8 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="text-xs uppercase tracking-[0.3em] text-[#a5b0ff]">Routing decision</div>
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_6px_rgba(34,197,94,0.12)]" />
              </div>
              <div className="mt-3 text-base font-semibold tracking-[-0.03em] text-white">
                Lead captured and routed.
              </div>
              <p className="mt-2 text-sm leading-7 text-[#dce0f5]">
                The issue, callback, and urgency are attached to the handoff before the caller hangs up.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-white/10 bg-white/6 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.3em] text-[#a5b0ff]">Routing path</div>
              <div className="mt-3 grid gap-2 text-sm text-[#dce0f5]">
                {routingStages.map((item, index) => (
                  <div key={item} className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                        stage >= index ? 'bg-white text-[#0f172a]' : 'bg-white/10 text-[#9aa7d6]'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className={stage >= index ? 'text-white' : ''}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/8 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.3em] text-emerald-200">Handoff</div>
              <div className="mt-2 text-sm leading-7 text-emerald-50">
                The request stays visible until the business handles it.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
