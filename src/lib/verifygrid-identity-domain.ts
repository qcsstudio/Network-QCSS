import crypto from "node:crypto";
import {z} from "zod";

export const verifyGridSSOCallbackPath = "/api/verifygrid/identity/callback";
export const verifyGridOperatorPath = "/operator/verifygrid";
export const verifyGridSSOMaxAgeSeconds = 15 * 60;
export const verifyGridEntraRoles = {
  "VerifyGrid.Owner": "owner", "VerifyGrid.Lead": "lead", "VerifyGrid.Analyst": "analyst",
  "VerifyGrid.Reviewer": "reviewer", "VerifyGrid.Observer": "observer"
} as const;
const guid = z.string().uuid().transform(value => value.toLowerCase());
const enabled = (value?: string) => value === "1" || value === "true";
export const verifyGridSSORequired = () => enabled(process.env.VERIFYGRID_SSO_REQUIRED);

export function verifyGridSSOConfig(env: NodeJS.ProcessEnv = process.env) {
  if (!enabled(env.VERIFYGRID_SSO_ENABLED)) return null;
  const tenantId = guid.parse(env.VERIFYGRID_ENTRA_TENANT_ID);
  const clientId = guid.parse(env.VERIFYGRID_ENTRA_CLIENT_ID);
  const clientSecret = z.string().trim().min(1).parse(env.VERIFYGRID_ENTRA_CLIENT_SECRET);
  const sessionSecret = z.string().trim().min(32).parse(env.VERIFYGRID_SSO_SESSION_SECRET);
  const url = new URL(env.VERIFYGRID_SSO_ORIGIN || "");
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password ||
      (url.protocol !== "https:" && !(env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost","127.0.0.1"].includes(url.hostname)))) {
    throw new Error("VerifyGrid SSO requires an exact HTTPS application origin.");
  }
  return {tenantId,clientId,clientSecret,sessionSecret,origin:url.origin,
    issuer:`https://login.microsoftonline.com/${tenantId}/v2.0`,redirectUri:url.origin + verifyGridSSOCallbackPath};
}
export type VerifyGridSSOConfig = NonNullable<ReturnType<typeof verifyGridSSOConfig>>;

/** Called only after the OIDC library verifies the signed ID token. */
export function verifyGridEntraIdentity(claims: Record<string,unknown>, config: Pick<VerifyGridSSOConfig,"tenantId"|"clientId"|"issuer">, now = Date.now()) {
  if (claims.iss !== config.issuer || claims.aud !== config.clientId || guid.parse(claims.tid) !== config.tenantId || claims.ver !== "2.0") {
    throw new Error("The identity is not from the configured tenant and application.");
  }
  const objectId = guid.parse(claims.oid);
  if (typeof claims.sub !== "string" || !claims.sub || typeof claims.exp !== "number" || claims.exp * 1000 <= now ||
      typeof claims.iat !== "number" || claims.iat * 1000 > now + 60_000) throw new Error("The identity token is not current.");
  const roles = Array.isArray(claims.roles) ? [...new Set(claims.roles)] : [];
  if (roles.length !== 1 || typeof roles[0] !== "string" || !Object.hasOwn(verifyGridEntraRoles,roles[0])) {
    throw new Error("Exactly one assigned VerifyGrid application role is required.");
  }
  // UPN/email is display and audit data. Only tenant + object ID binds identity.
  const email = z.string().trim().toLowerCase().email().max(254).parse(claims.preferred_username || claims.email);
  return {tenantId:config.tenantId,objectId,email,
    displayName:typeof claims.name === "string" && claims.name.trim() ? claims.name.trim().slice(0,120) : email,
    role:verifyGridEntraRoles[roles[0] as keyof typeof verifyGridEntraRoles],tokenExpiresAt:new Date(claims.exp*1000)};
}

export function sealVerifyGridLogin(value: {verifier:string;nonce:string;state:string}, secret: string) {
  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update("verifygrid-sso-login:" + secret).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm",key,iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),ciphertext]).toString("base64url");
}
export function openVerifyGridLogin(value: string, secret: string) {
  const bytes = Buffer.from(value,"base64url");
  if (bytes.length < 29) throw new Error("Invalid sign-in transaction.");
  const key = crypto.createHash("sha256").update("verifygrid-sso-login:" + secret).digest();
  const decipher = crypto.createDecipheriv("aes-256-gcm",key,bytes.subarray(0,12));
  decipher.setAuthTag(bytes.subarray(12,28));
  const plain = Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString("utf8");
  return z.object({verifier:z.string().min(43),nonce:z.string().min(32),state:z.string().min(32)}).parse(JSON.parse(plain));
}
