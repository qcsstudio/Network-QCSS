import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const adminCookieName = "network_qcss_admin";

type AdminSession = {
  email: string;
  expiresAt: number;
};

function adminEmail() {
  return process.env.ADMIN_EMAIL || "admin@network-qcss.local";
}

function adminPassword() {
  return process.env.ADMIN_PASSWORD || "admin";
}

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || "development-session-secret-change-me";
}

function apiToken() {
  return process.env.ADMIN_API_TOKEN || "";
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(payload: string) {
  return crypto.createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function createAdminSession(email: string) {
  const session: AdminSession = {
    email,
    expiresAt: Date.now() + 1000 * 60 * 60 * 8
  };
  const payload = base64UrlEncode(JSON.stringify(session));
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminSession(token?: string | null) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as AdminSession;
    if (!session.email || session.expiresAt < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function verifyAdminCredentials(email: string, password: string) {
  return safeEqual(email, adminEmail()) && safeEqual(password, adminPassword());
}

export async function getAdminSession() {
  const cookieStore = await cookies();
  return verifyAdminSession(cookieStore.get(adminCookieName)?.value);
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

function cookieFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${adminCookieName}=`));
  return cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : "";
}

export function isAdminRequest(request: Request) {
  const token = request.headers.get("x-admin-token");
  const configuredToken = apiToken();
  if (configuredToken && token && safeEqual(token, configuredToken)) return true;
  return Boolean(verifyAdminSession(cookieFromRequest(request)));
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  };
}
