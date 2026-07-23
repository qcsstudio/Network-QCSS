import crypto from "node:crypto";
import { getPrismaClient } from "@/lib/prisma";
import { createVerifyGridEngagement } from "@/lib/verifygrid";
import { randomSecret, safeEqual, sha256 } from "@/lib/verifygrid-automation-domain";
import {
  parseVerifyGridOnboardingToken,
  verifyGridOnboardingRequestSchema,
  verifyGridOnboardingReviewSchema
} from "@/lib/verifygrid-onboarding-domain";
import { inviteVerifyGridMember } from "@/lib/verifygrid-portal-auth";
import { sendVerifyGridAccessEmail } from "@/lib/verifygrid-email";
import { siteConfig } from "@/lib/content";

const serviceLabels: Record<string, string> = {
  external_network_vapt: "External network VAPT",
  internal_network_vapt: "Internal network VAPT",
  web_and_api_vapt: "Web and API VAPT",
  cloud_network_assurance: "Cloud network assurance",
  firewall_assurance: "Firewall assurance",
  wireless_assessment: "Wireless assessment",
  configuration_assurance: "Configuration assurance",
  continuous_validation: "Continuous validation"
};

function mapRequest(request: {
  id: string;
  email: string;
  displayName: string;
  organizationName: string;
  legalName: string | null;
  phone: string;
  countryCode: string | null;
  timezone: string;
  serviceType: string;
  scopeSummary: string;
  requestedStartAt: Date | null;
  emergencyContactName: string;
  emergencyContactEmail: string;
  status: string;
  emailVerifiedAt: Date | null;
  workspaceId: string | null;
  engagementId: string | null;
  membershipId: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  sourceCountry: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: request.id,
    reference: `VGO-${request.id.slice(-8).toUpperCase()}`,
    email: request.email,
    displayName: request.displayName,
    organizationName: request.organizationName,
    legalName: request.legalName || "",
    phone: request.phone,
    countryCode: request.countryCode || "",
    timezone: request.timezone,
    serviceType: request.serviceType,
    serviceLabel: serviceLabels[request.serviceType] || request.serviceType.replace(/_/g, " "),
    scopeSummary: request.scopeSummary,
    requestedStartAt: request.requestedStartAt?.toISOString() || "",
    emergencyContactName: request.emergencyContactName,
    emergencyContactEmail: request.emergencyContactEmail,
    status: request.status,
    emailVerifiedAt: request.emailVerifiedAt?.toISOString() || "",
    workspaceId: request.workspaceId || "",
    engagementId: request.engagementId || "",
    membershipId: request.membershipId || "",
    reviewedBy: request.reviewedBy || "",
    reviewedAt: request.reviewedAt?.toISOString() || "",
    reviewNote: request.reviewNote || "",
    sourceCountry: request.sourceCountry || "",
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString()
  };
}

export type VerifyGridOnboardingRecord = ReturnType<typeof mapRequest>;

