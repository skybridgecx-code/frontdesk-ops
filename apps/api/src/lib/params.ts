import { z } from 'zod';

export const businessIdParams = z.object({
  businessId: z.string().min(1)
});

export const callSidParams = z.object({
  callSid: z.string().min(1)
});

export const prospectParams = z.object({
  businessId: z.string().min(1),
  prospectSid: z.string().min(1)
});

export const slugParams = z.object({
  slug: z.string().min(1)
});

export const phoneNumberIdParams = z.object({
  phoneNumberId: z.string().min(1)
});

export const agentProfileIdParams = z.object({
  agentProfileId: z.string().min(1)
});

export const serviceAreaIdParams = z.object({
  serviceAreaId: z.string().min(1)
});