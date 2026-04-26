'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterKey = 'All' | 'Estimate Requests' | 'Leaks' | 'Storm Damage' | 'Missed Calls' | 'Urgent' | 'Booked' | 'Needs Review';
type CallStatus = 'Captured' | 'Needs Review' | 'Follow-up Queued' | 'Booked' | 'Reviewed';
type FollowUpStatus = 'Queued' | 'Reviewed' | 'Scheduled' | 'Dismissed';
type JobStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Pending Estimate' | 'On Hold';
type CrewStatus = 'Active' | 'On Job' | 'Off Duty';
type ClaimStatus = 'Filed' | 'Under Review' | 'Approved' | 'Denied' | 'Pending Docs';
type Tab = 'overview' | 'calls' | 'schedule' | 'crew' | 'insurance';

type DemoCall = {
  id: string;
  caller: string;
  phone: string;
  type: 'Estimate Request' | 'Leak' | 'Storm Damage' | 'Missed Call' | 'Insurance Question';
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  status: CallStatus;
  sentiment: 'Calm' | 'Concerned' | 'Frustrated' | 'Anxious';
  time: string;
  summary: string;
  confidence: number;
  transcript: Array<{ speaker: 'AI' | 'Caller'; text: string }>;
  aiSummary: string;
  fields: {
    callerName: string;
    callbackPhone: string;
    serviceNeed: string;
    urgency: string;
    propertyType: string;
    cityArea: string;
    roofIssue: string;
    preferredCallbackWindow: string;
    bookingReadiness: string;
    insuranceMention: string;
  };
  riskFlags: Array<'active leak' | 'after-hours missed call' | 'needs human review' | 'duplicate callback'>;
  timeline: string[];
};

type Job = {
  id: string;
  customer: string;
  address: string;
  type: string;
  status: JobStatus;
  assignedCrew: string;
  scheduledDate: string;
  estimateValue: string;
  notes: string;
};

type CrewMember = {
  id: string;
  name: string;
  role: string;
  status: CrewStatus;
  certifications: string[];
  activeJob: string | null;
  phone: string;
};

type InsuranceClaim = {
  id: string;
  customer: string;
  insurer: string;
  claimNumber: string;
  status: ClaimStatus;
  dateFiled: string;
  estimatedValue: string;
  adjusterName: string;
  notes: string;
};

type FollowUp = {
  id: string;
  label: string;
  caller: string;
  detail: string;
  status: FollowUpStatus;
  priority: 'high' | 'medium' | 'low';
};

// ─── Demo Data ────────────────────────────────────────────────────────────────

const CALL_FILTERS: FilterKey[] = ['All', 'Estimate Requests', 'Leaks', 'Storm Damage', 'Missed Calls', 'Urgent', 'Booked', 'Needs Review'];

const fieldLabels: Record<keyof DemoCall['fields'], string> = {
  callerName: 'Caller name',
  callbackPhone: 'Callback phone',
  serviceNeed: 'Service need',
  urgency: 'Urgency',
  propertyType: 'Property type',
  cityArea: 'City / area',
  roofIssue: 'Roof issue',
  preferredCallbackWindow: 'Preferred callback window',
  bookingReadiness: 'Booking readiness',
  insuranceMention: 'Insurance mention'
};

