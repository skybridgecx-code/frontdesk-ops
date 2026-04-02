import { CallReviewStatus, CallRouteKind, CallStatus, CallTriageStatus } from './index';

export const demoCallFixtures = [
  {
    twilioCallSid: 'CA_DEMO_101',
    twilioStreamSid: 'MZ_DEMO_STREAM_101',
    fromE164: '+15713240674',
    status: CallStatus.COMPLETED,
    routeKind: CallRouteKind.AI,
    triageStatus: CallTriageStatus.OPEN,
    reviewStatus: CallReviewStatus.UNREVIEWED,
    startedAt: new Date('2026-03-24T09:10:00.000Z'),
    answeredAt: new Date('2026-03-24T09:10:08.000Z'),
    endedAt: new Date('2026-03-24T09:11:42.000Z'),
    durationSeconds: 94,
    callerTranscript:
      'Hi, this is John Smith. My AC stopped working overnight at 123 Main Street in Reston. It is getting hot in the house and I need someone out today. Call me back at 571-324-0674.',
    assistantTranscript:
      'Thanks, John. I have your AC outage at 123 Main Street in Reston and your callback number as 571-324-0674. I will mark this as a high-priority service request for today.',
    leadName: 'John Smith',
    leadPhone: '571-324-0674',
    leadIntent: 'AC stopped working and needs same-day service',
    urgency: 'high',
    serviceAddress: '123 Main Street, Reston, VA',
    summary:
      'John Smith reported a same-day AC outage at 123 Main Street in Reston and asked for a callback at 571-324-0674.'
  },
  {
    twilioCallSid: 'CA_DEMO_102',
    twilioStreamSid: 'MZ_DEMO_STREAM_102',
    fromE164: '+15713240675',
    status: CallStatus.COMPLETED,
    routeKind: CallRouteKind.AI,
    triageStatus: CallTriageStatus.OPEN,
    reviewStatus: CallReviewStatus.UNREVIEWED,
    startedAt: new Date('2026-03-24T08:35:00.000Z'),
    answeredAt: new Date('2026-03-24T08:35:06.000Z'),
    endedAt: new Date('2026-03-24T08:36:20.000Z'),
    durationSeconds: 74,
    callerTranscript:
      'Hello, this is Maria Lopez. I want to schedule a spring tune-up for our HVAC system at 450 Pine Avenue in Herndon sometime next week. You can reach me at 571-555-0182.',
    assistantTranscript:
      'Got it. You would like to schedule a spring HVAC tune-up at 450 Pine Avenue in Herndon next week, and your callback number is 571-555-0182.',
    leadName: 'Maria Lopez',
    leadPhone: '571-555-0182',
    leadIntent: 'Schedule spring HVAC tune-up',
    urgency: 'medium',
    serviceAddress: '450 Pine Avenue, Herndon, VA',
    summary:
      'Maria Lopez called to schedule a spring HVAC tune-up at 450 Pine Avenue in Herndon for next week.'
  },
  {
    twilioCallSid: 'CA_DEMO_103',
    twilioStreamSid: 'MZ_DEMO_STREAM_103',
    fromE164: '+15713240676',
    status: CallStatus.COMPLETED,
    routeKind: CallRouteKind.AI,
    triageStatus: CallTriageStatus.OPEN,
    reviewStatus: CallReviewStatus.NEEDS_REVIEW,
    startedAt: new Date('2026-03-24T07:55:00.000Z'),
    answeredAt: new Date('2026-03-24T07:55:04.000Z'),
    endedAt: new Date('2026-03-24T07:56:01.000Z'),
    durationSeconds: 57,
    callerTranscript:
      'My basement is flooding from a broken pipe at 88 Oak Lane in Sterling. Please call me back right away at 703-555-0199.',
    assistantTranscript:
      'I understand this is an active flooding issue from a broken pipe at 88 Oak Lane in Sterling. I am marking this as an emergency callback request at 703-555-0199.',
    leadName: null,
    leadPhone: '703-555-0199',
    leadIntent: 'Broken pipe with basement flooding',
    urgency: 'emergency',
    serviceAddress: '88 Oak Lane, Sterling, VA',
    summary:
      'Emergency plumbing lead reporting basement flooding from a broken pipe at 88 Oak Lane in Sterling. Callback number 703-555-0199.'
  },
  {
    twilioCallSid: 'CA_DEMO_104',
    twilioStreamSid: 'MZ_DEMO_STREAM_104',
    fromE164: '+15713240677',
    status: CallStatus.COMPLETED,
    routeKind: CallRouteKind.AI,
    triageStatus: CallTriageStatus.CONTACTED,
    reviewStatus: CallReviewStatus.REVIEWED,
    contactedAt: new Date('2026-03-24T13:45:00.000Z'),
    reviewedAt: new Date('2026-03-24T13:30:00.000Z'),
    startedAt: new Date('2026-03-24T06:40:00.000Z'),
    answeredAt: new Date('2026-03-24T06:40:05.000Z'),
    endedAt: new Date('2026-03-24T06:41:18.000Z'),
    durationSeconds: 73,
    callerTranscript:
      'Hey, this is Kevin Brown from 22 Maple Court in Reston. We just need a quote to replace our water heater sometime this month. My number is 703-555-0104.',
    assistantTranscript:
      'Thanks, Kevin. You are looking for a water heater replacement quote for 22 Maple Court in Reston, and your callback number is 703-555-0104.',
    leadName: 'Kevin Brown',
    leadPhone: '703-555-0104',
    leadIntent: 'Request quote for water heater replacement',
    urgency: 'low',
    serviceAddress: '22 Maple Court, Reston, VA',
    summary:
      'Kevin Brown requested a water heater replacement quote for 22 Maple Court in Reston and left callback number 703-555-0104.'
  },
  {
    twilioCallSid: 'CA_DEMO_105',
    twilioStreamSid: 'MZ_DEMO_STREAM_105',
    fromE164: '+15713240678',
    status: CallStatus.COMPLETED,
    routeKind: CallRouteKind.AI,
    triageStatus: CallTriageStatus.OPEN,
    reviewStatus: CallReviewStatus.UNREVIEWED,
    startedAt: new Date('2026-03-24T05:20:00.000Z'),
    answeredAt: new Date('2026-03-24T05:20:07.000Z'),
    endedAt: new Date('2026-03-24T05:20:31.000Z'),
    durationSeconds: 24,
    callerTranscript: 'Uh hi, I think I called the wrong place. Sorry about that.',
    assistantTranscript: 'No problem. If you need HVAC or plumbing help later, feel free to call back.',
    leadName: null,
    leadPhone: null,
    leadIntent: null,
    urgency: null,
    serviceAddress: null,
    summary: 'Caller appears to have reached the wrong business and ended the call quickly.'
  },
  {
    twilioCallSid: 'CA_DEMO_106',
    twilioStreamSid: 'MZ_DEMO_STREAM_106',
    fromE164: '+15713240679',
    status: CallStatus.COMPLETED,
    routeKind: CallRouteKind.AI,
    triageStatus: CallTriageStatus.OPEN,
    reviewStatus: CallReviewStatus.UNREVIEWED,
    startedAt: new Date('2026-03-24T04:05:00.000Z'),
    answeredAt: new Date('2026-03-24T04:05:06.000Z'),
    endedAt: new Date('2026-03-24T04:05:28.000Z'),
    durationSeconds: 22,
    callerTranscript: 'Need service in Reston. Call me back.',
    assistantTranscript: 'I can help with that. What issue are you having and what is the best callback number?',
    leadName: null,
    leadPhone: null,
    leadIntent: 'Needs service callback',
    urgency: null,
    serviceAddress: 'Reston',
    summary: null
  }
] as const;
