import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getApiBaseUrl, getInternalApiHeaders } from '@/lib/api';
import { buildPublicLeadPayload } from '../home-lead-payload';
import { buildOperatorLeadWebhookPayload } from '../home-lead-notification';

type ContactSearchParams = {
  notice?: string;
  error?: string;
  company?: string;
  warning?: string;
};

type BootstrapResponse = {
  ok: true;
  tenant: {
    id: string;
    businesses: Array<{
      id: string;
      name: string;
    }>;
  } | null;
};

type ImportLeadResponse = {
  ok: true;
  prospects: Array<{
    prospectSid: string;
  }>;
};

export const metadata: Metadata = {
  title: 'Contact | MoLeads',
  description: 'Request a workflow review with MoLeads and tighten the handoff between first contact and follow-up.'
};

async function getBootstrap() {
  const res = await fetch(`${getApiBaseUrl()}/v1/bootstrap`, {
    cache: 'no-store',
    headers: getInternalApiHeaders()
  });

  if (!res.ok) {
    throw new Error(`Failed to load bootstrap: ${res.status}`);
  }

  return (await res.json()) as BootstrapResponse;
}

function buildContactNoticeHref(notice: string, extras?: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  params.set('notice', notice);

  for (const [key, value] of Object.entries(extras ?? {})) {
    if (value) {
      params.set(key, value);
    }
  }

  return `/contact?${params.toString()}`;
}

function getAppBaseUrl() {
  return process.env.FRONTDESK_APP_BASE_URL ?? 'http://127.0.0.1:3001';
}

