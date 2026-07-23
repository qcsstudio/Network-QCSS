import crypto from "node:crypto";
import net from "node:net";
import { z } from "zod";
import { capabilityCatalog, verifyGridCapabilities } from "./verifygrid-catalog.ts";

export const verifyGridConnectorProviders = ["tenable", "qualys", "rapid7", "greenbone"] as const;
export type VerifyGridConnectorProvider = typeof verifyGridConnectorProviders[number];

export const connectorProviderCatalog: Record<VerifyGridConnectorProvider, {
  label: string;
  mode: "cloud_api" | "sensor_api";
  defaultBaseUrl: string;
  requiredSecrets: string[];
}> = {
  tenable: {
    label: "Tenable Vulnerability Management",
    mode: "cloud_api",
    defaultBaseUrl: "https://cloud.tenable.com",
    requiredSecrets: ["ACCESS_KEY", "SECRET_KEY"]
  },
  qualys: {
    label: "Qualys VMDR",
    mode: "cloud_api",
    defaultBaseUrl: "https://qualysapi.qualys.com",
    requiredSecrets: ["USERNAME", "PASSWORD"]
  },
  rapid7: {
    label: "Rapid7 InsightVM",
    mode: "cloud_api",
    defaultBaseUrl: "https://insightvm.example.com",
    requiredSecrets: ["USERNAME", "PASSWORD"]
  },
  greenbone: {
    label: "Greenbone GMP",
    mode: "sensor_api",
    defaultBaseUrl: "https://greenbone.local",
    requiredSecrets: ["USERNAME", "PASSWORD"]
  }
};

const credentialRef = z.string().trim().regex(/^[A-Z][A-Z0-9_]{2,60}$/, "Use an uppercase environment-variable prefix.");

export const connectorProfileSchema = z.object({
  engagementId: z.string().trim().min(1),
  provider: z.enum(verifyGridConnectorProviders),
  label: z.string().trim().min(3).max(100),
  baseUrl: z.string().trim().url().max(500),
  credentialRef,
  syncMode: z.enum(["differential", "full"]).default("differential"),
  scheduleMinutes: z.coerce.number().int().min(15).max(43_200).default(1440)
});

export const connectorRunSchema = z.object({
  trigger: z.enum(["admin", "scheduled"]).default("admin")
});

export const sensorCreateSchema = z.object({
  name: z.string().trim().min(3).max(100),
  capabilities: z.array(z.enum(verifyGridCapabilities)).min(1).max(8).transform((items) => [...new Set(items)])
}).superRefine((value, context) => {
  if (value.capabilities.some((capability) => !capabilityCatalog[capability].sensorDispatch)) {
    context.addIssue({ code: "custom", path: ["capabilities"], message: "Sensors may enroll only for dispatchable scanner capabilities." });
  }
});

export const executionQueueSchema = z.object({
  sensorId: z.string().trim().min(1)
});

export const executionApprovalSchema = z.object({
  approvalNote: z.string().trim().min(30).max(2000),
  acknowledgeControlledValidation: z.literal(true, { message: "Confirm the controlled-validation execution boundary." })
});

export const sensorHeartbeatSchema = z.object({
  jobId: z.string().trim().min(1),
  state: z.enum(["claimed", "running"]),
  version: z.string().trim().max(80).optional(),
  region: z.string().trim().max(80).optional()
});

export const sensorResultSchema = z.object({
  jobId: z.string().trim().min(1),
  manifestSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  content: z.string().max(2_000_000),
  summary: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional().default({})
});

export const sensorFailureSchema = z.object({
  jobId: z.string().trim().min(1),
  manifestSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  error: z.string().trim().min(10).max(2000),
  retryable: z.boolean().default(true)
});

export const membershipInviteSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  displayName: z.string().trim().max(120).optional().default(""),
  role: z.enum(["client_owner", "client_analyst", "client_viewer"]),
  expiresInHours: z.coerce.number().int().min(1).max(168).default(48)
});

export const membershipRevokeSchema = z.object({
  reason: z.string().trim().min(10).max(500)
});

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

export function randomSecret(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function sensorToken(sensorId: string) {
  const secret = randomSecret();
  return { token: `vg_sensor_${sensorId}.${secret}`, tokenHash: sha256(secret), tokenLastFour: secret.slice(-4) };
}

export function parseSensorToken(value: string) {
  const match = /^vg_sensor_([a-zA-Z0-9_-]{8,80})\.([a-zA-Z0-9_-]{32,})$/.exec(value.trim());
  return match ? { sensorId: match[1], secret: match[2], tokenHash: sha256(match[2]) } : null;
}

export function signSensorManifest(secret: string, payload: string) {
  return crypto.createHmac("sha256", secret).update(payload, "utf8").digest("base64url");
}

export function safeEqual(left: string, right: string) {
  const first = Buffer.from(left);
  const second = Buffer.from(right);
  return first.length === second.length && crypto.timingSafeEqual(first, second);
}

export function isPrivateAddress(address: string) {
  if (!net.isIP(address)) return false;
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (net.isIPv4(address)) {
    const [first, second] = address.split(".").map(Number);
    return first === 0 || first === 10 || first === 127 || first >= 224 || (first === 169 && second === 254) || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
  }
  return false;
}

export function connectorEnvironmentKeys(provider: VerifyGridConnectorProvider, prefix: string) {
  return connectorProviderCatalog[provider].requiredSecrets.map((suffix) => `${prefix}_${suffix}`);
}

export function validateConnectorBaseUrl(value: string, provider: VerifyGridConnectorProvider) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("Connector endpoints must use HTTPS.");
  if (url.username || url.password) throw new Error("Connector credentials must not be embedded in the URL.");
  const cloudConnector = connectorProviderCatalog[provider].mode === "cloud_api";
  if (cloudConnector && url.port && url.port !== "443") throw new Error("Cloud connector endpoints must use the standard HTTPS port.");
  if (url.pathname !== "/" || url.search || url.hash) throw new Error("Store only the connector origin, without a path, query, or fragment.");
  if (cloudConnector && (url.hostname === "localhost" || isPrivateAddress(url.hostname))) throw new Error("Cloud connector endpoints must not target loopback or private addresses.");
  if (cloudConnector && !url.hostname.includes(".")) throw new Error("Cloud connector endpoints require a public hostname.");
  return url.origin;
}

export function retryDelayMinutes(attempt: number) {
  return Math.min(360, Math.max(1, 2 ** Math.max(0, attempt - 1) * 5));
}
