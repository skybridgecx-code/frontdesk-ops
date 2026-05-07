export const acquisitionStages = [
  'Researching',
  'Contacted',
  'Follow-up needed',
  'Demo booked',
  'Pilot proposed',
  'Won',
  'Not now'
] as const;

export type AcquisitionStage = (typeof acquisitionStages)[number];

export type AcquisitionTarget = {
  id?: string;
  businessName: string;
  vertical: string;
  services?: string | null;
  location: string;
  website: string;
  phone?: string | null;
  email?: string | null;
  yearsInBusiness?: string | null;
  painPoint: string;
  outreachStatus: string;
  lastContacted: string | null;
  nextFollowUp: string | null;
  demoStatus: string;
  offerStage: string;
  stage: AcquisitionStage;
  notes: string;
  source: string;
};

export const pitchAngles = [
  'Missed calls during peak job hours',
  'Slow follow-up after first contact',
  'No call tracking visibility',
  'No reliable lead capture workflow',
  'No after-hours coverage process'
] as const;

export const acquisitionTargets: AcquisitionTarget[] = [
  {
    businessName: 'Summit Peak Roofing Demo Co.',
    vertical: 'Roofing',
    location: 'Maple Ridge, VA',
    website: 'summitpeak-demo.example',
    painPoint: 'Missed calls on storm-heavy days',
    outreachStatus: 'Intro SMS sent',
    lastContacted: '2026-05-06',
    nextFollowUp: '2026-05-07',
    demoStatus: 'Not booked',
    offerStage: 'Not discussed',
    stage: 'Follow-up needed',
    notes: 'Owner asked for callback after morning crew dispatch.',
    source: 'Sample acquisition data'
  },
  {
    businessName: 'Northflow HVAC Demo Services',
    vertical: 'HVAC',
    location: 'Oak Terrace, VA',
    website: 'northflow-hvac-demo.example',
    painPoint: 'No after-hours intake process',
    outreachStatus: 'Connected with office manager',
    lastContacted: '2026-05-05',
    nextFollowUp: '2026-05-08',
    demoStatus: 'Booked for Friday',
    offerStage: 'Pilot overview pending',
    stage: 'Demo booked',
    notes: 'Wants call summary view and callback workflow.',
    source: 'Sample acquisition data'
  },
  {
    businessName: 'Copperline Plumbing Demo Group',
    vertical: 'Plumbing',
    location: 'Fairview, MD',
    website: 'copperline-demo.example',
    painPoint: 'Leads get lost between call and dispatch',
    outreachStatus: 'No response yet',
    lastContacted: '2026-05-03',
    nextFollowUp: '2026-05-07',
    demoStatus: 'Not booked',
    offerStage: 'Not discussed',
    stage: 'Contacted',
    notes: 'Try alternate pitch angle: lead capture consistency.',
    source: 'Sample acquisition data'
  },
  {
    businessName: 'Greenline Landscape Demo Team',
    vertical: 'Landscaping',
    location: 'Willow Creek, PA',
    website: 'greenline-landscape-demo.example',
    painPoint: 'Slow quote follow-up from inbound calls',
    outreachStatus: 'Research completed',
    lastContacted: null,
    nextFollowUp: '2026-05-07',
    demoStatus: 'Not booked',
    offerStage: 'Not discussed',
    stage: 'Researching',
    notes: 'Build before/after story using missed-call recovery.',
    source: 'Sample acquisition data'
  },
  {
    businessName: 'ClearNest Cleaning Demo Services',
    vertical: 'Cleaning',
    location: 'Harbor Point, NJ',
    website: 'clearnest-demo.example',
    painPoint: 'No centralized call notes',
    outreachStatus: 'Demo completed',
    lastContacted: '2026-05-04',
    nextFollowUp: '2026-05-09',
    demoStatus: 'Completed',
    offerStage: 'Pilot proposed',
    stage: 'Pilot proposed',
    notes: 'Requested draft pilot terms and onboarding timeline.',
    source: 'Sample acquisition data'
  },
  {
    businessName: 'SureGuard Pest Demo Control',
    vertical: 'Pest Control',
    location: 'Lakeview, NC',
    website: 'sureguard-pest-demo.example',
    painPoint: 'Weekend calls not captured well',
    outreachStatus: 'Pilot accepted',
    lastContacted: '2026-05-02',
    nextFollowUp: '2026-05-10',
    demoStatus: 'Completed',
    offerStage: 'Pilot accepted',
    stage: 'Won',
    notes: 'Demo account setup queued for kickoff.',
    source: 'Sample acquisition data'
  },
  {
    businessName: 'RapidRestore Demo Response',
    vertical: 'Restoration',
    location: 'Pine Summit, OH',
    website: 'rapidrestore-demo.example',
    painPoint: 'After-hours emergencies routed inconsistently',
    outreachStatus: 'Paused by prospect',
    lastContacted: '2026-04-29',
    nextFollowUp: '2026-05-20',
    demoStatus: 'Deferred',
    offerStage: 'Revisit next quarter',
    stage: 'Not now',
    notes: 'Circle back after internal staffing changes.',
    source: 'Sample acquisition data'
  },
  {
    businessName: 'GateLift Garage Demo Doors',
    vertical: 'Garage Door',
    location: 'Cedar Hollow, TN',
    website: 'gatelift-demo.example',
    painPoint: 'No lead qualification step for inbound calls',
    outreachStatus: 'Second follow-up queued',
    lastContacted: '2026-05-01',
    nextFollowUp: '2026-05-07',
    demoStatus: 'Not booked',
    offerStage: 'Not discussed',
    stage: 'Follow-up needed',
    notes: 'Use quick ROI framing around urgent repair calls.',
    source: 'Sample acquisition data'
  },
  {
    businessName: 'BrightCurrent Electric Demo',
    vertical: 'Electrical',
    location: 'Stone Harbor, GA',
    website: 'brightcurrent-demo.example',
    painPoint: 'No call tracking for owner visibility',
    outreachStatus: 'Intro email sent',
    lastContacted: '2026-05-06',
    nextFollowUp: '2026-05-08',
    demoStatus: 'Not booked',
    offerStage: 'Not discussed',
    stage: 'Contacted',
    notes: 'Mention dashboard command center in next touchpoint.',
    source: 'Sample acquisition data'
  },
  {
    businessName: 'PrimeShield Home Services Demo',
    vertical: 'General Home Services',
    location: 'Riverbend, FL',
    website: 'primeshield-demo.example',
    painPoint: 'Overflow calls handled manually after hours',
    outreachStatus: 'Demo booked',
    lastContacted: '2026-05-06',
    nextFollowUp: '2026-05-09',
    demoStatus: 'Booked for Monday',
    offerStage: 'Pilot structure prepped',
    stage: 'Demo booked',
    notes: 'Prepare pilot pricing draft for Monday review.',
    source: 'Sample acquisition data'
  }
];