async function notifyOperatorOfLead(input: {
  prospectSid: string;
  lead: ReturnType<typeof buildPublicLeadPayload>;
}) {
  const webhookUrl = process.env.FRONTDESK_OPERATOR_WEBHOOK_URL;

  if (!webhookUrl) {
    return {
      ok: false as const,
      warning: 'Lead was captured, but operator notifications are not configured yet.'
    };
  }

  const payload = buildOperatorLeadWebhookPayload({
    prospectSid: input.prospectSid,
    lead: input.lead,
    appBaseUrl: getAppBaseUrl()
  });

  const response = await fetch(webhookUrl, {
    method: 'POST',
    cache: 'no-store',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    return {
      ok: false as const,
      warning: `Lead was captured, but operator notification failed with status ${response.status}.`
    };
  }

  return { ok: true as const };
}

export default async function ContactPage({
  searchParams
}: {
  searchParams: Promise<ContactSearchParams>;
}) {
  const resolved = await searchParams;
  const bootstrap = await getBootstrap();
  const activeBusiness = bootstrap.tenant?.businesses[0] ?? null;
  const tenantId = bootstrap.tenant?.id ?? null;
  const requestedCompany = resolved.company?.trim() || 'Your request';
  const successWarning = resolved.warning?.trim() || null;
  const leadRequested = resolved.notice === 'lead-requested';
  const failureMessage =
    resolved.notice === 'lead-request-failed'
      ? resolved.error?.trim() || 'Business intake request failed.'
      : null;

  async function requestConsultation(formData: FormData) {
    'use server';

    if (!activeBusiness || !tenantId) {
      redirect(
        buildContactNoticeHref('lead-request-failed', {
          error: 'No active business is configured for lead capture.'
        })
      );
    }

    let prospect;

    try {
      prospect = buildPublicLeadPayload(formData);
    } catch (error) {
      redirect(
        buildContactNoticeHref('lead-request-failed', {
          error: error instanceof Error ? error.message : 'Invalid lead request.'
        })
      );
    }

    const response = await fetch(
      `${getApiBaseUrl()}/v1/businesses/${activeBusiness.id}/prospects/import?tenantId=${encodeURIComponent(tenantId)}`,
      {
      method: 'POST',
      cache: 'no-store',
      headers: {
        ...getInternalApiHeaders(),
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        prospects: [prospect]
      })
      }
    );

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      redirect(
        buildContactNoticeHref('lead-request-failed', {
          error: body?.error ?? `Request failed with status ${response.status}.`
        })
      );
    }

    const imported = (await response.json()) as ImportLeadResponse;
    const prospectSid = imported.prospects[0]?.prospectSid;
    const notificationResult = prospectSid
      ? await notifyOperatorOfLead({
          prospectSid,
          lead: prospect
        })
      : {
          ok: false as const,
          warning: 'Lead was captured, but the created prospect could not be linked for notification.'
        };

    redirect(
      buildContactNoticeHref('lead-requested', {
        company: prospect.companyName,
        warning: notificationResult.ok ? undefined : notificationResult.warning
      })
    );
  }

  return (
    <main className="min-h-screen bg-[#f4ede4] text-[#15110e]">
      <section className="relative overflow-hidden bg-[#17120f] text-[#f8f1e7]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.22),_transparent_24%),radial-gradient(circle_at_82%_18%,_rgba(96,165,250,0.18),_transparent_20%),linear-gradient(145deg,_rgba(255,255,255,0.04),_transparent_35%)]" />
        <div className="relative mx-auto max-w-7xl px-6 py-8 md:px-10 lg:px-12">
          <header className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.34em] text-[#dcc8ac]">MoLeads</div>
              <div className="mt-2 text-sm text-[#c7b8a3]">Contact</div>
            </div>
            <div className="flex gap-3">
              <a
                href="/"
                className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-[#f8f1e7] transition hover:border-white/40 hover:bg-white/6"
              >
                Home
              </a>
              <a
                href="/services"
                className="rounded-full bg-[#f8f1e7] px-5 py-2.5 text-sm font-medium text-[#17120f] transition hover:-translate-y-0.5 hover:bg-white"
              >
                Services
              </a>
            </div>
          </header>

          <div className="max-w-4xl py-18 md:py-24">
            <div className="inline-flex rounded-full border border-white/12 bg-white/6 px-4 py-2 text-xs uppercase tracking-[0.28em] text-[#f0d7af]">
              Business intake request
            </div>
            <h1 className="mt-7 text-5xl leading-[0.92] font-semibold tracking-[-0.06em] md:text-7xl">
              Request an intake review for the part of your funnel where demand gets delayed, dropped, or worked inconsistently.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#d8c9b5] md:text-xl">
              Use this form when you want a clearer operating handoff between first contact and follow-up. The goal is not generic contact. The goal is to see how inbound demand should enter the workflow and stay actionable.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="max-w-xl">
            <div className="text-xs uppercase tracking-[0.28em] text-[#8e7054]">What happens next</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#17120f] md:text-5xl">
              This request is treated like intake, not a generic website contact message.
            </h2>
            <div className="mt-8 grid gap-4">
              {[
                {
                  step: '01',
                  title: 'Your request comes in',
                  body: 'The submitted details enter the same intake path used for real follow-up work instead of disappearing into a disconnected inbox.'
                },
                {
                  step: '02',
                  title: 'First-pass intake organizes the details',
                  body: 'The business, contact, and problem context are captured so the request starts in a usable shape for review.'
                },
                {
                  step: '03',
                  title: 'Operators review and follow up',
                  body: 'The team can review the request, prioritize it, and move it into next actions with visible workflow state.'
                }
              ].map((item) => (
                <div key={item.step} className="rounded-2xl border border-[#d8cdc0] bg-[#fff9f1] px-5 py-4">
                  <div className="text-xs font-medium tracking-[0.24em] text-[#8e7054]">{item.step}</div>
                  <div className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[#17120f]">{item.title}</div>
                  <div className="mt-2 text-sm leading-7 text-[#3f3127]">{item.body}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-[1.8rem] border border-[#d8cdc0] bg-[#fffaf3] p-6 shadow-[0_18px_60px_rgba(16,24,40,0.05)]">
              <div className="text-xs uppercase tracking-[0.28em] text-[#8e7054]">Operational reassurance</div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-[#3f3127]">
                <div>Inbound requests stay visible as work items, not loose email threads.</div>
                <div>Intake details stay attached so the follow-up path is easier to inspect.</div>
                <div>The team can see what came in and what changed next.</div>
              </div>
            </div>
          </div>

          <div>
            {failureMessage ? (
              <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {failureMessage}
              </div>
            ) : null}

            {leadRequested ? (
              <div className="grid gap-4 rounded-[2rem] border border-emerald-300/30 bg-[linear-gradient(180deg,_rgba(16,185,129,0.12),_rgba(255,255,255,0.82))] p-7 shadow-[0_24px_80px_rgba(16,24,40,0.08)]">
                <div className="text-xs uppercase tracking-[0.28em] text-[#147557]">Request received</div>
                <div className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] text-[#17120f]">
                  {requestedCompany} is now in the intake workflow.
                </div>
                {successWarning ? (
                  <div className="rounded-2xl border border-amber-300/40 bg-amber-100/70 px-4 py-3 text-sm text-[#6d4f0e]">
                    {successWarning}
                  </div>
                ) : null}
                <p className="max-w-2xl text-base leading-8 text-[#4b3a2d]">
                  The request has been captured as a live work item. First-pass intake keeps the submitted details attached, then operators can review it, prioritize it, and move it into follow-up with clear next actions.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <a
                    href="/contact"
                    className="rounded-full bg-[#17120f] px-6 py-3 text-sm font-medium text-[#f8f1e7] transition hover:-translate-y-0.5 hover:bg-[#2b221c]"
                  >
                    Submit another request
                  </a>
                  <a
                    href="/prospects?status=READY"
                    className="rounded-full border border-[#17120f]/15 px-6 py-3 text-sm font-medium text-[#17120f] transition hover:-translate-y-0.5 hover:border-[#17120f] hover:bg-white/70"
                  >
                    Open operator queue
                  </a>
                </div>
              </div>
            ) : (
              <form
                action={requestConsultation}
                className="grid gap-4 rounded-[2rem] border border-[#d9cdc0] bg-[#fffaf3] p-6 shadow-[0_24px_80px_rgba(16,24,40,0.08)]"
              >
                <div className="grid gap-2">
                  <div className="text-xs uppercase tracking-[0.28em] text-[#8e7054]">Business intake details</div>
                  <p className="max-w-2xl text-sm leading-7 text-[#5d4b3d]">
                    Send the business, contact, and intake context the team needs to understand the request on the first pass.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Company name</span>
                    <input
                      name="companyName"
                      placeholder="Sterling Dental Group"
                      required
                      className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Contact name</span>
                    <input
                      name="contactName"
                      placeholder="Alicia Grant"
                      className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Phone</span>
                    <span className="block text-xs leading-6 text-[#7b6654]">Add a direct callback number if phone follow-up is the best next step.</span>
                    <input
                      name="contactPhone"
                      placeholder="703-555-0200"
                      className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Email</span>
                    <span className="block text-xs leading-6 text-[#7b6654]">Use email when that is the best contact path or when phone is not available.</span>
                    <input
                      name="contactEmail"
                      type="email"
                      placeholder="owner@example.com"
                      className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">City</span>
                    <input
                      name="city"
                      placeholder="Reston"
                      className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">State</span>
                    <input
                      name="state"
                      placeholder="VA"
                      className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                    />
                  </label>
                </div>

                <label className="space-y-2 text-sm">
                  <span className="font-medium">What are you trying to improve?</span>
                  <span className="block text-xs leading-6 text-[#7b6654]">Describe the intake or follow-up part of the workflow that currently feels messy.</span>
                  <input
                    name="serviceInterest"
                    placeholder="Lead intake, follow-up, and operator visibility"
                    className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                  />
                </label>

                <label className="space-y-2 text-sm">
                  <span className="font-medium">Notes</span>
                  <textarea
                    name="notes"
                    rows={4}
                    placeholder="Tell us where leads are getting lost, delayed, or handled inconsistently."
                    className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                  />
                </label>

                <div className="rounded-2xl border border-[#ddd2c7] bg-[#fbf6ee] px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.24em] text-[#8e7054]">What happens after submit</div>
                  <div className="mt-3 grid gap-2 text-sm leading-7 text-[#3f3127]">
                    <div>1. The request is captured as intake work.</div>
                    <div>2. First-pass intake organizes the business and contact details.</div>
                    <div>3. Operators can review it and move follow-up forward.</div>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-md text-sm leading-6 text-[#5d4b3d]">
                    The request stays visible in the workflow instead of disappearing into a generic website inbox.
                  </p>
                <button className="rounded-full bg-[#17120f] px-6 py-3 text-sm font-medium text-[#f8f1e7] transition hover:-translate-y-0.5 hover:bg-[#2b221c]">
                    Request intake review
                </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
