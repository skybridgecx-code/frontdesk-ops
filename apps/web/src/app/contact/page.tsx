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
      ? resolved.error?.trim() || 'Lead request failed.'
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
              Workflow review request
            </div>
            <h1 className="mt-7 text-5xl leading-[0.92] font-semibold tracking-[-0.06em] md:text-7xl">
              Tell us where leads are getting delayed, dropped, or worked inconsistently.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-[#d8c9b5] md:text-xl">
              This is the cleanest place to start if you want a tighter handoff between first contact and follow-up, with less guesswork for the people doing the work.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 md:px-10 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="max-w-xl">
            <div className="text-xs uppercase tracking-[0.28em] text-[#8e7054]">How we work</div>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.05em] text-[#17120f] md:text-5xl">
              We usually start with the points where leads are delayed, lost, or followed up inconsistently.
            </h2>
            <div className="mt-8 grid gap-4">
              {[
                'Calls come in, but nobody trusts the handoff after first contact.',
                'Website requests arrive, but follow-up timing is inconsistent.',
                'Prospects are worked manually, with too much guesswork about what happens next.'
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-[#d8cdc0] bg-[#fff9f1] px-5 py-4 text-sm leading-7 text-[#3f3127]">
                  {item}
                </div>
              ))}
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
                  {requestedCompany} is now in the operator workflow.
                </div>
                {successWarning ? (
                  <div className="rounded-2xl border border-amber-300/40 bg-amber-100/70 px-4 py-3 text-sm text-[#6d4f0e]">
                    {successWarning}
                  </div>
                ) : null}
                <p className="max-w-2xl text-base leading-8 text-[#4b3a2d]">
                  The request has been captured as a live work item. From here, the operator queue can review it, prioritize it, and move it into follow-up with clear next actions.
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
                    <input
                      name="contactPhone"
                      placeholder="703-555-0200"
                      className="w-full rounded-xl border border-[#ddd2c7] bg-white px-3 py-2.5 text-sm text-[#17120f] placeholder:text-[#8d7763]"
                    />
                  </label>
                  <label className="space-y-2 text-sm">
                    <span className="font-medium">Email</span>
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

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-md text-sm leading-6 text-[#5d4b3d]">
                    This request becomes a real work item in the operator workflow, so the handoff starts the moment you submit it.
                  </p>
                  <button className="rounded-full bg-[#17120f] px-6 py-3 text-sm font-medium text-[#f8f1e7] transition hover:-translate-y-0.5 hover:bg-[#2b221c]">
                    Request workflow review
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
