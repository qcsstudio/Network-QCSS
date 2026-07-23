import { z } from "zod";
import { sha256 } from "./verifygrid-automation-domain.ts";

export const verifyGridOnboardingServices = [
  "external_network_vapt",
  "internal_network_vapt",
  "web_and_api_vapt",
  "cloud_network_assurance",
  "firewall_assurance",
  "wireless_assessment",
  "configuration_assurance",
  "continuous_validation"
] as const;

const optionalDate = z.preprocess(
  (value) => value === "" || value === null || value === undefined ? undefined : value,
  z.coerce.date().optional()
);

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

export const verifyGridOnboardingRequestSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(6).max(40),
  organizationName: z.string().trim().min(2).max(160),
  legalName: optionalText(200),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/).optional().or(z.literal("")),
  timezone: z.string().trim().min(3).max(80).default("UTC"),
  serviceType: z.enum(verifyGridOnboardingServices),
  scopeSummary: z.string().trim().min(40).max(2000),
  requestedStartAt: optionalDate,
  emergencyContactName: z.string().trim().min(2).max(120),
  emergencyContactEmail: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  contactConsent: z.literal(true, { message: "Contact consent is required." }),
  authorityAcknowledgement: z.literal(true, { message: "Confirm that onboarding does not authorize security testing." }),
  website: optionalText(200)
});

export const verifyGridOnboardingReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewNote: z.string().trim().max(1000).optional().default("")
}).superRefine((value, context) => {
  if (value.action === "reject" && value.reviewNote.length < 10) {
    context.addIssue({ code: "custom", path: ["reviewNote"], message: "A rejection reason of at least 10 characters is required." });
  }
});

export const verifyGridPortalLinkRequestSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase())
});

export function parseVerifyGridOnboardingToken(value: string) {
  const match = /^vg_onboard_([a-zA-Z0-9_-]{8,80})\.([a-zA-Z0-9_-]{32,})$/.exec(value.trim());
  return match ? { id: match[1], secret: match[2], tokenHash: sha256(match[2]) } : null;
}