const INITIAL_CALLS: DemoCall[] = [
  {
    id: 'call-101', caller: 'Maya P.', phone: '(555) 014-3821',
    type: 'Leak', urgency: 'Critical', status: 'Needs Review', sentiment: 'Anxious',
    time: '8 min ago', summary: 'Caller reported water dripping near an upstairs hallway light after heavy rain.',
    confidence: 94,
    transcript: [
      { speaker: 'AI', text: 'Thanks for calling Ridgeline Roofing. Are you calling about a repair, leak, or estimate?' },
      { speaker: 'Caller', text: 'There is water coming through near a ceiling light and I am worried it is getting worse.' },
      { speaker: 'AI', text: 'I will flag this as urgent. Is anyone safe right now, and what is the best callback number?' }
    ],
    aiSummary: 'Urgent leak intake. Caller described active interior water near an electrical fixture and requested a morning callback if possible.',
    fields: { callerName: 'Maya P.', callbackPhone: '(555) 014-3821', serviceNeed: 'Leak triage', urgency: 'Critical', propertyType: 'Single-family home', cityArea: 'Sample Area NE', roofIssue: 'Interior leak near upstairs hallway light', preferredCallbackWindow: 'Morning callback', bookingReadiness: 'Ready for dispatch review', insuranceMention: 'Not mentioned' },
    riskFlags: ['active leak', 'needs human review'],
    timeline: ['AI captured roof leak location', 'Caller requested morning callback', 'Marked urgency as high due to active interior leak', 'Follow-up recommended within 15 minutes']
  },
  {
    id: 'call-102', caller: 'Daniel R.', phone: '(555) 018-7194',
    type: 'Estimate Request', urgency: 'Medium', status: 'Captured', sentiment: 'Calm',
    time: '22 min ago', summary: 'Caller wants a roof replacement estimate and asked what photos would help.',
    confidence: 91,
    transcript: [
      { speaker: 'AI', text: 'I can capture the estimate request and send the details to the team.' },
      { speaker: 'Caller', text: 'Great. I am planning ahead and can send photos if that helps.' },
      { speaker: 'AI', text: 'I noted the request and that photos are available before scheduling.' }
    ],
    aiSummary: 'Estimate request. Caller is comparison shopping, has photos available, and is flexible on scheduling.',
    fields: { callerName: 'Daniel R.', callbackPhone: '(555) 018-7194', serviceNeed: 'Replacement estimate', urgency: 'Medium', propertyType: 'Townhome', cityArea: 'Example West', roofIssue: 'Aging shingles, no active leak', preferredCallbackWindow: 'This afternoon', bookingReadiness: 'Needs estimate scheduling', insuranceMention: 'Not mentioned' },
    riskFlags: [],
    timeline: ['AI captured replacement estimate request', 'Caller offered roof photos', 'No emergency language detected', 'Estimate scheduling follow-up recommended']
  },
  {
    id: 'call-103', caller: 'Priya S.', phone: '(555) 017-0446',
    type: 'Storm Damage', urgency: 'High', status: 'Follow-up Queued', sentiment: 'Concerned',
    time: '41 min ago', summary: 'Caller noticed missing shingles after a storm and asked about insurance photos.',
    confidence: 89,
    transcript: [
      { speaker: 'Caller', text: 'The wind pulled shingles off one side. I do not know if it is urgent.' },
      { speaker: 'AI', text: 'I will mark this as storm damage and ask the team to review next steps.' },
      { speaker: 'Caller', text: 'I may need to ask my insurer what they need.' }
    ],
    aiSummary: 'Storm damage intake with possible insurance question. Caller has visible shingle damage but did not report interior water.',
    fields: { callerName: 'Priya S.', callbackPhone: '(555) 017-0446', serviceNeed: 'Storm damage review', urgency: 'High', propertyType: 'Single-family home', cityArea: 'Sample South', roofIssue: 'Missing shingles on one slope', preferredCallbackWindow: 'After 3 PM', bookingReadiness: 'Needs photos before scheduling', insuranceMention: 'Possible insurance documentation question' },
    riskFlags: ['needs human review'],
    timeline: ['AI identified storm damage language', 'Caller mentioned possible insurance documentation', 'Photo request recommended before estimate', 'Human review queued due to coverage question']
  },
  {
    id: 'call-104', caller: 'Chris L.', phone: '(555) 019-2208',
    type: 'Missed Call', urgency: 'High', status: 'Needs Review', sentiment: 'Frustrated',
    time: '1 hr ago', summary: 'After-hours missed call recovered by AI text-back; garage roof leak.',
    confidence: 86,
    transcript: [
      { speaker: 'AI', text: 'Sorry we missed you. Can you share what roof issue you need help with?' },
      { speaker: 'Caller', text: 'Garage roof is leaking after last night. I need somebody to call me back.' },
      { speaker: 'AI', text: 'I will send this to the team as an after-hours leak callback.' }
    ],
    aiSummary: 'Missed-call recovery. Caller replied to AI follow-up and needs a callback about a garage roof leak.',
    fields: { callerName: 'Chris L.', callbackPhone: '(555) 019-2208', serviceNeed: 'Missed-call recovery', urgency: 'High', propertyType: 'Residential garage', cityArea: 'Sample Area NW', roofIssue: 'Garage roof leak after rain', preferredCallbackWindow: 'As soon as available', bookingReadiness: 'Needs callback confirmation', insuranceMention: 'Not mentioned' },
    riskFlags: ['after-hours missed call', 'active leak'],
    timeline: ['AI recovered after-hours missed call', 'Caller replied with garage roof leak details', 'Urgency raised because leak is active', 'Callback recommended before next business block']
  },
  {
    id: 'call-105', caller: 'Nora W.', phone: '(555) 016-5582',
    type: 'Insurance Question', urgency: 'Low', status: 'Booked', sentiment: 'Calm',
    time: '2 hr ago', summary: 'Caller asked what information to have ready before an inspection conversation.',
    confidence: 88,
    transcript: [
      { speaker: 'Caller', text: 'I am trying to understand what to have ready before I talk to someone.' },
      { speaker: 'AI', text: 'I can note your question and route it for review.' },
      { speaker: 'Caller', text: 'Tomorrow morning works for a call.' }
    ],
    aiSummary: 'Non-urgent callback. Caller asked a general insurance documentation question and preferred tomorrow morning.',
    fields: { callerName: 'Nora W.', callbackPhone: '(555) 016-5582', serviceNeed: 'Insurance question callback', urgency: 'Low', propertyType: 'Single-family home', cityArea: 'Example Central', roofIssue: 'No specific damage confirmed', preferredCallbackWindow: 'Tomorrow morning', bookingReadiness: 'Booked for callback', insuranceMention: 'Asked what information may be useful' },
    riskFlags: [],
    timeline: ['AI classified call as non-urgent', 'Caller asked a documentation question', 'Callback window captured', 'Marked booked']
  }
];

