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

function isImportedLead(value: unknown): value is AcquisitionTarget {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const row = value as Partial<AcquisitionTarget>;
  return Boolean(row.businessName && row.location && row.stage && row.source === 'Imported lead file');
}

export function AcquisitionClient() {
  const [importedTargets, setImportedTargets] = useState<AcquisitionTarget[]>([]);
  const [leadView, setLeadView] = useState<LeadView>('sample');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewTargets, setPreviewTargets] = useState<AcquisitionTarget[]>([]);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(IMPORT_STORAGE_KEY);
      if (!raw) {
        setLeadView('sample');
        return;
      }
      const parsed = JSON.parse(raw) as unknown[];
      const safeRows = Array.isArray(parsed) ? parsed.filter(isImportedLead) : [];
      setImportedTargets(safeRows);
      setLeadView(safeRows.length > 0 ? 'imported' : 'sample');
    } catch {
      setImportedTargets([]);
      setLeadView('sample');
    }
  }, []);

  const allTargets = useMemo(() => [...acquisitionTargets, ...importedTargets], [importedTargets]);
  const visibleTargets = useMemo(() => {
    if (leadView === 'imported') {
      return importedTargets;
    }
    if (leadView === 'sample') {
      return acquisitionTargets;
    }
    return allTargets;
  }, [leadView, importedTargets, allTargets]);
  const stats = useMemo(() => getAcquisitionStats(visibleTargets), [visibleTargets]);
  const todayActions = useMemo(() => getTodayActions(visibleTargets), [visibleTargets]);
  const preview = useMemo(() => buildImportPreview(previewTargets), [previewTargets]);
  const leadViewLabel = useMemo(() => {
    if (leadView === 'imported') {
      return 'Imported leads';
    }
    if (leadView === 'sample') {
      return 'Sample leads';
    }
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

  function persistImported(rows: AcquisitionTarget[]) {
    setImportedTargets(rows);
    localStorage.setItem(IMPORT_STORAGE_KEY, JSON.stringify(rows));
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
      setImportError('XLSX import is not enabled yet in this build. Save your sheet as CSV and re-import.');
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

  function handleImportToPipeline() {
    setImportError(null);
    setImportMessage(null);
    if (previewTargets.length === 0) {
      setImportError('Preview rows first before importing.');
      return;
    }

    const mergedResult = mergeImportedTargets(allTargets, previewTargets);
    const importedOnly = mergedResult.merged.filter((target) => target.source === 'Imported lead file');
    persistImported(importedOnly);
    if (importedOnly.length > 0) {
      setLeadView('imported');
    }
    setImportMessage(`Imported ${mergedResult.addedCount} new leads. Skipped ${mergedResult.skippedCount} duplicates.`);
    setPreviewTargets([]);
  }

  function handleClearImported() {
    persistImported([]);
    setLeadView('sample');
    setPreviewTargets([]);
    setImportMessage('Cleared imported leads from local storage.');
    setImportError(null);
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
          <ToneBadge tone="slate">Local demo-safe workflow</ToneBadge>
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

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.5fr)]">
        <Card title="Sales pipeline" subtitle={`Showing ${leadViewLabel.toLowerCase()}.`}>
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLeadView('imported')}
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
              onClick={() => setLeadView('sample')}
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
              onClick={() => setLeadView('all')}
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
            <table className="min-w-[1450px] divide-y divide-gray-200 text-sm">
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
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {visibleTargets.map((target) => (
                  <tr key={`${target.source}:${target.businessName}:${target.location}:${target.website}`}>
                    <td className="px-3 py-3 font-semibold text-gray-900">{target.businessName}</td>
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
                  </tr>
                ))}
                {visibleTargets.length === 0 ? (
                  <tr>
                    <td colSpan={15} className="px-3 py-8 text-center text-sm text-gray-500">
                      No leads in this view yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Import leads" subtitle="CSV import is parsed in-browser and stored only in localStorage.">
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
                  onClick={handlePreviewImport}
                  disabled={isParsing}
                  className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
                >
                  {isParsing ? 'Parsing…' : 'Preview import'}
                </button>
                <button
                  type="button"
                  onClick={handleImportToPipeline}
                  disabled={previewTargets.length === 0}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Import to acquisition pipeline
                </button>
              </div>
              {importMessage ? <p className="text-xs font-medium text-emerald-700">{importMessage}</p> : null}
              {importError ? <p className="text-xs font-medium text-rose-700">{importError}</p> : null}
              <p className="text-xs text-gray-500">
                XLSX support is not enabled in this lightweight build. Export your spreadsheet as CSV for local import.
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

          <Card title="Imported lead stats" subtitle="Calculated from local imported file rows only.">
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
                onClick={handleClearImported}
                disabled={importedTargets.length === 0}
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear imported leads
              </button>
            </div>
          </Card>

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
              This page is intentionally local and demo-safe. It does not scrape web data. Imported spreadsheets remain local to your browser in v1.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
