import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";
import { membershipInviteSchema, membershipRevokeSchema, randomSecret, safeEqual, sha256 } from "@/lib/verifygrid-automation-domain";
import { siteConfig } from "@/lib/content";

export const verifyGridPortalCookie = "qcs_verifygrid_portal";

type PortalSession = {
  membershipId: string;
  workspaceId: string;
  email: string;
  role: string;
  expiresAt: number;
};

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function sessionSecret() {
  const secret = process.env.VERIFYGRID_PORTAL_SESSION_SECRET?.trim() || process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) throw new Error("VERIFYGRID_PORTAL_SESSION_SECRET or ADMIN_SESSION_SECRET is required.");
  return secret;
}

function sign(payload: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function encodeSession(session: PortalSession) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decodeSession(value?: string | null) {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PortalSession;
    if (!session.membershipId || !session.workspaceId || !session.email || !session.role || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

function parseAccessToken(value: string) {
  const match = /^vg_access_([a-zA-Z0-9_-]{8,80})\.([a-zA-Z0-9_-]{32,})$/.exec(value.trim());
  return match ? { id: match[1], secret: match[2], hash: sha256(match[2]) } : null;
}

export async function inviteVerifyGridMember(workspaceId: string, value: unknown, actor: string) {
  const input = membershipInviteSchema.parse(value);
  const prisma = getPrismaClient();
  const workspace = await prisma.verifyGridWorkspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
  if (!workspace) throw new Error("VerifyGrid workspace not found.");
  const accessId = crypto.randomUUID();
  const secret = randomSecret();
  const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60_000);
  const membership = await prisma.$transaction(async (tx) => {
    const member = await tx.verifyGridMembership.upsert({
      where: { workspaceId_email: { workspaceId, email: input.email } },
      update: { displayName: input.displayName || null, role: input.role, status: "invited", invitedBy: actor, invitedAt: new Date(), acceptedAt: null, revokedAt: null },
      create: { workspaceId, email: input.email, displayName: input.displayName || null, role: input.role, status: "invited", invitedBy: actor }
    });
    await tx.verifyGridAccessToken.updateMany({ where: { membershipId: member.id, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.verifyGridAccessToken.create({ data: { id: accessId, membershipId: member.id, tokenHash: sha256(secret), expiresAt, createdBy: actor } });
    await tx.verifyGridActivity.create({ data: { workspaceId, action: "portal.member_invited", actor, metadata: json({ membershipId: member.id, email: member.email, role: member.role, expiresAt: expiresAt.toISOString() }) } });
    return member;
  });
  const token = `vg_access_${accessId}.${secret}`;
  return {
    membership: { id: membership.id, email: membership.email, displayName: membership.displayName || "", role: membership.role, status: membership.status },
    accessUrl: `${siteConfig.url}/portal/access#token=${encodeURIComponent(token)}`,
    expiresAt: expiresAt.toISOString()
  };
}

export async function consumeVerifyGridAccessToken(value: string) {
  const parsed = parseAccessToken(value);
  if (!parsed) throw new Error("This portal access link is invalid.");
  const prisma = getPrismaClient();
  const now = new Date();
  const membership = await prisma.$transaction(async (tx) => {
    const token = await tx.verifyGridAccessToken.findUnique({ where: { id: parsed.id }, include: { membership: true } });
    if (!token || !safeEqual(token.tokenHash, parsed.hash) || token.usedAt || token.revokedAt || token.expiresAt <= now) {
      throw new Error("This portal access link is invalid or expired.");
    }
    const activated = await tx.verifyGridMembership.updateMany({
      where: { id: token.membership.id, status: { in: ["invited", "active"] }, revokedAt: null },
      data: { status: "active", acceptedAt: token.membership.acceptedAt || now, lastAccessAt: now }
    });
    if (activated.count !== 1) throw new Error("This workspace membership was revoked.");
    const consumed = await tx.verifyGridAccessToken.updateMany({
      where: { id: token.id, tokenHash: parsed.hash, usedAt: null, revokedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now }
    });
    if (consumed.count !== 1) throw new Error("This portal access link is invalid or expired.");
    await tx.verifyGridActivity.create({
      data: {
        workspaceId: token.membership.workspaceId,
        action: "portal.access_accepted",
        actor: token.membership.email,
        metadata: json({ membershipId: token.membership.id, role: token.membership.role })
      }
    });
    return token.membership;
  });
  const expiresAt = Date.now() + 8 * 60 * 60_000;
  return {
    cookie: encodeSession({ membershipId: membership.id, workspaceId: membership.workspaceId, email: membership.email, role: membership.role, expiresAt }),
    maxAge: 8 * 60 * 60
  };
}

export async function revokeVerifyGridMembership(membershipId: string, value: unknown, actor: string) {
  const input = membershipRevokeSchema.parse(value);
  const prisma = getPrismaClient();
  const membership = await prisma.verifyGridMembership.findUnique({ where: { id: membershipId } });
  if (!membership) throw new Error("VerifyGrid membership not found.");
  await prisma.$transaction([
    prisma.verifyGridMembership.update({ where: { id: membershipId }, data: { status: "revoked", revokedAt: new Date() } }),
    prisma.verifyGridAccessToken.updateMany({ where: { membershipId, usedAt: null, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.verifyGridActivity.create({ data: { workspaceId: membership.workspaceId, action: "portal.member_revoked", actor, metadata: json({ membershipId, email: membership.email, reason: input.reason }) } })
  ]);
}

export function portalCookieOptions(maxAge: number) {
  return { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge };
}

export async function getVerifyGridPortalSession() {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(verifyGridPortalCookie)?.value);
  if (!session) return null;
  const membership = await getPrismaClient().verifyGridMembership.findFirst({ where: { id: session.membershipId, workspaceId: session.workspaceId, email: session.email, role: session.role, status: "active", revokedAt: null }, include: { workspace: true } });
  if (!membership) return null;
  return { ...session, membership };
}

export async function requireVerifyGridPortalSession() {
  const session = await getVerifyGridPortalSession();
  if (!session) redirect("/portal/access");
  return session;
}

export async function getVerifyGridPortalWorkspace(workspaceId: string) {
  const workspace = await getPrismaClient().verifyGridWorkspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      legalName: true,
      engagements: {
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          reference: true,
          title: true,
          serviceType: true,
          status: true,
          scopeSummary: true,
          updatedAt: true,
          scopeTargets: { select: { id: true, targetType: true, value: true, environment: true, criticality: true, inScope: true } },
          findings: { where: { status: { notIn: ["false_positive", "duplicate"] } }, orderBy: [{ knownExploited: "desc" }, { updatedAt: "desc" }], select: { id: true, title: true, severity: true, status: true, knownExploited: true, businessImpact: true, remediation: true, ownerName: true, dueAt: true, updatedAt: true } },
          reports: { where: { status: "final" }, orderBy: { generatedAt: "desc" }, select: { id: true, title: true, reportType: true, version: true, generatedAt: true } }
        }
      }
    }
  });
  if (!workspace) throw new Error("VerifyGrid workspace not found.");
  return workspace;
}