const INITIAL_FOLLOW_UPS: FollowUp[] = [
  { id: 'fu-1', label: 'Urgent leak callback', caller: 'Maya P.', detail: 'Active interior leak near electrical fixture. Callback within 15 min.', status: 'Queued', priority: 'high' },
  { id: 'fu-2', label: 'Estimate scheduling', caller: 'Daniel R.', detail: 'Schedule replacement estimate. Request photo upload path.', status: 'Queued', priority: 'medium' },
  { id: 'fu-3', label: 'Storm photo request', caller: 'Priya S.', detail: 'Ask for storm damage photos before scheduling review.', status: 'Reviewed', priority: 'medium' },
  { id: 'fu-4', label: 'Insurance question', caller: 'Nora W.', detail: 'Route general documentation question to operator.', status: 'Scheduled', priority: 'low' },
  { id: 'fu-5', label: 'After-hours recovery', caller: 'Chris L.', detail: 'Recovered missed call. Garage roof leak needs priority callback.', status: 'Queued', priority: 'high' }
];

const JOBS: Job[] = [
  { id: 'j-001', customer: 'The Harmon Family', address: '4812 Oakridge Blvd', type: 'Full Replacement', status: 'In Progress', assignedCrew: 'Team Alpha', scheduledDate: 'Today, 8:00 AM', estimateValue: '$14,200', notes: 'GAF Timberline HDZ, charcoal. Customer approved upgrade to lifetime warranty.' },
  { id: 'j-002', customer: 'Sunrise Property Mgmt', address: '291 Commerce Park Dr', type: 'Storm Damage Repair', status: 'Scheduled', assignedCrew: 'Team Beta', scheduledDate: 'Tomorrow, 7:30 AM', estimateValue: '$3,850', notes: 'Wind damage to NW slope. Insurance claim #CL-88241 approved.' },
  { id: 'j-003', customer: 'Marcus Williams', address: '7703 Elm Street', type: 'Leak Repair', status: 'Pending Estimate', assignedCrew: 'Unassigned', scheduledDate: 'Apr 29', estimateValue: 'TBD', notes: 'Active leak near chimney flashing. AI captured call, estimate needed before scheduling.' },
  { id: 'j-004', customer: 'Clearview Condos HOA', address: '5500 Clearview Ct', type: 'Commercial Re-roof', status: 'Scheduled', assignedCrew: 'Team Gamma', scheduledDate: 'May 2', estimateValue: '$67,000', notes: '32-unit condo complex. TPO membrane. Permit pending.' },
  { id: 'j-005', customer: 'Elena Vasquez', address: '128 Pinecrest Lane', type: 'Gutter Replacement', status: 'Completed', assignedCrew: 'Team Alpha', scheduledDate: 'Apr 24', estimateValue: '$1,400', notes: 'Full K-style gutter system. Customer left 5-star review.' }
];

const CREW: CrewMember[] = [
  { id: 'cm-1', name: 'Jake Thornton', role: 'Lead Installer', status: 'On Job', certifications: ['GAF Certified', 'OSHA 10', 'Fall Protection'], activeJob: '4812 Oakridge Blvd', phone: '(555) 201-4488' },
  { id: 'cm-2', name: 'Marco Delgado', role: 'Foreman', status: 'On Job', certifications: ['CertainTeed Master', 'OSHA 30', 'Aerial Lift'], activeJob: '4812 Oakridge Blvd', phone: '(555) 201-4489' },
  { id: 'cm-3', name: 'Sandra Okafor', role: 'Estimator', status: 'Active', certifications: ['Xactimate Certified', 'Insurance Claims Specialist'], activeJob: null, phone: '(555) 201-4490' },
  { id: 'cm-4', name: 'Tyler Brooks', role: 'Installer', status: 'Active', certifications: ['OSHA 10', 'Owens Corning Preferred'], activeJob: null, phone: '(555) 201-4491' },
  { id: 'cm-5', name: 'Destiny Kim', role: 'Apprentice', status: 'Off Duty', certifications: ['First Aid/CPR'], activeJob: null, phone: '(555) 201-4492' }
];

