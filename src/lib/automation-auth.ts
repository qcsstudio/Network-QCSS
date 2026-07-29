import crypto, { type JsonWebKey } from "node:crypto";

const githubIssuer = "https://token.actions.githubusercontent.com";
const githubJwksUrl = `${githubIssuer}/.well-known/jwks`;
const githubAudience = "https://www.qcsstudio.com/automation";
const githubRepository = "qcsstudio/network-qcss";
const githubRepositoryId = "1286536826";
const githubWorkflowRef = "qcsstudio/network-qcss/.github/workflows/editorial-automation.yml@refs/heads/main";

type GithubOidcClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  iat?: number;
  repository?: string;
  repository_id?: string;
  ref?: string;
  workflow_ref?: string;
  event_name?: string;
  sub?: string;
};

type GithubJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

let cachedKeys: { expiresAt: number; keys: GithubJwk[] } | null = null;

function decodeJsonSegment<T>(value: string) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
}

function audienceIncludes(value: GithubOidcClaims["aud"], expected: string) {
  return Array.isArray(value) ? value.includes(expected) : value === expected;
}

export function validateGithubAutomationClaims(claims: GithubOidcClaims, nowSeconds = Math.floor(Date.now() / 1000)) {
  const repository = claims.repository?.toLowerCase();
  const workflowRef = claims.workflow_ref?.toLowerCase();
  const subject = claims.sub?.toLowerCase();
  return Boolean(
    claims.iss === githubIssuer &&
      audienceIncludes(claims.aud, githubAudience) &&
      typeof claims.exp === "number" &&
      claims.exp > nowSeconds - 30 &&
      typeof claims.nbf === "number" &&
      claims.nbf <= nowSeconds + 30 &&
      typeof claims.iat === "number" &&
      claims.iat <= nowSeconds + 30 &&
      claims.iat >= nowSeconds - 15 * 60 &&
      repository === githubRepository &&
      claims.repository_id === githubRepositoryId &&
      claims.ref === "refs/heads/main" &&
      workflowRef === githubWorkflowRef &&
      (claims.event_name === "schedule" || claims.event_name === "workflow_dispatch") &&
      subject === `repo:${githubRepository}:ref:refs/heads/main`
  );
}

async function githubSigningKeys() {
  if (cachedKeys && cachedKeys.expiresAt > Date.now()) return cachedKeys.keys;
  const response = await fetch(githubJwksUrl, {
    cache: "no-store",
    headers: { accept: "application/json", "user-agent": "QCS-Automation-Identity/1.0" },
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok || response.url !== githubJwksUrl) throw new Error("GitHub OIDC signing keys are unavailable.");
  const payload = (await response.json()) as { keys?: GithubJwk[] };
  if (!Array.isArray(payload.keys) || !payload.keys.length) throw new Error("GitHub OIDC returned no signing keys.");
  cachedKeys = { keys: payload.keys, expiresAt: Date.now() + 60 * 60_000 };
  return payload.keys;
}

async function verifyGithubAutomationToken(token: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const header = decodeJsonSegment<{ alg?: string; kid?: string; typ?: string }>(parts[0]);
    if (header.alg !== "RS256" || !header.kid || (header.typ && header.typ !== "JWT")) return false;
    const keys = await githubSigningKeys();
    const jwk = keys.find((item) => item.kid === header.kid && item.kty === "RSA" && (!item.alg || item.alg === "RS256"));
    if (!jwk) return false;
    const key = crypto.createPublicKey({ key: jwk, format: "jwk" });
    const verified = crypto.verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], "base64url"));
    return verified && validateGithubAutomationClaims(decodeJsonSegment<GithubOidcClaims>(parts[1]));
  } catch {
    return false;
  }
}

export async function isAutomationRequest(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && authorization === `Bearer ${cronSecret}`) return true;
  if (!authorization.startsWith("Bearer ")) return false;
  return verifyGithubAutomationToken(authorization.slice("Bearer ".length).trim());
}