export async function requestVerifyGridOnboarding(value: unknown, context: { country: string; ipHash: string }) {
  const input = verifyGridOnboardingRequestSchema.parse(value);
  if (input.website) return { accepted: true as const, requestId: "", tokenId: "", verificationUrl: "", shouldSendVerification: false as const };

  const prisma = getPrismaClient();
  const tokenId = crypto.randomUUID();
  const secret = randomSecret();
  const expiresAt = new Date(Date.now() + 30 * 60_000);
  const existing = await prisma.verifyGridOnboardingRequest.findFirst({
    where: {
      email: input.email,
      organizationName: { equals: input.organizationName, mode: "insensitive" },
      status: { in: ["pending_email", "email_verified", "provisioning"] }
    },
    orderBy: { createdAt: "desc" }
  });

  if (existing && existing.status !== "pending_email") {
    return { accepted: true as const, requestId: existing.id, tokenId: "", verificationUrl: "", shouldSendVerification: false as const };
  }

  if (existing) {
    const recentlyIssued = await prisma.verifyGridOnboardingToken.findFirst({
      where: { requestId: existing.id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date(Date.now() + 25 * 60_000) } },
      select: { id: true }
    });
    if (recentlyIssued) {
      return { accepted: true as const, requestId: existing.id, tokenId: "", verificationUrl: "", shouldSendVerification: false as const };
    }
  }

  const request = await prisma.$transaction(async (tx) => {
    const record = existing
      ? await tx.verifyGridOnboardingRequest.update({
          where: { id: existing.id },
          data: {
            displayName: input.displayName,
            phone: input.phone,
            legalName: input.legalName || null,
            countryCode: input.countryCode || null,
            timezone: input.timezone,
            serviceType: input.serviceType,
            scopeSummary: input.scopeSummary,
            requestedStartAt: input.requestedStartAt || null,
            emergencyContactName: input.emergencyContactName,
            emergencyContactEmail: input.emergencyContactEmail,
            contactConsentAt: new Date(),
            sourceCountry: context.country,
            sourceIpHash: context.ipHash
          }
        })
      : await tx.verifyGridOnboardingRequest.create({
          data: {
            email: input.email,
            displayName: input.displayName,
            organizationName: input.organizationName,
            legalName: input.legalName || null,
            phone: input.phone,
            countryCode: input.countryCode || null,
            timezone: input.timezone,
            serviceType: input.serviceType,
            scopeSummary: input.scopeSummary,
            requestedStartAt: input.requestedStartAt || null,
            emergencyContactName: input.emergencyContactName,
            emergencyContactEmail: input.emergencyContactEmail,
            contactConsentAt: new Date(),
            sourceCountry: context.country,
            sourceIpHash: context.ipHash
          }
        });
    await tx.verifyGridOnboardingToken.updateMany({ where: { requestId: record.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.verifyGridOnboardingToken.create({ data: { id: tokenId, requestId: record.id, tokenHash: sha256(secret), expiresAt } });
    return record;
  });

  const token = `vg_onboard_${tokenId}.${secret}`;
  return {
    accepted: true as const,
    requestId: request.id,
    tokenId,
    verificationUrl: `${siteConfig.url}/verifygrid/onboard/verify#token=${encodeURIComponent(token)}`,
    shouldSendVerification: true as const,
    request: mapRequest(request)
  };
}

export async function verifyVerifyGridOnboardingEmail(value: string) {
  const parsed = parseVerifyGridOnboardingToken(value);
  if (!parsed) throw new Error("This verification link is invalid.");
  const prisma = getPrismaClient();
  const now = new Date();
  const request = await prisma.$transaction(async (tx) => {
    const token = await tx.verifyGridOnboardingToken.findUnique({ where: { id: parsed.id }, include: { request: true } });
    if (!token || !safeEqual(token.tokenHash, parsed.tokenHash) || token.usedAt || token.revokedAt || token.expiresAt <= now || token.request.status !== "pending_email") {
      throw new Error("This verification link is invalid or expired.");
    }
    const consumed = await tx.verifyGridOnboardingToken.updateMany({
      where: { id: token.id, tokenHash: parsed.tokenHash, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now }
    });
    if (consumed.count !== 1) throw new Error("This verification link is invalid or expired.");
    await tx.verifyGridOnboardingToken.updateMany({ where: { requestId: token.requestId, id: { not: token.id }, usedAt: null, revokedAt: null }, data: { revokedAt: now } });
    return tx.verifyGridOnboardingRequest.update({ where: { id: token.requestId }, data: { status: "email_verified", emailVerifiedAt: now } });
  });
  return mapRequest(request);
}

export async function listVerifyGridOnboardingRequests() {
  const requests = await getPrismaClient().verifyGridOnboardingRequest.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return requests.map(mapRequest);
}

function engagementInput(request: VerifyGridOnboardingRecord) {
  const plannedStartAt = request.requestedStartAt ? new Date(request.requestedStartAt) : undefined;
  return {
    organizationName: request.organizationName,
    legalName: request.legalName,
    primaryContactName: request.displayName,
    primaryContactEmail: request.email,
    countryCode: request.countryCode,
    timezone: request.timezone,
    title: `${request.serviceLabel} onboarding`,
    serviceType: request.serviceType,
    testMode: "safe_checks",
    riskTier: "standard",
    scopeSummary: request.scopeSummary,
    plannedStartAt,
    plannedEndAt: plannedStartAt ? new Date(plannedStartAt.getTime() + 7 * 24 * 60 * 60_000) : undefined,
    emergencyContactName: request.emergencyContactName,
    emergencyContactEmail: request.emergencyContactEmail,
    emergencyContactPhone: request.phone,
    rulesOfEngagement: {
      businessHoursOnly: false,
      maxRequestsPerSecond: 5,
      sourceIps: [],
      prohibitedActions: ["Denial of service", "Persistence", "Destructive changes", "Access to third-party targets"],
      stopConditions: ["Service instability", "Client stop request", "Target ownership dispute", "Unexpected sensitive data exposure"],
      noExclusionsConfirmed: false,
      notes: "Created from a verified onboarding request. Scope, exclusions, ownership, and written authorization remain pending."
    }
  };
}

export async function reviewVerifyGridOnboardingRequest(id: string, value: unknown, actor: string) {
  const input = verifyGridOnboardingReviewSchema.parse(value);
  const prisma = getPrismaClient();
  const current = await prisma.verifyGridOnboardingRequest.findUnique({ where: { id } });
  if (!current) throw new Error("VerifyGrid onboarding request not found.");

  if (input.action === "reject") {
    if (!["pending_email", "email_verified"].includes(current.status)) throw new Error("This request can no longer be rejected from the intake queue.");
    const rejected = await prisma.verifyGridOnboardingRequest.update({
      where: { id },
      data: { status: "rejected", reviewedBy: actor, reviewedAt: new Date(), reviewNote: input.reviewNote }
    });
    await prisma.verifyGridOnboardingToken.updateMany({ where: { requestId: id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    return { request: mapRequest(rejected), accessUrl: "", emailDelivery: "not_sent" as const };
  }

  if (current.status === "approved" && current.workspaceId) {
    const invite = await inviteVerifyGridMember(current.workspaceId, { email: current.email, displayName: current.displayName, role: "client_owner", expiresInHours: 48 }, actor);
    const delivery = await sendVerifyGridAccessEmail({ email: current.email, displayName: current.displayName, organizationName: current.organizationName, accessUrl: invite.accessUrl, tokenId: invite.tokenId });
    return { request: mapRequest(current), accessUrl: invite.accessUrl, emailDelivery: delivery.reason };
  }

  if (current.status === "email_verified") {
    const claimed = await prisma.verifyGridOnboardingRequest.updateMany({
      where: { id, status: "email_verified" },
      data: { status: "provisioning", reviewedBy: actor, reviewNote: input.reviewNote || null }
    });
    if (claimed.count !== 1) throw new Error("This request is already being reviewed.");
  } else if (current.status !== "provisioning") {
    throw new Error("The work email must be verified before approval.");
  }

  let working = mapRequest(await prisma.verifyGridOnboardingRequest.findUniqueOrThrow({ where: { id } }));
  try {
    if (!working.workspaceId || !working.engagementId) {
      const engagement = await createVerifyGridEngagement(engagementInput(working), actor);
      const provisioned = await prisma.verifyGridOnboardingRequest.update({
        where: { id },
        data: { workspaceId: engagement.workspace.id, engagementId: engagement.id }
      });
      working = mapRequest(provisioned);
    }

    const invite = await inviteVerifyGridMember(working.workspaceId, { email: working.email, displayName: working.displayName, role: "client_owner", expiresInHours: 48 }, actor);
    const approved = await prisma.verifyGridOnboardingRequest.update({
      where: { id },
      data: { status: "approved", membershipId: invite.membership.id, reviewedBy: actor, reviewedAt: new Date(), reviewNote: input.reviewNote || null }
    });
    const delivery = await sendVerifyGridAccessEmail({ email: working.email, displayName: working.displayName, organizationName: working.organizationName, accessUrl: invite.accessUrl, tokenId: invite.tokenId });
    return { request: mapRequest(approved), accessUrl: invite.accessUrl, emailDelivery: delivery.reason };
  } catch (error) {
    await prisma.verifyGridOnboardingRequest.update({
      where: { id },
      data: { status: working.engagementId ? "provisioning" : "email_verified", reviewNote: error instanceof Error ? error.message.slice(0, 1000) : "Provisioning failed." }
    }).catch(() => undefined);
    throw error;
  }
}