const CLAIMS: InsuranceClaim[] = [
  { id: 'cl-001', customer: 'Sunrise Property Mgmt', insurer: 'StateFarm', claimNumber: 'CL-88241', status: 'Approved', dateFiled: 'Apr 18', estimatedValue: '$3,850', adjusterName: 'Robert Chen', notes: 'Wind damage approved. Check mailed. Job scheduled May 1.' },
  { id: 'cl-002', customer: 'Priya Sundaram', insurer: 'Allstate', claimNumber: 'CL-92043', status: 'Under Review', dateFiled: 'Apr 23', estimatedValue: '$6,200', adjusterName: 'Maria Torres', notes: 'Storm damage, missing shingles. Adjuster visit scheduled Apr 30.' },
  { id: 'cl-003', customer: 'Grant Holloway', insurer: 'Nationwide', claimNumber: 'CL-76190', status: 'Pending Docs', dateFiled: 'Apr 20', estimatedValue: '$11,400', adjusterName: 'Daniel Park', notes: 'Waiting on customer to submit photos and signed authorization.' },
  { id: 'cl-004', customer: 'Ridgeview Apartments', insurer: 'Travelers', claimNumber: 'CL-55822', status: 'Filed', dateFiled: 'Apr 25', estimatedValue: '$28,700', adjusterName: 'TBD', notes: 'Hail damage across 3 buildings. Claim just submitted.' },
  { id: 'cl-005', customer: 'The Preston Home', insurer: 'Liberty Mutual', claimNumber: 'CL-61034', status: 'Denied', dateFiled: 'Mar 12', estimatedValue: '$4,100', adjusterName: 'Amy Wilson', notes: 'Denied: pre-existing wear. Customer considering cash repair option.' }
];

const KPI_DATA = [
  { label: 'Calls handled today', value: '38', change: '+12', up: true, icon: '📞' },
  { label: 'Missed calls recovered', value: '9', change: '82% rate', up: true, icon: '🔄' },
  { label: 'Estimate requests', value: '14', change: 'Repair & replacement', up: true, icon: '📋' },
  { label: 'Urgent calls flagged', value: '5', change: 'Leaks & storm', up: false, icon: '⚡' },
  { label: 'Active jobs', value: '4', change: '1 completed today', up: true, icon: '🏗️' },
  { label: 'Open claims', value: '4', change: '1 approved', up: true, icon: '📄' }
];

// ─── Style Helpers ────────────────────────────────────────────────────────────

function callStatusStyle(status: CallStatus): React.CSSProperties {
  if (status === 'Booked')           return { background: '#D1FAE5', color: '#065F46' };
  if (status === 'Needs Review')     return { background: '#FEF3C7', color: '#92400E' };
  if (status === 'Follow-up Queued') return { background: '#EDE9FE', color: '#5B21B6' };
  if (status === 'Reviewed')         return { background: '#E0E7FF', color: '#3730A3' };
  return { background: 'var(--surface-2)', color: 'var(--text-secondary)' };
}

function urgencyStyle(urgency: DemoCall['urgency']): React.CSSProperties {
  if (urgency === 'Critical') return { color: '#991B1B' };
  if (urgency === 'High')     return { color: '#92400E' };
  if (urgency === 'Medium')   return { color: '#1D4ED8' };
  return { color: 'var(--text-tertiary)' };
}

function jobStatusStyle(status: JobStatus): React.CSSProperties {
  if (status === 'Completed')        return { background: '#D1FAE5', color: '#065F46' };
  if (status === 'In Progress')      return { background: '#EDE9FE', color: '#5B21B6' };
  if (status === 'Scheduled')        return { background: '#DBEAFE', color: '#1D4ED8' };
  if (status === 'Pending Estimate') return { background: '#FEF3C7', color: '#92400E' };
  return { background: 'var(--surface-2)', color: 'var(--text-secondary)' };
}

function crewStatusStyle(status: CrewStatus): React.CSSProperties {
  if (status === 'On Job')  return { background: '#EDE9FE', color: '#5B21B6' };
  if (status === 'Active')  return { background: '#D1FAE5', color: '#065F46' };
  return { background: 'var(--surface-2)', color: 'var(--text-secondary)' };
}

function claimStatusStyle(status: ClaimStatus): React.CSSProperties {
  if (status === 'Approved')      return { background: '#D1FAE5', color: '#065F46' };
  if (status === 'Denied')        return { background: '#FEE2E2', color: '#991B1B' };
  if (status === 'Under Review')  return { background: '#DBEAFE', color: '#1D4ED8' };
  if (status === 'Pending Docs')  return { background: '#FEF3C7', color: '#92400E' };
  return { background: 'var(--surface-2)', color: 'var(--text-secondary)' };
}

