import crypto from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type RegistrationResponseJSON
} from "@simplewebauthn/server";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getPrismaClient } from "@/lib/prisma";

export const verifyGridOperatorCookieName = "network_qcss_verifygrid_operator";

export type VerifyGridPermission =
  | "view"
  | "operate"
  | "manage_scope"
  | "approve_execution"
  | "review_report"
  | "release_report"
  | "manage_access";

export type VerifyGridOperatorContext = {
  id: string;
  email: string;
  displayName: string;
  role: string;
  sessionId: string;
};

const rolePermissions: Record<string, VerifyGridPermission[]> = {
  owner: ["view", "operate", "manage_scope", "approve_execution", "review_report", "release_report", "manage_access"],
  lead: ["view", "operate", "manage_scope", "approve_execution", "review_report", "release_report", "manage_access"],
  analyst: ["view", "operate"],
  reviewer: ["view", "review_report", "release_report"],
  observer: ["view"]
};

function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function adminEmail() {
  if (process.env.ADMIN_EMAIL?.trim()) return process.env.ADMIN_EMAIL.trim().toLowerCase();
  return process.env.NODE_ENV === "production" ? "" : "admin@network-qcss.local";
}

function requestOrigin(request: Request) {
  return (process.env.VERIFYGRID_WEBAUTHN_ORIGIN || new URL(request.url).origin).replace(/\/$/, "");
}

function requestRpId(request: Request) {
  return process.env.VERIFYGRID_WEBAUTHN_RP_ID || new URL(request.url).hostname;
}

function parseTransports(value: unknown): AuthenticatorTransportFuture[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is AuthenticatorTransportFuture => typeof item === "string") as AuthenticatorTransportFuture[];
}

function cookieFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${verifyGridOperatorCookieName}=`));
  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : "";
}

function headerFingerprint(headerList: Headers) {
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const userAgent = headerList.get("user-agent") || "unknown";
  return { ipHash: sha256(forwarded), userAgentHash: sha256(userAgent) };
}

export function verifyGridOperatorCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 2
  };
}

export function permissionForVerifyGridRequest(request: Request): VerifyGridPermission {
  const url = new URL(request.url);
  const path = url.pathname;
  if (request.method === "GET") return "view";
  if (path.includes("/reports/") && path.endsWith("/review")) return "review_report";
  if (path.includes("/reports/") && path.endsWith("/release")) return "release_report";
  if (path.includes("/execution-jobs/") && (path.endsWith("/approve") || path.endsWith("/queue"))) return "approve_execution";
  if (path.endsWith("/kill-switch")) return "approve_execution";
  if (path.includes("/sensors") || path.includes("/connectors") || path.includes("/memberships") || path.includes("/onboarding")) {
    return "manage_access";
  }
  if (path.includes("/scope") || path.includes("/authorize") || (path.endsWith("/engagements") && request.method === "POST")) {
    return "manage_scope";
  }
  return "operate";
}

export function operatorHasPermission(role: string, permission: VerifyGridPermission) {
  return Boolean(rolePermissions[role]?.includes(permission));
}

async function sessionFromToken(token: string, expectedUserAgentHash?: string) {
  if (!token) return null;
  const prisma = getPrismaClient();
  const session = await prisma.verifyGridOperatorSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { operator: true }
  });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || session.operator.status !== "active") return null;
  if (expectedUserAgentHash && session.userAgentHash && session.userAgentHash !== expectedUserAgentHash) return null;
  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60_000) {
    await prisma.verifyGridOperatorSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  }
  return {
    id: session.operator.id,
    email: session.operator.email,
    displayName: session.operator.displayName,
    role: session.operator.role,
    sessionId: session.id
  } satisfies VerifyGridOperatorContext;
}

export async function getVerifyGridOperatorFromRequest(request: Request, permission: VerifyGridPermission = "view") {
  const operator = await sessionFromToken(cookieFromRequest(request), headerFingerprint(request.headers).userAgentHash);
  if (!operator || !operatorHasPermission(operator.role, permission)) return null;
  return operator;
}

export async function getVerifyGridOperatorFromCookies(permission: VerifyGridPermission = "view") {
  const cookieStore = await cookies();
  const headerList = await headers();
  const operator = await sessionFromToken(cookieStore.get(verifyGridOperatorCookieName)?.value || "", headerFingerprint(headerList).userAgentHash);
  if (!operator || !operatorHasPermission(operator.role, permission)) return null;
  return operator;
}

export async function requireVerifyGridOperator(permission: VerifyGridPermission = "view") {
  const operator = await getVerifyGridOperatorFromCookies(permission);
  if (!operator) redirect("/admin?verifygrid=locked");
  return operator;
}

export async function getVerifyGridAccessState(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const current = await getVerifyGridOperatorFromCookies();
  if (current?.email === normalizedEmail) {
    return { state: "unlocked" as const, operator: current, passkeyCount: 1 };
  }
  const prisma = getPrismaClient();
  const operator = await prisma.verifyGridOperator.findUnique({
    where: { email: normalizedEmail },
    include: { passkeys: { select: { id: true } } }
  });
  if (!operator) {
    const count = await prisma.verifyGridOperator.count();
    return { state: count === 0 && normalizedEmail === adminEmail() ? "enrollment_required" as const : "not_provisioned" as const, operator: null, passkeyCount: 0 };
  }
  return {
    state: operator.passkeys.length ? "authentication_required" as const : "enrollment_required" as const,
    operator: { id: operator.id, email: operator.email, displayName: operator.displayName, role: operator.role },
    passkeyCount: operator.passkeys.length
  };
}

async function bootstrapOperator(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const prisma = getPrismaClient();
  const existing = await prisma.verifyGridOperator.findUnique({ where: { email: normalizedEmail }, include: { passkeys: true } });
  if (existing) return existing;
  if (normalizedEmail !== adminEmail() || (await prisma.verifyGridOperator.count()) > 0) {
    throw new Error("This administrator has not been provisioned as a VerifyGrid operator.");
  }
  return prisma.verifyGridOperator.create({
    data: { email: normalizedEmail, displayName: normalizedEmail.split("@")[0], role: "owner", createdBy: "admin-bootstrap" },
    include: { passkeys: true }
  });
}

async function replaceChallenge(operatorId: string, kind: "registration" | "authentication", challenge: string) {
  const prisma = getPrismaClient();
  await prisma.$transaction([
    prisma.verifyGridOperatorChallenge.updateMany({
      where: { operatorId, kind, usedAt: null },
      data: { usedAt: new Date() }
    }),
    prisma.verifyGridOperatorChallenge.create({
      data: { operatorId, kind, challenge, expiresAt: new Date(Date.now() + 5 * 60_000) }
    })
  ]);
}

async function activeChallenge(operatorId: string, kind: "registration" | "authentication") {
  return getPrismaClient().verifyGridOperatorChallenge.findFirst({
    where: { operatorId, kind, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" }
  });
}

async function issueOperatorSession(operatorId: string, request: Request) {
  const token = crypto.randomBytes(32).toString("base64url");
  const fingerprint = headerFingerprint(request.headers);
  const prisma = getPrismaClient();
  await prisma.$transaction([
    prisma.verifyGridOperatorSession.create({
      data: { operatorId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 2 * 60 * 60_000), ...fingerprint }
    }),
    prisma.verifyGridOperator.update({ where: { id: operatorId }, data: { lastAuthenticatedAt: new Date() } })
  ]);
  return token;
}

export async function createRegistrationOptions(email: string, request: Request) {
  const operator = await bootstrapOperator(email);
  if (operator.status !== "active") throw new Error("This VerifyGrid operator is inactive.");
  if (operator.passkeys.length) {
    const current = await getVerifyGridOperatorFromRequest(request, "manage_access");
    if (!current || current.id !== operator.id) throw new Error("Authenticate with an existing passkey before adding another one.");
  }
  const options = await generateRegistrationOptions({
    rpName: "QCS VerifyGrid",
    rpID: requestRpId(request),
    userID: Buffer.from(operator.id, "utf8"),
    userName: operator.email,
    userDisplayName: operator.displayName,
    attestationType: "none",
    timeout: 120_000,
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    supportedAlgorithmIDs: [-7, -257],
    excludeCredentials: operator.passkeys.map((passkey) => ({ id: passkey.credentialId, transports: parseTransports(passkey.transports) }))
  });
  await replaceChallenge(operator.id, "registration", options.challenge);
  return options;
}

export async function completeRegistration(email: string, request: Request, response: RegistrationResponseJSON, label?: string) {
  const operator = await bootstrapOperator(email);
  const challenge = await activeChallenge(operator.id, "registration");
  if (!challenge) throw new Error("The passkey enrollment challenge expired. Start again.");
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: requestOrigin(request),
    expectedRPID: requestRpId(request),
    requireUserVerification: true,
    supportedAlgorithmIDs: [-7, -257]
  });
  if (!verification.verified || !verification.registrationInfo) throw new Error("Passkey enrollment could not be verified.");
  const info = verification.registrationInfo;
  const prisma = getPrismaClient();
  await prisma.$transaction([
    prisma.verifyGridOperatorPasskey.create({
      data: {
        operatorId: operator.id,
        credentialId: info.credential.id,
        publicKey: Buffer.from(info.credential.publicKey),
        counter: BigInt(info.credential.counter),
        transports: response.response.transports || [],
        deviceType: info.credentialDeviceType,
        backedUp: info.credentialBackedUp,
        label: label?.trim().slice(0, 80) || "Primary passkey"
      }
    }),
    prisma.verifyGridOperatorChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } })
  ]);
  return { token: await issueOperatorSession(operator.id, request), operator };
}

export async function createAuthenticationOptions(email: string, request: Request) {
  const operator = await getPrismaClient().verifyGridOperator.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { passkeys: true }
  });
  if (!operator || operator.status !== "active" || !operator.passkeys.length) throw new Error("No active passkey is available for this operator.");
  const options = await generateAuthenticationOptions({
    rpID: requestRpId(request),
    timeout: 120_000,
    userVerification: "required",
    allowCredentials: operator.passkeys.map((passkey) => ({ id: passkey.credentialId, transports: parseTransports(passkey.transports) }))
  });
  await replaceChallenge(operator.id, "authentication", options.challenge);
  return options;
}

export async function completeAuthentication(email: string, request: Request, response: AuthenticationResponseJSON) {
  const operator = await getPrismaClient().verifyGridOperator.findUnique({
    where: { email: email.trim().toLowerCase() },
    include: { passkeys: true }
  });
  if (!operator || operator.status !== "active") throw new Error("VerifyGrid operator access is unavailable.");
  const passkey = operator.passkeys.find((item) => item.credentialId === response.id);
  if (!passkey) throw new Error("The selected passkey is not registered for this operator.");
  const challenge = await activeChallenge(operator.id, "authentication");
  if (!challenge) throw new Error("The authentication challenge expired. Start again.");
  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge.challenge,
    expectedOrigin: requestOrigin(request),
    expectedRPID: requestRpId(request),
    credential: { id: passkey.credentialId, publicKey: new Uint8Array(passkey.publicKey), counter: Number(passkey.counter), transports: parseTransports(passkey.transports) },
    requireUserVerification: true
  });
  if (!verification.verified || !verification.authenticationInfo.userVerified) throw new Error("Passkey authentication could not be verified.");
  const prisma = getPrismaClient();
  await prisma.$transaction([
    prisma.verifyGridOperatorPasskey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        deviceType: verification.authenticationInfo.credentialDeviceType,
        backedUp: verification.authenticationInfo.credentialBackedUp,
        lastUsedAt: new Date()
      }
    }),
    prisma.verifyGridOperatorChallenge.update({ where: { id: challenge.id }, data: { usedAt: new Date() } })
  ]);
  return { token: await issueOperatorSession(operator.id, request), operator };
}

export async function revokeOperatorSession(request: Request) {
  const token = cookieFromRequest(request);
  if (!token) return;
  await getPrismaClient().verifyGridOperatorSession.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function cleanExpiredVerifyGridOperatorSecurity() {
  const prisma = getPrismaClient();
  const now = new Date();
  const sessionCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const challengeCutoff = new Date(now.getTime() - 24 * 60 * 60_000);
  const [sessions, challenges] = await prisma.$transaction([
    prisma.verifyGridOperatorSession.deleteMany({
      where: { OR: [{ expiresAt: { lt: sessionCutoff } }, { revokedAt: { lt: sessionCutoff } }] }
    }),
    prisma.verifyGridOperatorChallenge.deleteMany({
      where: { OR: [{ expiresAt: { lt: challengeCutoff } }, { usedAt: { lt: challengeCutoff } }] }
    })
  ]);
  return { sessions: sessions.count, challenges: challenges.count };
}
