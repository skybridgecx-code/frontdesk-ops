import type { Metadata } from 'next';
import Link from 'next/link';
import { Card } from '../components/card';
import {
  acquisitionStages,
  acquisitionTargets,
  getAcquisitionStats,
  getTodayActions,
  pitchAngles
} from './acquisition-data';

export const metadata: Metadata = {
  title: 'Client Acquisition | SkyBridgeCX'
};

const stageTone: Record<(typeof acquisitionStages)[number], 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate'> = {
  Researching: 'slate',
  Contacted: 'indigo',
  'Follow-up needed': 'amber',
  'Demo booked': 'indigo',
  'Pilot proposed': 'amber',
  Won: 'emerald',
  'Not now': 'rose'
};

function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function ToneBadge({
  children,
  tone
}: {
  children: React.ReactNode;
  tone: 'indigo' | 'emerald' | 'amber' | 'rose' | 'slate';
}) {
  const styles = {
    indigo: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    slate: 'border-gray-200 bg-gray-100 text-gray-700'
  } satisfies Record<string, string>;

  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold', styles[tone])}>
      {children}
    </span>
  );
}

export default function AcquisitionPage() {
  const stats = getAcquisitionStats(acquisitionTargets);
  const todayActions = getTodayActions(acquisitionTargets);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">Client Acquisition Command Center</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600 sm:text-base">
              Use Frontdesk OS to find, track, demo, and close local home-services businesses with a repeatable pipeline.
            </p>
          </div>
          <ToneBadge tone="slate">Demo-safe sample data</ToneBadge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/demo" className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">
            /demo
          </Link>
          <Link href="/dashboard" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100">
            /dashboard
          </Link>
          <Link href="/calls" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100">
            /calls
          </Link>
          <Link href="/prospects" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100">
            /prospects
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card title="Targets researched">
          <p className="text-3xl font-semibold tracking-tight text-gray-900">{stats.researched}</p>
        </Card>
        <Card title="Contacted">
          <p className="text-3xl font-semibold tracking-tight text-gray-900">{stats.contacted}</p>
        </Card>
        <Card title="Demos booked">
          <p className="text-3xl font-semibold tracking-tight text-gray-900">{stats.demosBooked}</p>
        </Card>
        <Card title="Follow-ups due">
          <p className="text-3xl font-semibold tracking-tight text-gray-900">{stats.followUpsDue}</p>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.5fr)]">
        <Card title="Sales pipeline" subtitle="All entries are clearly fake sample targets for local demo usage only.">
          <div className="mb-4 flex flex-wrap gap-2">
            {acquisitionStages.map((stage) => {
              const count = acquisitionTargets.filter((target) => target.stage === stage).length;
              return (
                <span key={stage} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
                  <span>{stage}</span>
                  <span className="text-gray-500">{count}</span>
                </span>
              );
            })}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-[1200px] divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-3 py-2.5">Business</th>
                  <th className="px-3 py-2.5">Vertical</th>
                  <th className="px-3 py-2.5">Location</th>
                  <th className="px-3 py-2.5">Website</th>
                  <th className="px-3 py-2.5">Pain point found</th>
                  <th className="px-3 py-2.5">Outreach status</th>
                  <th className="px-3 py-2.5">Last contacted</th>
                  <th className="px-3 py-2.5">Next follow-up</th>
                  <th className="px-3 py-2.5">Demo status</th>
                  <th className="px-3 py-2.5">Offer stage</th>
                  <th className="px-3 py-2.5">Stage</th>
                  <th className="px-3 py-2.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {acquisitionTargets.map((target) => (
                  <tr key={target.businessName}>
                    <td className="px-3 py-3 font-semibold text-gray-900">{target.businessName}</td>
                    <td className="px-3 py-3 text-gray-700">{target.vertical}</td>
                    <td className="px-3 py-3 text-gray-700">{target.location}</td>
                    <td className="px-3 py-3 text-gray-700">{target.website}</td>
                    <td className="px-3 py-3 text-gray-700">{target.painPoint}</td>
                    <td className="px-3 py-3 text-gray-700">{target.outreachStatus}</td>
                    <td className="px-3 py-3 text-gray-700">{target.lastContacted ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-700">{target.nextFollowUp ?? '—'}</td>
                    <td className="px-3 py-3 text-gray-700">{target.demoStatus}</td>
                    <td className="px-3 py-3 text-gray-700">{target.offerStage}</td>
                    <td className="px-3 py-3">
                      <ToneBadge tone={stageTone[target.stage]}>{target.stage}</ToneBadge>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{target.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Today's action list" subtitle="Operator tasks for today.">
            <ul className="space-y-2 text-sm text-gray-700">
              {todayActions.map((action) => (
                <li key={action.label} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="font-semibold text-gray-900">{action.label}</p>
                  <p className="mt-1 text-xs text-gray-600">{action.detail}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Pitch angle helper" subtitle="Use these hooks in outreach and demo calls.">
            <ul className="space-y-2 text-sm text-gray-700">
              {pitchAngles.map((angle) => (
                <li key={angle} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <span className="mt-0.5 text-indigo-500">•</span>
                  <span>{angle}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <p className="text-sm text-gray-600">
              This page is intentionally local and demo-safe. It does not scrape web data and does not include real business contact details.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