function priorityStyle(priority: FollowUp['priority']): React.CSSProperties {
  if (priority === 'high')   return { background: '#FEE2E2', color: '#991B1B' };
  if (priority === 'medium') return { background: '#FEF3C7', color: '#92400E' };
  return { background: 'var(--surface-2)', color: 'var(--text-secondary)' };
}

function matchesFilter(call: DemoCall, filter: FilterKey) {
  if (filter === 'All')              return true;
  if (filter === 'Estimate Requests') return call.type === 'Estimate Request';
  if (filter === 'Leaks')            return call.type === 'Leak';
  if (filter === 'Storm Damage')     return call.type === 'Storm Damage';
  if (filter === 'Missed Calls')     return call.type === 'Missed Call';
  if (filter === 'Urgent')           return call.urgency === 'High' || call.urgency === 'Critical';
  if (filter === 'Booked')           return call.status === 'Booked';
  if (filter === 'Needs Review')     return call.status === 'Needs Review';
  return true;
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function Pill({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={style}
    >
      {children}
    </span>
  );
}

function SectionCard({ title, subtitle, children, className }: { title?: string; subtitle?: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl ${className ?? ''}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
    >
      {title && (
        <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Tab Components ───────────────────────────────────────────────────────────

function OverviewTab({ calls, followUps, onUpdateFollowUp }: { calls: DemoCall[]; followUps: FollowUp[]; onUpdateFollowUp: (id: string, status: FollowUpStatus) => void }) {
  const urgent = calls.filter(c => c.urgency === 'Critical' || c.urgency === 'High');
  const needsReview = calls.filter(c => c.status === 'Needs Review');

  return (
    <div className="space-y-5">
      {/* KPI Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KPI_DATA.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="flex items-start justify-between">
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{kpi.label}</p>
              <span className="text-xl">{kpi.icon}</span>
            </div>
            <p className="mt-3 text-3xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>{kpi.value}</p>
            <p
              className="mt-1 text-xs font-medium"
              style={{ color: kpi.up ? '#065F46' : '#991B1B' }}
            >
              {kpi.change}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Urgent Calls */}
        <SectionCard title="Urgent Calls" subtitle={`${urgent.length} need immediate attention`}>
          {urgent.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>No urgent calls right now.</p>
          ) : (
            <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
              {urgent.map((call) => (
                <div key={call.id} className="flex items-start gap-3 px-5 py-4">
                  <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: '#FEE2E2', color: '#991B1B' }}
                  >
                    !
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{call.caller}</p>
                      <Pill style={urgencyStyle(call.urgency)}>{call.urgency}</Pill>
                    </div>
                    <p className="mt-0.5 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{call.summary}</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{call.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Follow-up Queue */}
        <SectionCard title="Follow-up Queue" subtitle="Action items for your team">
          <div className="divide-y">
            {followUps.filter(f => f.status === 'Queued').slice(0, 4).map((fu) => (
              <div key={fu.id} className="flex items-start gap-3 px-5 py-4">
                <div
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-full mt-2"
                  style={{ background: fu.priority === 'high' ? '#EF4444' : fu.priority === 'medium' ? '#F59E0B' : '#10B981' }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{fu.caller}</p>
                    <Pill style={priorityStyle(fu.priority)}>{fu.priority}</Pill>
                  </div>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>{fu.label}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onUpdateFollowUp(fu.id, 'Reviewed')}
                  className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                >
                  Done
                </button>
              </div>
            ))}
            {followUps.filter(f => f.status === 'Queued').length === 0 && (
              <p className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>Queue is clear — great work!</p>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Jobs overview */}
      <SectionCard title="Active Jobs" subtitle="Current field operations">
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Customer', 'Type', 'Crew', 'Scheduled', 'Value', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {JOBS.filter(j => j.status !== 'Completed').map((job, i) => (
                <tr
                  key={job.id}
                  style={{ borderBottom: i < JOBS.filter(j => j.status !== 'Completed').length - 1 ? '1px solid var(--border)' : 'none' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td className="px-4 py-3">
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{job.customer}</p>
                    <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{job.address}</p>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{job.type}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{job.assignedCrew}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{job.scheduledDate}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>{job.estimateValue}</td>
                  <td className="px-4 py-3">
                    <Pill style={jobStatusStyle(job.status)}>{job.status}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function CallsTab({ calls, setCalls }: { calls: DemoCall[]; setCalls: React.Dispatch<React.SetStateAction<DemoCall[]>> }) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('All');
  const [selectedCallId, setSelectedCallId] = useState(calls[0]?.id ?? '');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const selectedCall = calls.find(c => c.id === selectedCallId) ?? calls[0];
  const filteredCalls = useMemo(() => calls.filter(c => matchesFilter(c, activeFilter)), [activeFilter, calls]);

  function updateCall(status: CallStatus, note: string) {
    setCalls(prev => prev.map(c => c.id === selectedCall.id ? { ...c, status, timeline: [note, ...c.timeline] } : c));
  }

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(`${selectedCall.caller} | ${selectedCall.type} | ${selectedCall.urgency} | ${selectedCall.aiSummary}`);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch { setCopyState('failed'); }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_420px]">
      {/* Call inbox */}
      <SectionCard title="Call Inbox" subtitle="AI-captured calls with extraction details">
        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto px-5 pb-4 pt-4">
          {CALL_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setActiveFilter(f)}
              className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
              style={activeFilter === f
                ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }
                : { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }
              }
              onMouseEnter={(e) => { if (activeFilter !== f) (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
              onMouseLeave={(e) => { if (activeFilter !== f) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full table-auto text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
                {['Caller', 'Type', 'Urgency', 'Status', 'Time', 'Confidence'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCalls.map((call, i) => (
                <tr
                  key={call.id}
                  onClick={() => setSelectedCallId(call.id)}
                  className="cursor-pointer transition-colors"
                  style={{
                    borderBottom: i < filteredCalls.length - 1 ? '1px solid var(--border)' : 'none',
                    background: selectedCall.id === call.id ? 'var(--accent-dim)' : 'transparent'
                  }}
                  onMouseEnter={(e) => { if (selectedCall.id !== call.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                  onMouseLeave={(e) => { if (selectedCall.id !== call.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{call.caller}</p>
                    <p className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{call.phone}</p>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{call.type}</td>
                  <td className="px-4 py-3 font-semibold text-xs" style={urgencyStyle(call.urgency)}>{call.urgency}</td>
                  <td className="px-4 py-3"><Pill style={callStatusStyle(call.status)}>{call.status}</Pill></td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{call.time}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-14 overflow-hidden rounded-full" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${call.confidence}%`, background: 'var(--accent)' }} />
                      </div>
                      <span className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{call.confidence}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Call detail */}
      <div className="space-y-4">
        <SectionCard title={selectedCall.caller} subtitle={`${selectedCall.type} · ${selectedCall.time}`}>
          <div className="p-5 space-y-5">
            <div className="flex flex-wrap gap-2">
              <Pill style={callStatusStyle(selectedCall.status)}>{selectedCall.status}</Pill>
              <Pill style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{selectedCall.type}</Pill>
              <Pill style={{ ...urgencyStyle(selectedCall.urgency), background: selectedCall.urgency === 'Critical' ? '#FEE2E2' : selectedCall.urgency === 'High' ? '#FEF3C7' : 'var(--surface-2)' }}>
                {selectedCall.urgency} urgency
              </Pill>
            </div>

            {/* Transcript */}
            <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Transcript</p>
              {selectedCall.transcript.map((line, idx) => (
                <div key={idx} className="grid grid-cols-[44px_1fr] gap-2 text-sm">
                  <span
                    className="text-xs font-bold uppercase tracking-wide"
                    style={{ color: line.speaker === 'AI' ? 'var(--accent)' : 'var(--text-secondary)' }}
                  >
                    {line.speaker}
                  </span>
                  <span style={{ color: 'var(--text-primary)' }}>{line.text}</span>
                </div>
              ))}
            </div>

            {/* AI Summary */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)' }}>AI Summary</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{selectedCall.aiSummary}</p>
            </div>

            {/* Captured fields */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-tertiary)' }}>Captured Fields</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.entries(selectedCall.fields) as Array<[keyof DemoCall['fields'], string]>).map(([key, val]) => (
                  <div key={key} className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--text-tertiary)' }}>{fieldLabels[key]}</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{val}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk flags */}
            {selectedCall.riskFlags.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-tertiary)' }}>Risk Flags</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCall.riskFlags.map((f) => (
                    <Pill key={f} style={{ background: '#FEF3C7', color: '#92400E' }}>{f}</Pill>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => updateCall('Reviewed', 'Operator marked reviewed')}
                className="rounded-lg py-2.5 text-sm font-semibold transition-colors"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
              >Mark Reviewed</button>
              <button type="button" onClick={() => updateCall('Booked', 'Operator marked booked')}
                className="rounded-lg py-2.5 text-sm font-semibold transition-colors"
                style={{ background: '#D1FAE5', color: '#065F46' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
              >Mark Booked</button>
              <button type="button" onClick={copySummary}
                className="col-span-2 rounded-lg py-2.5 text-sm font-semibold transition-colors"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(99,102,241,0.2)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(99,102,241,0.15)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--accent-dim)'; }}
              >
                {copyState === 'copied' ? '✓ Copied!' : 'Copy AI Summary'}
              </button>
            </div>
          </div>
        </SectionCard>

        {/* Timeline */}
        <SectionCard title="Call Timeline">
          <ol className="p-5 space-y-4">
            {selectedCall.timeline.map((note, idx) => (
              <li key={idx} className="grid grid-cols-[20px_1fr] gap-3">
                <span className="mt-1 flex h-4 w-4 items-center justify-center rounded-full" style={{ background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.3)' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
                </span>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{note}</p>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </div>
  );
}

function ScheduleTab() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Jobs This Week', value: '4', sub: '1 completed', color: '#6366F1' },
          { label: 'Total Job Value', value: '$86,450', sub: 'Active pipeline', color: '#10B981' },
          { label: 'Pending Estimates', value: '2', sub: 'Need scheduling', color: '#F59E0B' }
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
            <p className="mt-2 text-3xl font-bold" style={{ color: s.color, letterSpacing: '-0.04em' }}>{s.value}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <SectionCard title="Job Board" subtitle="All active and upcoming jobs">
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
                {['Customer', 'Address', 'Type', 'Assigned Crew', 'Date', 'Value', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {JOBS.map((job, i) => (
                <tr
                  key={job.id}
                  style={{ borderBottom: i < JOBS.length - 1 ? '1px solid var(--border)' : 'none' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>{job.customer}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{job.address}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{job.type}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{job.assignedCrew}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>{job.scheduledDate}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>{job.estimateValue}</td>
                  <td className="px-4 py-3"><Pill style={jobStatusStyle(job.status)}>{job.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Notes */}
        <div className="divide-y px-5 pb-5" style={{ borderTop: '1px solid var(--border)', marginTop: '1rem' }}>
          <p className="pt-3 pb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Job Notes</p>
          {JOBS.map((job) => (
            <div key={job.id + '-note'} className="py-3">
              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{job.customer}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{job.notes}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function CrewTab() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Total Crew', value: String(CREW.length), sub: 'Active roster' },
          { label: 'On Job Now', value: String(CREW.filter(c => c.status === 'On Job').length), sub: 'Field deployed' },
          { label: 'Available', value: String(CREW.filter(c => c.status === 'Active').length), sub: 'Ready to assign' }
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
            <p className="mt-2 text-3xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.04em' }}>{s.value}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CREW.map((member) => (
          <div
            key={member.id}
            className="rounded-xl p-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
                style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
              >
                {member.name.split(' ').map(n => n[0]).join('')}
              </div>
              <Pill style={crewStatusStyle(member.status)}>{member.status}</Pill>
            </div>
            <div className="mt-3">
              <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{member.name}</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{member.role}</p>
              <p className="mt-1 text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>{member.phone}</p>
            </div>
            {member.activeJob && (
              <div className="mt-3 rounded-lg px-3 py-2" style={{ background: 'var(--accent-dim)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--accent)' }}>📍 {member.activeJob}</p>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {member.certifications.map((cert) => (
                <span key={cert} className="rounded-full px-2 py-0.5 text-xs" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-tertiary)' }}>
                  {cert}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InsuranceTab() {
  const approved = CLAIMS.filter(c => c.status === 'Approved').length;
  const pending = CLAIMS.filter(c => c.status !== 'Approved' && c.status !== 'Denied').length;
  const totalApproved = CLAIMS.filter(c => c.status === 'Approved').reduce((s, c) => s + parseFloat(c.estimatedValue.replace(/[$,]/g, '')), 0);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Approved Claims', value: String(approved), sub: `$${totalApproved.toLocaleString()} recovered`, color: '#065F46' },
          { label: 'Pending Review', value: String(pending), sub: 'Awaiting adjuster', color: '#92400E' },
          { label: 'Total Claims', value: String(CLAIMS.length), sub: 'All time demo', color: 'var(--text-primary)' }
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.label}</p>
            <p className="mt-2 text-3xl font-bold" style={{ color: s.color, letterSpacing: '-0.04em' }}>{s.value}</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.sub}</p>
          </div>
        ))}
      </div>

      <SectionCard title="Insurance Claims Tracker" subtitle="All active and closed claims">
        <div className="overflow-x-auto">
          <table className="min-w-full table-auto text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', borderTop: '1px solid var(--border)' }}>
                {['Customer', 'Insurer', 'Claim #', 'Adjuster', 'Filed', 'Est. Value', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CLAIMS.map((claim, i) => (
                <tr
                  key={claim.id}
                  style={{ borderBottom: i < CLAIMS.length - 1 ? '1px solid var(--border)' : 'none' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>{claim.customer}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{claim.insurer}</td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>{claim.claimNumber}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{claim.adjusterName}</td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>{claim.dateFiled}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>{claim.estimatedValue}</td>
                  <td className="px-4 py-3"><Pill style={claimStatusStyle(claim.status)}>{claim.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="divide-y px-5 pb-5" style={{ borderTop: '1px solid var(--border)', marginTop: '1rem' }}>
          <p className="pt-3 pb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Claim Notes</p>
          {CLAIMS.map((claim) => (
            <div key={claim.id + '-note'} className="py-3">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{claim.customer}</p>
                <Pill style={claimStatusStyle(claim.status)}>{claim.status}</Pill>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{claim.notes}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RidgelineRoofingDemoDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [calls, setCalls] = useState(INITIAL_CALLS);
  const [followUps, setFollowUps] = useState(INITIAL_FOLLOW_UPS);

  function updateFollowUp(id: string, status: FollowUpStatus) {
    setFollowUps(prev => prev.map(f => f.id === id ? { ...f, status } : f));
  }

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview',  label: 'Overview',  icon: '◼' },
    { id: 'calls',     label: 'AI Calls',  icon: '◎' },
    { id: 'schedule',  label: 'Schedule',  icon: '▦' },
    { id: 'crew',      label: 'Crew',      icon: '◉' },
    { id: 'insurance', label: 'Insurance', icon: '◈' }
  ];

  return (
    <main
      className="skybridge-app min-h-screen"
      style={{ background: 'var(--bg)' }}
    >
      <div className="mx-auto max-w-[1700px] px-4 pb-12 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <header
          className="glass sticky top-0 z-10 mb-6 flex items-center justify-between gap-4 rounded-b-2xl px-5 py-4"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl text-xs font-extrabold tracking-wide text-white"
                style={{ background: 'linear-gradient(135deg, var(--accent) 0%, #8B5CF6 100%)' }}
              >
                SX
              </span>
              <span className="hidden font-bold sm:block" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>SkyBridgeCX</span>
            </Link>
            <span className="h-4 w-px" style={{ background: 'var(--border)' }} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>Ridgeline Roofing</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Demo Dashboard · Sample Data</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
              style={{ background: '#D1FAE5', color: '#065F46' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              AI Active
            </span>
            <Link
              href="/sign-up"
              className="hidden rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity sm:block"
              style={{ background: 'var(--accent)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              Get Started
            </Link>
          </div>
        </header>

        {/* ── Hero ── */}
        <div className="anim-fade-in-up mb-8 text-center">
          <div
            className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl text-2xl"
            style={{ background: 'linear-gradient(135deg, #FEF3C7 0%, #FEE2E2 100%)', boxShadow: 'var(--shadow-sm)' }}
          >
            🏠
          </div>
          <h1
            className="text-4xl font-extrabold sm:text-5xl gradient-text"
            style={{ letterSpacing: '-0.04em' }}
          >
            Ridgeline Roofing
          </h1>
          <p className="mt-3 text-lg" style={{ color: 'var(--text-secondary)' }}>
            AI-powered operations dashboard — calls, jobs, crew & insurance in one place.
          </p>
        </div>

        {/* ── Tab Nav ── */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl p-1.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all"
              style={activeTab === tab.id
                ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }
                : { color: 'var(--text-secondary)' }
              }
              onMouseEnter={(e) => { if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
              onMouseLeave={(e) => { if (activeTab !== tab.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span className="text-xs">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        <div className="anim-fade-in">
          {activeTab === 'overview'  && <OverviewTab calls={calls} followUps={followUps} onUpdateFollowUp={updateFollowUp} />}
          {activeTab === 'calls'     && <CallsTab calls={calls} setCalls={setCalls} />}
          {activeTab === 'schedule'  && <ScheduleTab />}
          {activeTab === 'crew'      && <CrewTab />}
          {activeTab === 'insurance' && <InsuranceTab />}
        </div>

        {/* ── CTA ── */}
        <div
          className="mt-10 rounded-2xl p-8 text-center"
          style={{
            background: 'linear-gradient(135deg, var(--accent-dim) 0%, rgba(139,92,246,0.08) 100%)',
            border: '1px solid rgba(99,102,241,0.2)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Want this for your roofing business?
          </h2>
          <p className="mt-2 text-base" style={{ color: 'var(--text-secondary)' }}>
            SkyBridgeCX captures every missed call, qualifies leads, and sends instant text-backs — 24/7.
          </p>
          <Link
            href="/sign-up"
            className="mt-6 inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-sm font-bold text-white transition-all"
            style={{ background: 'var(--accent)', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 32px rgba(99,102,241,0.5)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 24px rgba(99,102,241,0.4)'; }}
          >
            Book a Setup Call
            <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4" aria-hidden="true">
              <path d="m6 3 5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <p className="mt-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
            This dashboard uses sample data for demonstration purposes only.
          </p>
        </div>

      </div>
    </main>
  );
}
