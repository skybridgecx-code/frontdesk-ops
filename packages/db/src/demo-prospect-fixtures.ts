import {
  ProspectAttemptChannel,
  ProspectAttemptOutcome,
  ProspectPriority,
  ProspectStatus
} from './index';

export const demoProspectFixtures = [
  {
    prospectSid: 'PR_DEMO_101',
    companyName: 'Reston Family Dental',
    contactName: 'Alicia Grant',
    contactPhone: '703-555-1101',
    contactEmail: 'alicia@restonfamilydental.example',
    city: 'Reston',
    state: 'VA',
    sourceLabel: 'manual_list',
    serviceInterest: 'After-hours HVAC answering coverage for a multi-location dental office',
    notes: 'Strong fit. Multiple locations and recurring after-hours call volume.',
    status: ProspectStatus.READY,
    priority: ProspectPriority.HIGH,
    nextActionAt: new Date('2026-03-26T13:00:00.000Z'),
    lastAttemptAt: null,
    respondedAt: null,
    archivedAt: null,
    attempts: []
  },
  {
    prospectSid: 'PR_DEMO_102',
    companyName: 'Sterling Property Group',
    contactName: 'Marcus Reed',
    contactPhone: '703-555-1102',
    contactEmail: 'mreed@sterlingproperty.example',
    city: 'Sterling',
    state: 'VA',
    sourceLabel: 'manual_list',
    serviceInterest: 'Overflow voice coverage for maintenance request calls',
    notes: 'Good fit, medium priority. Property-management use case.',
    status: ProspectStatus.READY,
    priority: ProspectPriority.MEDIUM,
    nextActionAt: new Date('2026-03-26T14:00:00.000Z'),
    lastAttemptAt: null,
    respondedAt: null,
    archivedAt: null,
    attempts: []
  },
  {
    prospectSid: 'PR_DEMO_103',
    companyName: 'Herndon Animal Clinic',
    contactName: 'Dana Cole',
    contactPhone: '703-555-1103',
    contactEmail: 'dana@herndonanimalclinic.example',
    city: 'Herndon',
    state: 'VA',
    sourceLabel: 'referral',
    serviceInterest: 'Front-desk overflow and after-hours intake',
    notes: 'One voicemail left already. Still in active follow-up window.',
    status: ProspectStatus.ATTEMPTED,
    priority: ProspectPriority.HIGH,
    nextActionAt: new Date('2026-03-26T12:30:00.000Z'),
    lastAttemptAt: new Date('2026-03-25T16:10:00.000Z'),
    respondedAt: null,
    archivedAt: null,
    attempts: [
      {
        channel: ProspectAttemptChannel.CALL,
        outcome: ProspectAttemptOutcome.LEFT_VOICEMAIL,
        note: 'Reached voicemail. Left short intro and callback request.',
        attemptedAt: new Date('2026-03-25T16:10:00.000Z')
      }
    ]
  },
  {
    prospectSid: 'PR_DEMO_104',
    companyName: 'Nova Pediatrics',
    contactName: 'Priya Shah',
    contactPhone: '703-555-1104',
    contactEmail: 'pshah@novapediatrics.example',
    city: 'Vienna',
    state: 'VA',
    sourceLabel: 'website_inquiry',
    serviceInterest: 'Appointment-line overflow and after-hours routing',
    notes: 'They replied asking for pricing and next steps.',
    status: ProspectStatus.RESPONDED,
    priority: ProspectPriority.MEDIUM,
    nextActionAt: new Date('2026-03-26T15:00:00.000Z'),
    lastAttemptAt: new Date('2026-03-25T11:00:00.000Z'),
    respondedAt: new Date('2026-03-25T14:15:00.000Z'),
    archivedAt: null,
    attempts: [
      {
        channel: ProspectAttemptChannel.EMAIL,
        outcome: ProspectAttemptOutcome.SENT_EMAIL,
        note: 'Sent intro email with short product summary.',
        attemptedAt: new Date('2026-03-25T11:00:00.000Z')
      },
      {
        channel: ProspectAttemptChannel.EMAIL,
        outcome: ProspectAttemptOutcome.REPLIED,
        note: 'Prospect replied asking for pricing.',
        attemptedAt: new Date('2026-03-25T14:15:00.000Z')
      }
    ]
  },
  {
    prospectSid: 'PR_DEMO_105',
    companyName: 'Old Town Roofing',
    contactName: null,
    contactPhone: null,
    contactEmail: 'office@oldtownroofing.example',
    city: 'Alexandria',
    state: 'VA',
    sourceLabel: 'list_import',
    serviceInterest: 'Unknown',
    notes: 'Intentionally thin prospect record for low-signal validation.',
    status: ProspectStatus.NEW,
    priority: ProspectPriority.LOW,
    nextActionAt: null,
    lastAttemptAt: null,
    respondedAt: null,
    archivedAt: null,
    attempts: []
  },
  {
    prospectSid: 'PR_DEMO_106',
    companyName: 'Dormant HVAC Leads',
    contactName: 'Archive Example',
    contactPhone: '703-555-1106',
    contactEmail: 'archive@dormant.example',
    city: 'Reston',
    state: 'VA',
    sourceLabel: 'old_campaign',
    serviceInterest: 'Legacy campaign record',
    notes: 'Archived example row for selector exclusion.',
    status: ProspectStatus.ARCHIVED,
    priority: ProspectPriority.LOW,
    nextActionAt: null,
    lastAttemptAt: new Date('2026-03-20T15:00:00.000Z'),
    respondedAt: null,
    archivedAt: new Date('2026-03-21T12:00:00.000Z'),
    attempts: [
      {
        channel: ProspectAttemptChannel.EMAIL,
        outcome: ProspectAttemptOutcome.BAD_FIT,
        note: 'Not a target vertical for the current outreach motion.',
        attemptedAt: new Date('2026-03-20T15:00:00.000Z')
      }
    ]
  }
] as const;
