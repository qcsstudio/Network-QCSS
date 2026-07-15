import { z } from "zod";

export const consentSchema = z.object({
  necessary: z.boolean().default(true),
  analytics: z.boolean().default(false),
  marketing: z.boolean().default(false),
  personalization: z.boolean().default(false),
  contact: z.boolean().optional()
});

export const attributionSchema = z
  .object({
    source: z.string().max(200).optional(),
    medium: z.string().max(120).optional(),
    campaign: z.string().max(200).optional(),
    content: z.string().max(200).optional(),
    term: z.string().max(200).optional(),
    landing: z.string().max(500).optional(),
    referrer: z.string().max(500).optional()
  })
  .default({});

export const leadSchema = z.object({
  name: z.string().trim().min(2).max(180),
  email: z.string().trim().email().max(240),
  phone: z.string().trim().min(6).max(80),
  interest: z.string().trim().min(2).max(180),
  challenge: z.string().trim().max(2000).optional().default(""),
  pipeline: z.string().trim().max(180).optional(),
  score: z.number().int().min(0).max(100).optional().default(0),
  sessionId: z.string().trim().max(200).optional().default(""),
  attribution: attributionSchema,
  consent: consentSchema.refine((value) => value.contact === true, "Contact consent is required."),
  sourceProfile: z.record(z.string(), z.unknown()).optional().default({})
});

export const eventSchema = z.object({
  name: z.string().trim().min(2).max(120),
  sessionId: z.string().trim().max(200).optional().default(""),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  consent: consentSchema,
  requiresAnalytics: z.boolean().optional().default(true)
});

export const assessmentSchema = z.object({
  tool: z.string().trim().min(2).max(100),
  title: z.string().trim().min(2).max(180).optional(),
  pipeline: z.string().trim().min(2).max(180).optional(),
  recommendation: z.string().trim().min(2).max(300).optional(),
  riskLevel: z.string().trim().min(2).max(100).optional(),
  score: z.number().int().min(0).max(100).optional(),
  answers: z.record(z.string(), z.unknown()).optional().default({}),
  sessionId: z.string().trim().max(200).optional().default(""),
  attribution: attributionSchema,
  consent: consentSchema.optional().default({
    necessary: true,
    analytics: false,
    marketing: false,
    personalization: false
  })
});

export const resourceSchema = z.object({
  resource: z.string().trim().min(2).max(180),
  sessionId: z.string().trim().max(200).optional().default(""),
  attribution: attributionSchema,
  consent: consentSchema.optional().default({
    necessary: true,
    analytics: false,
    marketing: false,
    personalization: false
  })
});
