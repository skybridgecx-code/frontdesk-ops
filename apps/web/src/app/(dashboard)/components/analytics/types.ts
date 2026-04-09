export type AnalyticsPeriod = '7d' | '30d' | '90d';

export type TrendValue = {
  previous: number;
  changePct: number;
};

export type OverviewData = {
  period: string;
  startDate: string;
  endDate: string;
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  answerRate: number;
  avgDurationSeconds: number;
  totalLeadsExtracted: number;
  leadConversionRate: number;
  textBacksSent: number;
  textBackRate: number;
  comparedToPrevious: {
    totalCalls: TrendValue;
    answeredCalls: TrendValue;
    missedCalls: TrendValue;
    answerRate: TrendValue;
    avgDurationSeconds: TrendValue;
    totalLeadsExtracted: TrendValue;
    leadConversionRate: TrendValue;
    textBacksSent: TrendValue;
    textBackRate: TrendValue;
  };
};

export type CallVolumePoint = {
  date: string;
  total: number;
  answered: number;
  missed: number;
};

export type CallVolumeData = {
  period: string;
  startDate: string;
  endDate: string;
  granularity: 'day' | 'week';
  data: CallVolumePoint[];
};

export type IntentPoint = {
  intent: string;
  count: number;
  percentage: number;
};

export type IntentData = {
  period: string;
  startDate: string;
  endDate: string;
  data: IntentPoint[];
};

export type UrgencyPoint = {
  urgency: string;
  count: number;
  percentage: number;
};

export type UrgencyData = {
  period: string;
  startDate: string;
  endDate: string;
  data: UrgencyPoint[];
};

export type PeakHourPoint = {
  hour: number;
  count: number;
};

export type PeakHoursData = {
  period: string;
  startDate: string;
  endDate: string;
  data: PeakHourPoint[];
};

export type RecentActivityRow = {
  callSid: string;
  fromE164: string | null;
  status: string;
  durationSeconds: number | null;
  extractedName: string | null;
  extractedIntent: string | null;
  extractedUrgency: string | null;
  textBackSent: boolean;
  createdAt: string;
};

export type RecentActivityData = {
  period: string;
  startDate: string;
  endDate: string;
  data: RecentActivityRow[];
};

export type WebhookHealthData = {
  period: string;
  startDate: string;
  endDate: string;
  available: boolean;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  successRate: number;
};
