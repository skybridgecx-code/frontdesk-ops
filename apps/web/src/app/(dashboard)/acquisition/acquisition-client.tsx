'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '../components/card';
import {
  acquisitionStages,
  acquisitionTargets,
  getAcquisitionStats,
  getTodayActions,
  pitchAngles,
  type AcquisitionTarget
} from './acquisition-data';
import {
  buildImportPreview,
  exportTargetsToCsv,
  mapCsvRowsToTargets,
  mergeImportedTargets,
  parseCsvText
} from './acquisition-import';

const IMPORT_STORAGE_KEY = 'skybridgecx_acquisition_imported_leads_v1';
type LeadView = 'imported' | 'sample' | 'all';
type ApiMode = 'loading' | 'connected' | 'fallback';
type QuickAction = 'mark_contacted' | 'needs_follow_up' | 'demo_booked' | 'pilot_proposed' | 'won' | 'not_now';
type LeadEditorDraft = {
  stage: AcquisitionTarget['stage'];
  outreachStatus: string;
  demoStatus: string;
  offerStage: string;
  painPoint: string;
  notes: string;
  lastContacted: string;
  nextFollowUp: string;
};

type ApiLead = {
  id: string;
  businessName: string;
  vertical: string | null;
  services: string | null;
  location: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  yearsInBusiness: string | null;
  painPointFound: string | null;
  outreachStatus: string;
  stage: string;
  demoStatus: string;
  offerStage: string;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  notes: string | null;
  source: string;
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

const outreachStatusOptions = [
  'Not contacted',
  'Contacted',
  'Needs follow-up',
  'No response',
  'Paused'
] as const;

const demoStatusOptions = ['Not booked', 'Booked', 'Completed', 'Deferred'] as const;

const offerStageOptions = ['Not proposed', 'Pilot proposed', 'Pilot accepted', 'Revisit later'] as const;

const quickActionLabels: Record<QuickAction, string> = {
  mark_contacted: 'Mark contacted',
  needs_follow_up: 'Needs follow-up',
  demo_booked: 'Demo booked',
  pilot_proposed: 'Pilot proposed',
  won: 'Won',
  not_now: 'Not now'
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

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function toDayKey(value: Date) {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toDateInput(value: string | null | undefined) {
  if (!value) {
    return '';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return toDayKey(parsed);
}

function normalizePersistedLead(row: ApiLead): AcquisitionTarget {
  return {
    id: row.id,
    businessName: row.businessName,
    vertical: row.vertical ?? row.services ?? 'Home Services',
    services: row.services,
    location: row.location,
    phone: row.phone,
    email: row.email,
    website: row.website ?? '',
    yearsInBusiness: row.yearsInBusiness,
    painPoint: row.painPointFound ?? 'Needs outreach qualification',
    outreachStatus: row.outreachStatus,
    stage: (row.stage as AcquisitionTarget['stage']) ?? 'Researching',
    demoStatus: row.demoStatus,
    offerStage: row.offerStage,
    lastContacted: toDateInput(row.lastContactedAt),
    nextFollowUp: toDateInput(row.nextFollowUpAt),
    notes: row.notes ?? '',
    source: row.source || 'Imported lead file'
  };
}

function leadKey(target: AcquisitionTarget) {
  if (target.id) {
    return `id:${target.id}`;
  }
  return `sample:${target.businessName}:${target.location}:${target.website}:${target.source}`;
}

function createLeadEditorDraft(target: AcquisitionTarget): LeadEditorDraft {
  return {
    stage: target.stage,
    outreachStatus: target.outreachStatus || 'Not contacted',
    demoStatus: target.demoStatus || 'Not booked',
    offerStage: target.offerStage || 'Not proposed',
    painPoint: target.painPoint || '',
    notes: target.notes || '',
    lastContacted: target.lastContacted || '',
    nextFollowUp: target.nextFollowUp || ''
  };
}

function isImportedLead(value: unknown): value is AcquisitionTarget {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const row = value as Partial<AcquisitionTarget>;
  return Boolean(row.businessName && row.location && row.stage && row.source === 'Imported lead file');
}

function toApiDateOrNull(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

async function fetchAcquisitionLeadsFromApi() {
  const response = await fetch('/api/acquisition/leads', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Failed to load acquisition leads');
  }

  const payload = (await response.json()) as { ok?: boolean; leads?: ApiLead[] };
  if (payload.ok !== true || !Array.isArray(payload.leads)) {
    throw new Error('Malformed acquisition leads response');
  }

  return payload.leads.map(normalizePersistedLead);
}

export function AcquisitionClient() {
  const [apiMode, setApiMode] = useState<ApiMode>('loading');
  const [persistedLeads, setPersistedLeads] = useState<AcquisitionTarget[]>([]);
  const [fallbackImportedTargets, setFallbackImportedTargets] = useState<AcquisitionTarget[]>([]);
  const [leadView, setLeadView] = useState<LeadView>('sample');
  const [hasUserSelectedView, setHasUserSelectedView] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewTargets, setPreviewTargets] = useState<AcquisitionTarget[]>([]);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isUpdatingLead, setIsUpdatingLead] = useState(false);
  const [selectedLeadKey, setSelectedLeadKey] = useState<string | null>(null);
  const [leadEditor, setLeadEditor] = useState<LeadEditorDraft | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(IMPORT_STORAGE_KEY);
      if (!raw) {
        setFallbackImportedTargets([]);
        return;
      }
      const parsed = JSON.parse(raw) as unknown[];
      const safeRows = Array.isArray(parsed) ? parsed.filter(isImportedLead) : [];
      setFallbackImportedTargets(safeRows);
    } catch {
      setFallbackImportedTargets([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const leads = await fetchAcquisitionLeadsFromApi();
        if (cancelled) return;
        setPersistedLeads(leads);
        setApiMode('connected');
      } catch {
        if (cancelled) return;
        setApiMode('fallback');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const importedTargets = apiMode === 'connected' ? persistedLeads : fallbackImportedTargets;
  const allTargets = useMemo(() => [...acquisitionTargets, ...importedTargets], [importedTargets]);

  useEffect(() => {
    if (hasUserSelectedView) {
      return;
    }
    setLeadView(importedTargets.length > 0 ? 'imported' : 'sample');
  }, [importedTargets.length, hasUserSelectedView]);

  const visibleTargets = useMemo(() => {
    if (leadView === 'imported') return importedTargets;
    if (leadView === 'sample') return acquisitionTargets;
    return allTargets;
  }, [leadView, importedTargets, allTargets]);

  const selectedLead = useMemo(() => {
    if (!selectedLeadKey) {
      return null;
    }
    return allTargets.find((target) => leadKey(target) === selectedLeadKey) ?? null;
  }, [allTargets, selectedLeadKey]);

  useEffect(() => {
    if (!selectedLead) {
      setLeadEditor(null);
      return;
    }
    setLeadEditor(createLeadEditorDraft(selectedLead));
  }, [selectedLead]);

  const stats = useMemo(() => getAcquisitionStats(visibleTargets), [visibleTargets]);
  const todayActions = useMemo(() => getTodayActions(visibleTargets), [visibleTargets]);
  const preview = useMemo(() => buildImportPreview(previewTargets), [previewTargets]);

  const leadViewLabel = useMemo(() => {
    if (leadView === 'imported') return 'Imported leads';
    if (leadView === 'sample') return 'Sample leads';
    return 'All leads';
  }, [leadView]);

  const importedStats = useMemo(() => {
    const totalImported = importedTargets.length;
    const missingEmail = importedTargets.filter((target) => !target.email?.trim()).length;
    const missingPhone = importedTargets.filter((target) => !target.phone?.trim()).length;
    const readyForOutreach = importedTargets.filter(
      (target) => target.stage === 'Researching' && target.outreachStatus === 'Not contacted'
    ).length;
    return { totalImported, missingEmail, missingPhone, readyForOutreach };
  }, [importedTargets]);

  const canPersistSelectedLead = Boolean(selectedLead?.id) && apiMode === 'connected';

  function persistFallback(rows: AcquisitionTarget[]) {
    setFallbackImportedTargets(rows);
    localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(rows));
  }

  async function refreshFromApi() {
    const leads = await fetchAcquisitionLeadsFromApi();
    setPersistedLeads(leads);
    setApiMode('connected');
  }

  async function handlePreviewImport() {
    setImportError(null);
    setImportMessage(null);
    setPreviewTargets([]);

    if (!selectedFile) {
      setImportError('Choose a CSV file first.');
      return;
    }

    const lowerName = selectedFile.name.toLowerCase();
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      setImportError('XLSX import is not enabled in this build. Save your sheet as CSV and re-import.');
      return;
    }

    if (!lowerName.endsWith('.csv')) {
      setImportError('Only CSV is supported in this local import v1.');
      return;
    }

    setIsParsing(true);
    try {
      const text = await selectedFile.text();
      const { headers, rows } = parseCsvText(text);
      const mapped = mapCsvRowsToTargets(headers, rows);
      if (mapped.length === 0) {
        setImportError('No valid rows were found. Confirm the CSV has a "Company Name" column and data rows.');
        return;
      }
      setPreviewTargets(mapped);
      setImportMessage(`Parsed ${mapped.length} rows. Review preview before importing.`);
    } catch {
      setImportError('Could not parse the selected file.');
    } finally {
      setIsParsing(false);
    }
  }

  async function handleImportToPipeline() {
    setImportError(null);
    setImportMessage(null);
    if (previewTargets.length === 0) {
      setImportError('Preview rows first before importing.');
      return;
    }

    setIsImporting(true);
    try {
      const payload = {
        leads: previewTargets.map((row) => ({
          businessName: row.businessName,
          vertical: row.vertical ?? null,
          services: row.services ?? null,
          location: row.location,
          phone: row.phone ?? null,
          email: row.email ?? null,
          website: row.website ?? null,
          yearsInBusiness: row.yearsInBusiness ?? null,
          painPointFound: row.painPoint,
          outreachStatus: row.outreachStatus,
          stage: row.stage,
          demoStatus: row.demoStatus,
          offerStage: row.offerStage,
          lastContactedAt: toApiDateOrNull(row.lastContacted),
          nextFollowUpAt: toApiDateOrNull(row.nextFollowUp),
          notes: row.notes,
          source: 'Imported lead file'
        }))
      };

      const response = await fetch('/api/acquisition/leads/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('API import failed');
      }

      const data = (await response.json()) as { ok?: boolean; importedCount?: number; skippedCount?: number; leads?: ApiLead[] };
      if (data.ok !== true || !Array.isArray(data.leads)) {
        throw new Error('Malformed API import response');
      }

      setPersistedLeads(data.leads.map(normalizePersistedLead));
      setApiMode('connected');
      setLeadView('imported');
      setImportMessage(`Imported ${data.importedCount ?? 0} leads. Skipped ${data.skippedCount ?? 0} duplicates.`);
      setPreviewTargets([]);
    } catch {
      const mergedResult = mergeImportedTargets(fallbackImportedTargets, previewTargets);
      persistFallback(mergedResult.merged);
      setApiMode('fallback');
      setLeadView('imported');
      setImportMessage(
        `API unavailable, saved ${mergedResult.addedCount} leads to browser fallback. Skipped ${mergedResult.skippedCount} duplicates.`
      );
      setPreviewTargets([]);
    } finally {
      setIsImporting(false);
    }
  }

  async function handleClearImported() {
    setImportError(null);
    setImportMessage(null);

    if (apiMode === 'connected') {
      try {
        const response = await fetch('/api/acquisition/leads/imported', { method: 'DELETE' });
        if (!response.ok) {
          throw new Error('Failed');
        }
        await refreshFromApi();
        setLeadView('sample');
        setImportMessage('Cleared imported acquisition leads for this tenant.');
      } catch {
        setImportError('Could not clear imported leads from API.');
      }
      return;
    }

    persistFallback([]);
    setLeadView('sample');
    setImportMessage('Cleared imported leads from browser fallback.');
  }

  async function updateLead(id: string, payload: Record<string, unknown>) {
    if (apiMode !== 'connected') {
      setImportError('API is unavailable. Row actions require API connectivity.');
      return;
    }

    setIsUpdatingLead(true);
    setImportError(null);
    try {
      const response = await fetch(`/api/acquisition/leads/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Update failed');
      }

      const data = (await response.json()) as { ok?: boolean; lead?: ApiLead };
      if (data.ok !== true || !data.lead) {
        throw new Error('Malformed update response');
      }

      const normalized = normalizePersistedLead(data.lead);
      setPersistedLeads((current) => current.map((lead) => (lead.id === id ? normalized : lead)));
    } catch {
      setImportError('Could not update lead. Please try again.');
    } finally {
      setIsUpdatingLead(false);
    }
  }

  async function handleQuickAction(lead: AcquisitionTarget, action: QuickAction) {
    if (!lead.id) {
      return;
    }
    const stageMap: Record<QuickAction, string> = {
      mark_contacted: 'Contacted',
      needs_follow_up: 'Follow-up needed',
      demo_booked: 'Demo booked',
      pilot_proposed: 'Pilot proposed',
      won: 'Won',
      not_now: 'Not now'
    };
    const payload: Record<string, unknown> = {
      stage: stageMap[action]
    };
    if (action === 'mark_contacted') {
      payload.outreachStatus = 'Contacted';
      payload.lastContactedAt = new Date().toISOString();
    }
    await updateLead(lead.id, payload);
  }

  async function handleSaveLeadDetails() {
    if (!selectedLead?.id || !leadEditor) {
      return;
    }
    await updateLead(selectedLead.id, {
      stage: leadEditor.stage,
      outreachStatus: leadEditor.outreachStatus,
      demoStatus: leadEditor.demoStatus,
      offerStage: leadEditor.offerStage,
      painPointFound: leadEditor.painPoint || null,
      notes: leadEditor.notes || null,
      lastContactedAt: toApiDateOrNull(leadEditor.lastContacted),
      nextFollowUpAt: toApiDateOrNull(leadEditor.nextFollowUp)
    });
  }

  function handleExportJson() {
    downloadFile('acquisition-imported-leads.json', JSON.stringify(importedTargets, null, 2), 'application/json');
  }

  function handleExportCsv() {
    downloadFile('acquisition-imported-leads.csv', exportTargetsToCsv(importedTargets), 'text/csv;charset=utf-8');
  }

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
          <ToneBadge tone={apiMode === 'connected' ? 'emerald' : apiMode === 'loading' ? 'slate' : 'amber'}>
            {apiMode === 'connected' ? 'API connected' : apiMode === 'loading' ? 'Loading…' : 'Local fallback active'}
          </ToneBadge>
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
        <Card title={`Targets researched (${leadViewLabel})`}>
          <p className="text-3xl font-semibold tracking-tight text-gray-900">{stats.researched}</p>
        </Card>
        <Card title={`Contacted (${leadViewLabel})`}>
          <p className="text-3xl font-semibold tracking-tight text-gray-900">{stats.contacted}</p>
        </Card>
        <Card title={`Demos booked (${leadViewLabel})`}>
          <p className="text-3xl font-semibold tracking-tight text-gray-900">{stats.demosBooked}</p>
        </Card>
        <Card title={`Follow-ups due (${leadViewLabel})`}>
          <p className="text-3xl font-semibold tracking-tight text-gray-900">{stats.followUpsDue}</p>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.35fr)]">
        <Card title="Sales pipeline" subtitle={`Showing ${leadViewLabel.toLowerCase()}.`}>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setLeadView('imported');
                setHasUserSelectedView(true);
              }}
              disabled={importedTargets.length === 0}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                leadView === 'imported'
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
                importedTargets.length === 0 && 'cursor-not-allowed opacity-50'
              )}
            >
              Imported leads
            </button>
            <button
              type="button"
              onClick={() => {
                setLeadView('sample');
                setHasUserSelectedView(true);
              }}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                leadView === 'sample'
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              Sample leads
            </button>
            <button
              type="button"
              onClick={() => {
                setLeadView('all');
                setHasUserSelectedView(true);
              }}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-semibold transition',
                leadView === 'all'
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              All leads
            </button>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {acquisitionStages.map((stage) => {
              const count = visibleTargets.filter((target) => target.stage === stage).length;
              return (
                <span key={stage} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700">
                  <span>{stage}</span>
                  <span className="text-gray-500">{count}</span>
                </span>
              );
            })}
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-[1700px] divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="px-3 py-2.5">Business</th>
                  <th className="px-3 py-2.5">Vertical</th>
                  <th className="px-3 py-2.5">Location</th>
                  <th className="px-3 py-2.5">Website</th>
                  <th className="px-3 py-2.5">Phone</th>
                  <th className="px-3 py-2.5">Email</th>
                  <th className="px-3 py-2.5">Pain point found</th>
                  <th className="px-3 py-2.5">Outreach status</th>
                  <th className="px-3 py-2.5">Last contacted</th>
                  <th className="px-3 py-2.5">Next follow-up</th>
                  <th className="px-3 py-2.5">Demo status</th>
                  <th className="px-3 py-2.5">Offer stage</th>
                  <th className="px-3 py-2.5">Stage</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-3 py-2.5">Notes</th>
                  <th className="px-3 py-2.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {visibleTargets.map((target) => {
                  const editable = Boolean(target.id) && apiMode === 'connected';
                  return (
                    <tr key={`${target.id ?? target.source}:${target.businessName}:${target.location}:${target.website}`}>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedLeadKey(leadKey(target))}
                          className="text-left font-semibold text-indigo-700 hover:text-indigo-600 hover:underline"
                        >
                          {target.businessName}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-gray-700">{target.services ?? target.vertical}</td>
                      <td className="px-3 py-3 text-gray-700">{target.location}</td>
                      <td className="px-3 py-3 text-gray-700">{target.website || '—'}</td>
                      <td className="px-3 py-3 text-gray-700">{target.phone?.trim() || '—'}</td>
                      <td className="px-3 py-3 text-gray-700">{target.email?.trim() || '—'}</td>
                      <td className="px-3 py-3 text-gray-700">{target.painPoint}</td>
                      <td className="px-3 py-3 text-gray-700">{target.outreachStatus}</td>
                      <td className="px-3 py-3 text-gray-700">{target.lastContacted ?? '—'}</td>
                      <td className="px-3 py-3 text-gray-700">{target.nextFollowUp ?? '—'}</td>
                      <td className="px-3 py-3 text-gray-700">{target.demoStatus}</td>
                      <td className="px-3 py-3 text-gray-700">{target.offerStage}</td>
                      <td className="px-3 py-3">
                        <ToneBadge tone={stageTone[target.stage]}>{target.stage}</ToneBadge>
                      </td>
                      <td className="px-3 py-3">
                        <ToneBadge tone={target.source === 'Imported lead file' ? 'indigo' : 'slate'}>
                          {target.source === 'Imported lead file' ? 'Imported' : 'Sample'}
                        </ToneBadge>
                      </td>
                      <td className="px-3 py-3 text-gray-600">{target.notes}</td>
                      <td className="px-3 py-3">
                        {editable ? (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => setSelectedLeadKey(leadKey(target))}
                              className="rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                              Open / edit
                            </button>
                            <div className="flex flex-wrap gap-1">
                              {(
                                [
                                  'mark_contacted',
                                  'needs_follow_up',
                                  'demo_booked',
                                  'pilot_proposed',
                                  'won',
                                  'not_now'
                                ] as QuickAction[]
                              ).map((action) => (
                                <button
                                  key={`${target.id}-${action}`}
                                  type="button"
                                  className="rounded border border-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                                  onClick={() => void handleQuickAction(target, action)}
                                  disabled={isUpdatingLead}
                                >
                                  {quickActionLabels[action]}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-500">
                            {target.source === 'Sample acquisition data' ? 'Sample fallback' : 'API unavailable'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {visibleTargets.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="px-3 py-8 text-center text-sm text-gray-500">
                      No leads in this view yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Import leads" subtitle="CSV import is parsed in-browser; API persistence is primary with local fallback on failure.">
            <div className="space-y-3">
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handlePreviewImport()}
                  disabled={isParsing || isImporting || isUpdatingLead}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  {isParsing ? 'Parsing…' : 'Preview import'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleImportToPipeline()}
                  disabled={previewTargets.length === 0 || isImporting || isUpdatingLead}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isImporting ? 'Saving…' : 'Import to acquisition pipeline'}
                </button>
              </div>
              {importMessage ? <p className="text-xs font-medium text-emerald-700">{importMessage}</p> : null}
              {importError ? <p className="text-xs font-medium text-rose-700">{importError}</p> : null}
              <p className="text-xs text-gray-500">
                XLSX support is not enabled in this lightweight build. Export your spreadsheet as CSV for import.
              </p>
            </div>

            {preview.parsedRows > 0 ? (
              <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Preview</p>
                <p className="mt-1 text-sm text-gray-700">Rows parsed: {preview.parsedRows}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded border border-gray-200 bg-white px-2 py-1.5 text-gray-700">Missing phone: {preview.missingPhone}</div>
                  <div className="rounded border border-gray-200 bg-white px-2 py-1.5 text-gray-700">Missing email: {preview.missingEmail}</div>
                  <div className="rounded border border-gray-200 bg-white px-2 py-1.5 text-gray-700">Missing website: {preview.missingWebsite}</div>
                </div>
                <div className="mt-3 overflow-x-auto rounded border border-gray-200 bg-white">
                  <table className="min-w-[600px] text-xs">
                    <thead className="bg-gray-50 text-left uppercase tracking-wider text-gray-500">
                      <tr>
                        <th className="px-2 py-1.5">Business</th>
                        <th className="px-2 py-1.5">Location</th>
                        <th className="px-2 py-1.5">Services</th>
                        <th className="px-2 py-1.5">Phone</th>
                        <th className="px-2 py-1.5">Email</th>
                        <th className="px-2 py-1.5">Website</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.map((row) => (
                        <tr key={`preview-${row.businessName}-${row.location}`} className="border-t border-gray-100">
                          <td className="px-2 py-1.5 text-gray-700">{row.businessName}</td>
                          <td className="px-2 py-1.5 text-gray-700">{row.location}</td>
                          <td className="px-2 py-1.5 text-gray-700">{row.services ?? row.vertical}</td>
                          <td className="px-2 py-1.5 text-gray-700">{row.phone || '—'}</td>
                          <td className="px-2 py-1.5 text-gray-700">{row.email || '—'}</td>
                          <td className="px-2 py-1.5 text-gray-700">{row.website || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </Card>

          <Card title="Imported lead stats" subtitle={`Based on ${apiMode === 'connected' ? 'tenant-persisted' : 'browser fallback'} imported leads.`}>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Total imported</p>
                <p className="text-lg font-semibold text-gray-900">{importedStats.totalImported}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Missing email</p>
                <p className="text-lg font-semibold text-gray-900">{importedStats.missingEmail}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Missing phone</p>
                <p className="text-lg font-semibold text-gray-900">{importedStats.missingPhone}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs text-gray-500">Ready for outreach</p>
                <p className="text-lg font-semibold text-gray-900">{importedStats.readyForOutreach}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleExportJson}
                disabled={importedTargets.length === 0}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export imported as JSON
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={importedTargets.length === 0}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Export imported as CSV
              </button>
              <button
                type="button"
                onClick={() => void handleClearImported()}
                disabled={importedTargets.length === 0 || isImporting || isUpdatingLead}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear imported leads
              </button>
            </div>
          </Card>

          <Card title="Today's action list" subtitle={`Actions from ${leadViewLabel.toLowerCase()}.`}>
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
              Acquisition leads stay separate from customer prospect leads. Use <code>/prospects</code> for client-side captured leads and <code>/acquisition</code> for your own sales CRM.
            </p>
          </Card>
        </div>
      </section>

      {selectedLead && leadEditor ? (
        <div className="fixed inset-0 z-40 flex items-end justify-end bg-gray-900/40 p-0 sm:items-stretch">
          <button
            type="button"
            aria-label="Close lead detail"
            className="absolute inset-0"
            onClick={() => setSelectedLeadKey(null)}
          />
          <aside className="relative z-50 flex h-[92vh] w-full max-w-2xl flex-col border-l border-gray-200 bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Acquisition lead</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight text-gray-900">{selectedLead.businessName}</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    {selectedLead.location} · {selectedLead.services ?? selectedLead.vertical}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLeadKey(null)}
                  className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <ToneBadge tone={stageTone[leadEditor.stage]}>{leadEditor.stage}</ToneBadge>
                <ToneBadge tone={selectedLead.source === 'Imported lead file' ? 'indigo' : 'slate'}>
                  {selectedLead.source === 'Imported lead file' ? 'Imported' : 'Sample'}
                </ToneBadge>
                <ToneBadge tone={canPersistSelectedLead ? 'emerald' : 'amber'}>
                  {canPersistSelectedLead ? 'Persisted via API' : 'Read-only'}
                </ToneBadge>
              </div>
              {!canPersistSelectedLead ? (
                <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  {apiMode === 'fallback'
                    ? 'API unavailable. Lead edits are disabled until the acquisition API is reachable.'
                    : 'Sample leads are demo-only and cannot be edited.'}
                </p>
              ) : null}
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Stage</span>
                  <select
                    value={leadEditor.stage}
                    disabled={!canPersistSelectedLead || isUpdatingLead}
                    onChange={(event) =>
                      setLeadEditor((current) =>
                        current
                          ? {
                              ...current,
                              stage: event.target.value as AcquisitionTarget['stage']
                            }
                          : current
                      )
                    }
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                  >
                    {acquisitionStages.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Outreach status</span>
                  <select
                    value={leadEditor.outreachStatus}
                    disabled={!canPersistSelectedLead || isUpdatingLead}
                    onChange={(event) =>
                      setLeadEditor((current) => (current ? { ...current, outreachStatus: event.target.value } : current))
                    }
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                  >
                    {outreachStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Demo status</span>
                  <select
                    value={leadEditor.demoStatus}
                    disabled={!canPersistSelectedLead || isUpdatingLead}
                    onChange={(event) =>
                      setLeadEditor((current) => (current ? { ...current, demoStatus: event.target.value } : current))
                    }
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                  >
                    {demoStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Offer stage</span>
                  <select
                    value={leadEditor.offerStage}
                    disabled={!canPersistSelectedLead || isUpdatingLead}
                    onChange={(event) =>
                      setLeadEditor((current) => (current ? { ...current, offerStage: event.target.value } : current))
                    }
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                  >
                    {offerStageOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Last contacted</span>
                  <input
                    type="date"
                    value={leadEditor.lastContacted}
                    disabled={!canPersistSelectedLead || isUpdatingLead}
                    onChange={(event) =>
                      setLeadEditor((current) => (current ? { ...current, lastContacted: event.target.value } : current))
                    }
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Next follow-up</span>
                  <input
                    type="date"
                    value={leadEditor.nextFollowUp}
                    disabled={!canPersistSelectedLead || isUpdatingLead}
                    onChange={(event) =>
                      setLeadEditor((current) => (current ? { ...current, nextFollowUp: event.target.value } : current))
                    }
                    className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                  />
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Pain point found</span>
                <input
                  type="text"
                  value={leadEditor.painPoint}
                  disabled={!canPersistSelectedLead || isUpdatingLead}
                  onChange={(event) =>
                    setLeadEditor((current) => (current ? { ...current, painPoint: event.target.value } : current))
                  }
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                  placeholder="Document the strongest pain point you discovered"
                />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-gray-500">Notes</span>
                <textarea
                  value={leadEditor.notes}
                  disabled={!canPersistSelectedLead || isUpdatingLead}
                  onChange={(event) =>
                    setLeadEditor((current) => (current ? { ...current, notes: event.target.value } : current))
                  }
                  className="min-h-28 w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
                  placeholder="Add outreach context, objections, and next talking points."
                />
              </label>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Quick actions</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    ['mark_contacted', 'needs_follow_up', 'demo_booked', 'pilot_proposed', 'won', 'not_now'] as QuickAction[]
                  ).map((action) => (
                    <button
                      key={`drawer-action-${action}`}
                      type="button"
                      disabled={!canPersistSelectedLead || isUpdatingLead}
                      onClick={() => void handleQuickAction(selectedLead, action)}
                      className="rounded border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {quickActionLabels[action]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">Future workflow</p>
                <p className="mt-1 text-xs text-gray-600">
                  Convert to customer prospect: disabled for now. Keep acquisition CRM separate from client prospect records.
                </p>
              </div>
            </div>

            <div className="border-t border-gray-100 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLeadKey(null)}
                  className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveLeadDetails()}
                  disabled={!canPersistSelectedLead || isUpdatingLead}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  {isUpdatingLead ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