type AcquisitionStats = {
  researched: number;
  contacted: number;
  demosBooked: number;
  followUpsDue: number;
};

function toDayKey(value: Date) {
  const y = value.getUTCFullYear();
  const m = String(value.getUTCMonth() + 1).padStart(2, '0');
  const d = String(value.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isDue(nextFollowUp: string | null, todayKey: string) {
  return Boolean(nextFollowUp && nextFollowUp <= todayKey);
}

export function getAcquisitionStats(
  targets: AcquisitionTarget[],
  referenceDate: Date = new Date()
): AcquisitionStats {
  const todayKey = toDayKey(referenceDate);
  const researched = targets.length;
  const contacted = targets.filter((target) => target.stage !== 'Researching').length;
  const demosBooked = targets.filter((target) => target.stage === 'Demo booked').length;
  const followUpsDue = targets.filter(
    (target) => target.stage !== 'Won' && target.stage !== 'Not now' && isDue(target.nextFollowUp, todayKey)
  ).length;

  return { researched, contacted, demosBooked, followUpsDue };
}

export function getTodayActions(targets: AcquisitionTarget[], referenceDate: Date = new Date()) {
  const todayKey = toDayKey(referenceDate);

  const due = targets
    .filter((target) => target.stage !== 'Won' && target.stage !== 'Not now' && isDue(target.nextFollowUp, todayKey))
    .slice(0, 5)
    .map((target) => ({
      label: `Follow up ${target.businessName}`,
      detail: `${target.vertical} · ${target.location} · ${target.painPoint}`
    }));

  if (due.length >= 3) {
    return due;
  }

  const filler = [
    { label: 'Review demo narrative', detail: 'Align pitch angle to missed calls and follow-up speed.' },
    { label: 'Prep pilot offer draft', detail: 'Have setup fee + monthly pilot options ready before demos.' },
    { label: 'Check command center flow', detail: 'Verify /demo, /dashboard, /calls, /prospects before outreach.' }
  ];

  return [...due, ...filler].slice(0, 5);
}
