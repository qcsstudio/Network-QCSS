import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import catalog from '../content/automated-advisory-releases.json' with { type: 'json' };

export const automatedAdvisorySchemaVersion = 1;
export const automatedAdvisoryOrigin = 'https://www.qcsstudio.com';
export const automatedFirstSeenAfter = '2026-11-19T12:34:10Z';
export const automatedAdvisoryLimits = Object.freeze({
  releaseBytes: 500_000,
  catalogBytes: 4_000_000,
  catalogReleases: 64,
  assetBytes: 25 * 1024 * 1024,
  sourceBodyBytes: 4 * 1024 * 1024,
  sourceAgeMs: 24 * 60 * 60 * 1000,
  reviewAgeMs: 24 * 60 * 60 * 1000,
  reconciliationAgeMs: 15 * 60 * 1000,
  vendorUpdateAgeMs: 72 * 60 * 60 * 1000,
});

function fail(message: string): never {
  throw new Error(`Automated advisory: ${message}`);
}

type DeepReadonly<T> = T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
function freeze<T>(value: T): DeepReadonly<T> {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value as DeepReadonly<T>;
}

// Exact hosts, never suffix wildcards. Expanding the supported vendors requires a code review.
export const automatedOfficialSourceHosts = freeze({
  Cisco: ['sec.cloudapps.cisco.com', 'www.cisco.com', 'tools.cisco.com', 'blogs.cisco.com'],
  Fortinet: ['www.fortiguard.com', 'fortiguard.fortinet.com', 'docs.fortinet.com'],
  'Palo Alto Networks': ['security.paloaltonetworks.com', 'docs.paloaltonetworks.com'],
  AWS: ['aws.amazon.com', 'docs.aws.amazon.com'],
  Microsoft: ['msrc.microsoft.com', 'api.msrc.microsoft.com', 'learn.microsoft.com'],
  Juniper: ['supportportal.juniper.net', 'www.juniper.net'],
  F5: ['my.f5.com', 'techdocs.f5.com'],
  Broadcom: ['support.broadcom.com', 'knowledge.broadcom.com', 'techdocs.broadcom.com'],
  VMware: ['www.vmware.com', 'support.broadcom.com', 'knowledge.broadcom.com'],
  'Red Hat': ['access.redhat.com'],
  Arista: ['www.arista.com'],
  'Check Point': ['support.checkpoint.com', 'support.checkpoint.com.cn'],
  'Google Cloud': ['cloud.google.com', 'docs.cloud.google.com'],
  Ubuntu: ['ubuntu.com'],
});
export type AutomatedAdvisoryVendor = keyof typeof automatedOfficialSourceHosts;
const supplementalHosts = ['www.cisa.gov', 'www.cve.org', 'cveawg.mitre.org', 'nvd.nist.gov'];
const allOfficialHosts = new Set([...Object.values(automatedOfficialSourceHosts).flat(), ...supplementalHosts]);

function parsedOfficialUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash ||
        url.href !== value || url.pathname === '/' || !allOfficialHosts.has(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}
export function isAutomatedOfficialSourceUrl(value: string, vendor?: AutomatedAdvisoryVendor): boolean {
  const url = parsedOfficialUrl(value);
  return Boolean(url && (!vendor || (automatedOfficialSourceHosts[vendor] as readonly string[]).includes(url.hostname)));
}

// Only bounded, plain JSON is hashable: no coercion of dates, undefined, accessors, or non-finite numbers.
function canonicalJson(value: unknown, maxBytes: number = automatedAdvisoryLimits.releaseBytes): string {
  let nodes = 0, approximateBytes = 0;
  function visit(input: unknown, depth: number): string {
    if (++nodes > 50_000 || depth > 16) fail('JSON exceeds its node/depth limit.');
    if (input === null) return 'null';
    if (typeof input === 'boolean') return input ? 'true' : 'false';
    if (typeof input === 'number' && Number.isFinite(input)) return JSON.stringify(input);
    if (typeof input === 'string') {
      approximateBytes += Buffer.byteLength(input);
      if (approximateBytes > maxBytes) fail('JSON exceeds its byte limit.');
      return JSON.stringify(input);
    }
    if (!input || typeof input !== 'object') fail('Only plain JSON values are accepted.');
    if (Object.getOwnPropertySymbols(input).length) fail('JSON symbols are not accepted.');
    const descriptors = Object.getOwnPropertyDescriptors(input);
    if (Array.isArray(input)) {
      if (input.length > 50_000 || Object.keys(descriptors).length !== input.length + 1) fail('Invalid JSON array.');
      const entries: string[] = [];
      for (let i = 0; i < input.length; i++) {
        const property = descriptors[String(i)];
        if (!property?.enumerable || !('value' in property)) fail('Sparse/accessor arrays are not accepted.');
        entries.push(visit(property.value, depth + 1));
      }
      return `[${entries.join(',')}]`;
    }
    if (![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail('Only plain JSON objects are accepted.');
    return `{${Object.keys(descriptors).sort().map(key => {
      const property = descriptors[key];
      if (!property.enumerable || !('value' in property)) fail('Hidden/accessor fields are not accepted.');
      approximateBytes += Buffer.byteLength(key);
      if (approximateBytes > maxBytes) fail('JSON exceeds its byte limit.');
      return `${JSON.stringify(key)}:${visit(property.value, depth + 1)}`;
    }).join(',')}}`;
  }
  const json = visit(value, 0);
  if (Buffer.byteLength(json) > maxBytes) fail('JSON exceeds its byte limit.');
  return json;
}
export function automatedSha256(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}
export function automatedStableHash(value: unknown): string {
  return automatedSha256(canonicalJson(value));
}

const text = (max: number) => z.string().min(1).max(max).refine(value => value.trim() === value &&
  !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value), 'Use nonempty trimmed text without control characters.');
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const id = z.string().min(1).max(96).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const accountId = text(200).refine(value => !/\s/.test(value) && !/^(?:https?:|@)/i.test(value), 'Use the connected account ID, not a profile URL or handle.');
const timestamp = text(24).refine(value => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && [new Date(time).toISOString(), new Date(time).toISOString().replace('.000Z', 'Z')].includes(value);
}, 'Use a valid UTC timestamp.');
const officialUrl = text(2048).refine(value => isAutomatedOfficialSourceUrl(value), 'Use an exact approved official HTTPS source URL.');
const vendorSchema = z.enum(['Cisco', 'Fortinet', 'Palo Alto Networks', 'AWS', 'Microsoft', 'Juniper', 'F5',
  'Broadcom', 'VMware', 'Red Hat', 'Arista', 'Check Point', 'Google Cloud', 'Ubuntu']);
export type AutomatedChannel = 'linkedin' | 'facebook' | 'instagram';
const channels: readonly AutomatedChannel[] = ['linkedin', 'facebook', 'instagram'];
const assetSchema = z.strictObject({
  key: z.enum(['diagram', 'linkedin', 'reel']), path: text(300), sha256: hash,
  bytes: z.number().int().min(1).max(automatedAdvisoryLimits.assetBytes),
  mimeType: z.enum(['image/png', 'image/jpeg', 'video/mp4']),
  width: z.number().int().min(1).max(8192), height: z.number().int().min(1).max(8192),
  durationSeconds: z.number().min(3).max(90).optional(), alt: text(1000).min(20),
});
const socialSchema = z.strictObject({ accountId, caption: text(3000), assetKey: z.enum(['linkedin', 'reel']), captionSha256: hash });
const reconciliationSchema = z.strictObject({
  accountId, checkedAt: timestamp, historySince: timestamp, complete: z.literal(true),
  existingDelivery: z.literal(false), existingReservation: z.literal(false), evidenceSha256: hash,
});
const artifactSchema = z.strictObject({
  key: z.enum(['article', 'asset:diagram', 'asset:linkedin', 'asset:reel', 'caption:linkedin', 'caption:facebook', 'caption:instagram']),
  sha256: hash,
});
const releaseSchema = z.strictObject({
  schemaVersion: z.literal(automatedAdvisorySchemaVersion), activation: z.enum(['held', 'enabled']),
  releaseId: id, slug: id, externalId: text(200), vendor: vendorSchema,
  title: text(300), summary: text(3000), firstSeenAt: timestamp, notBefore: timestamp,
  vendorPublishedAt: timestamp, vendorUpdatedAt: timestamp,
  severity: z.enum(['critical', 'high', 'medium', 'low', 'informational', 'unknown']),
  cvssScore: z.number().min(0).max(10).nullable(), cves: z.array(z.string().regex(/^CVE-\d{4}-\d{4,12}$/)).max(32),
  products: z.array(text(300)).min(1).max(40), affectedVersions: z.array(text(1000)).max(80), fixedVersions: z.array(text(1000)).max(80),
  exploitationStatus: text(3000), mechanism: text(12000), affectedConditions: text(12000),
  remediation: text(12000), workaround: text(12000).nullable(), verification: text(12000), recovery: text(12000),
  limitations: z.array(text(3000)).min(1).max(32),
  definitions: z.array(z.strictObject({ term: text(120), definition: text(2000) })).max(32),
  sections: z.array(z.strictObject({ heading: text(200), body: text(12000), bullets: z.array(text(3000)).max(32).optional(),
    sourceUrls: z.array(officialUrl).min(1).max(12) })).min(1).max(20),
  sources: z.array(z.strictObject({ url: officialUrl, bodySha256: hash })).min(1).max(24),
  assets: z.array(assetSchema).length(3),
  social: z.strictObject({ linkedin: socialSchema, facebook: socialSchema, instagram: socialSchema }),
  nativeReconciliation: z.strictObject({ linkedin: reconciliationSchema, facebook: reconciliationSchema, instagram: reconciliationSchema }),
  independentReview: z.strictObject({
    authorAgentId: text(200), reviewerAgentId: text(200), verdict: z.literal('PASS'),
    authorshipOrRepairPerformed: z.literal(false), technicalPassed: z.literal(true), visualPassed: z.literal(true),
    reviewedAt: timestamp, candidateSha256: hash, artifactHashes: z.array(artifactSchema).length(7),
  }),
});
export type ApprovedAdvisoryRelease = DeepReadonly<z.infer<typeof releaseSchema>>;
export type AutomatedAdvisoryCandidate = Omit<ApprovedAdvisoryRelease, 'independentReview'>;
export type AutomatedAdvisoryAsset = ApprovedAdvisoryRelease['assets'][number];
export type AutomatedArtifactHash = ApprovedAdvisoryRelease['independentReview']['artifactHashes'][number];

const rechecksSchema = z.strictObject({
  sources: z.array(z.strictObject({ url: officialUrl, bodySha256: hash, checkedAt: timestamp })).min(1).max(24),
  review: z.strictObject({ checkedAt: timestamp, candidateSha256: hash, reviewSha256: hash }),
  accounts: z.strictObject({
    linkedin: z.strictObject({ accountId, kind: z.literal('member') }),
    facebook: z.strictObject({ accountId }), instagram: z.strictObject({ accountId }),
  }),
});
// These inputs must come from trusted server checks, never directly from request JSON.
// Receipt authenticity, actual media bytes, and native evidence provenance belong to the parent compiler.
export type AutomatedAdmissionRechecks = DeepReadonly<z.infer<typeof rechecksSchema>>;
export type AutomatedReleaseValidationOptions = {
  now?: Date | string;
  requireFresh?: boolean;
  runtime?: AutomatedAdmissionRechecks;
};

function candidateRecord(value: AutomatedAdvisoryCandidate | ApprovedAdvisoryRelease): Record<string, unknown> {
  const copy = JSON.parse(canonicalJson(value)) as Record<string, unknown>;
  delete copy.independentReview;
  return copy;
}
export function automatedCandidateHash(value: AutomatedAdvisoryCandidate | ApprovedAdvisoryRelease): string {
  return automatedStableHash(candidateRecord(value));
}
export function automatedArticleHash(value: AutomatedAdvisoryCandidate | ApprovedAdvisoryRelease): string {
  const article = candidateRecord(value);
  for (const key of ['assets', 'social', 'nativeReconciliation', 'activation']) delete article[key];
  return automatedStableHash(article);
}
export function automatedArtifactHashes(value: AutomatedAdvisoryCandidate | ApprovedAdvisoryRelease): readonly AutomatedArtifactHash[] {
  return freeze([
    { key: 'article' as const, sha256: automatedArticleHash(value) },
    ...value.assets.map(asset => ({ key: `asset:${asset.key}` as AutomatedArtifactHash['key'], sha256: asset.sha256 })),
    ...channels.map(channel => ({ key: `caption:${channel}` as AutomatedArtifactHash['key'], sha256: automatedSha256(value.social[channel].caption) })),
  ].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
export function automatedCanonicalUrl(slug: string): string {
  return `${automatedAdvisoryOrigin}/security-advisories/${id.parse(slug)}`;
}
function validateAsset(asset: AutomatedAdvisoryAsset, releaseId?: string): void {
  const extension = { 'image/png': 'png', 'image/jpeg': 'jpg', 'video/mp4': 'mp4' }[asset.mimeType];
  const match = /^\/automated-advisories\/([a-z0-9]+(?:-[a-z0-9]+)*)\/([a-f0-9]{64})\.(png|jpg|mp4)$/.exec(asset.path);
  if (!match || match[1].length > 96 || (releaseId && match[1] !== releaseId) || match[2] !== asset.sha256 || match[3] !== extension) fail('Invalid content-addressed asset path.');
  if (/^(?:(?:a|an|the) )?(?:diagram|image|graphic|poster|reel|placeholder|todo)[ .:-]*$/i.test(asset.alt)) fail('Meaningful asset alt text is required.');
  if (asset.key === 'reel') {
    if (asset.mimeType !== 'video/mp4' || asset.width !== 1080 || asset.height !== 1920 || asset.durationSeconds === undefined) fail('Reel must be 1080x1920 MP4, 3-90 seconds.');
  } else if (asset.mimeType === 'video/mp4' || asset.durationSeconds !== undefined) fail('Diagram and LinkedIn assets must be still images.');
}
export function automatedAssetUrl(asset: AutomatedAdvisoryAsset): string {
  const parsed = assetSchema.parse(JSON.parse(canonicalJson(asset)));
  validateAsset(parsed);
  return automatedAdvisoryOrigin + parsed.path;
}

export type AutomatedFamilyIdentity = { slug?: string; externalId?: string; cves?: unknown; sourceUrl?: string; sourceURL?: string };
const reservedCves = ['CVE-2026-111497', 'CVE-2026-105482', 'CVE-2026-105483', 'CVE-2026-106069'];
const normalize = (value: string | undefined) => value?.trim().toLowerCase();
function sourceIdentity(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return `${url.origin}${decodeURIComponent(url.pathname).replace(/\/$/, '')}`.toLowerCase();
  } catch {
    return undefined;
  }
}
function isReservedCiscoFamily(value: AutomatedFamilyIdentity): boolean {
  return [value.slug, value.externalId, sourceIdentity(value.sourceUrl || value.sourceURL)]
    .some(part => normalize(part)?.includes('cisco-sa-oct2026-node-js')) ||
    Array.isArray(value.cves) && value.cves.some(cve => typeof cve === 'string' && reservedCves.includes(cve.trim().toUpperCase()));
}
function unique(values: readonly string[], label: string): void {
  if (new Set(values.map(value => value.toLowerCase())).size !== values.length) fail(`Duplicate ${label}.`);
}
function nowMilliseconds(now?: Date | string): number {
  const time = now instanceof Date ? now.getTime() : now === undefined ? Date.now() : Date.parse(timestamp.parse(now));
  if (!Number.isFinite(time)) fail('Invalid validation clock.');
  return time;
}
function past(value: string, now: number, name: string): number {
  const time = Date.parse(value);
  if (time > now) fail(`${name} is future-dated.`);
  return time;
}
function fresh(value: string, now: number, maxAge: number, name: string): number {
  const time = past(value, now, name);
  if (now - time > maxAge) fail(`${name} is stale.`);
  return time;
}
function publicUrls(value: string): string[] {
  return (value.match(/https?:\/\/[^\s<>"'`]+/gi) || []).map(url => url.replace(/[.,;:!?)\]}]+$/, ''));
}
const processStamp = /\bCodex\b|\b(?:AI|LLM)[ -](?:generated|authored|written|reviewed|assisted)\b|\b(?:generated|written|reviewed|created|produced)\s+(?:by|with|using)\s+(?:AI|Codex|ChatGPT|OpenAI)\b|\b(?:token (?:budget|cost|usage)|API cost|generation cost|no[- ]paid|zero[- ]cost|no[- ]cost)\b|\b(?:author|reviewer)[ _-]?agent(?:[ _-]?id)?\s*[:=]|\b(?:independent|technical|visual) review\s*[:=-]?\s*PASS\b/i;
function assertPublicCopy(value: string, canonical: string, sourceUrls: ReadonlySet<string>): void {
  if (processStamp.test(value)) fail('Public copy contains an internal authorship/review/cost stamp.');
  if (/\b(?:javascript|data|file|ftp):/i.test(value)) fail('Public copy contains an unsafe URL scheme.');
  for (const url of publicUrls(value)) if (url !== canonical && !sourceUrls.has(url)) fail('Public copy contains an unbound or untrusted URL.');
}

export function validateRelease(value: unknown, options: AutomatedReleaseValidationOptions = {}): ApprovedAdvisoryRelease {
  const release = releaseSchema.parse(JSON.parse(canonicalJson(value)));
  const now = nowMilliseconds(options.now), firstSeen = past(release.firstSeenAt, now, 'firstSeenAt');
  if (firstSeen <= Date.parse(automatedFirstSeenAfter)) fail('firstSeenAt must be strictly after the prospective cutoff.');
  const published = past(release.vendorPublishedAt, now, 'vendorPublishedAt');
  const updated = past(release.vendorUpdatedAt, now, 'vendorUpdatedAt');
  if (updated < published || Date.parse(release.notBefore) < firstSeen) fail('Invalid vendor/notBefore chronology.');
  const reviewed = past(release.independentReview.reviewedAt, now, 'reviewedAt');
  if (reviewed < Math.max(firstSeen, updated)) fail('Review predates the candidate/source revision.');
  if (normalize(release.independentReview.authorAgentId) === normalize(release.independentReview.reviewerAgentId)) fail('Self-review is not independent.');
  if (isReservedCiscoFamily(release) || release.sources.some(source => isReservedCiscoFamily({ sourceUrl: source.url }))) fail('The pinned Cisco family is outside automated scope.');
  if (!isAutomatedOfficialSourceUrl(release.sources[0].url, release.vendor)) fail('sources[0] must be the primary vendor body, not CVE/KEV metadata.');
  unique(release.cves, 'CVEs');
  if (release.cves.some(cve => Number(cve.slice(4, 8)) > new Date(now).getUTCFullYear())) fail('A CVE year is in the future.');
  unique(release.sources.map(source => source.url), 'sources');
  unique(release.assets.map(asset => asset.key), 'asset keys');
  unique(release.definitions.map(definition => definition.term), 'definitions');
  for (const asset of release.assets) validateAsset(asset, release.releaseId);
  if (!['diagram', 'linkedin', 'reel'].every(key => release.assets.some(asset => asset.key === key))) fail('All three media variants are required.');
  const sourceUrls = new Set(release.sources.map(source => source.url)), canonical = automatedCanonicalUrl(release.slug);
  for (const section of release.sections) {
    unique(section.sourceUrls, 'section sources');
    if (section.sourceUrls.some(url => !sourceUrls.has(url))) fail('Section citations must bind declared source bodies.');
  }
  const copy = [release.vendor, release.title, release.summary, release.exploitationStatus, release.mechanism,
    release.affectedConditions, release.remediation, release.workaround || '', release.verification, release.recovery,
    ...release.products, ...release.affectedVersions, ...release.fixedVersions, ...release.limitations,
    ...release.definitions.flatMap(definition => [definition.term, definition.definition]),
    ...release.sections.flatMap(section => [section.heading, section.body, ...(section.bullets || [])]),
    ...release.assets.map(asset => asset.alt)];
  for (const content of copy) assertPublicCopy(content, canonical, sourceUrls);
  for (const channel of channels) {
    const social = release.social[channel], reconciliation = release.nativeReconciliation[channel];
    const expectedAccount = channel === 'facebook' ? '428759466975905' : channel === 'instagram' ? '17841468939564779' : social.accountId;
    if (social.accountId !== expectedAccount || reconciliation.accountId !== social.accountId) fail(`${channel} account binding changed.`);
    if (social.assetKey !== (channel === 'linkedin' ? 'linkedin' : 'reel')) fail(`${channel} has the wrong media variant.`);
    if (social.caption.length > (channel === 'linkedin' ? 3000 : 2200)) fail(`${channel} caption exceeds its limit.`);
    if (new Set((social.caption.match(/#[A-Za-z][A-Za-z0-9_]*/g) || []).map(tag => tag.toLowerCase())).size < 5) fail(`${channel} needs five distinct hashtags.`);
    if (!publicUrls(social.caption).includes(canonical)) fail(`${channel} must include the exact QCS canonical URL.`);
    if (automatedSha256(social.caption) !== social.captionSha256) fail(`${channel} caption hash changed.`);
    assertPublicCopy(social.caption, canonical, sourceUrls);
    if (channel === 'instagram' && (!/\b(?:caption (?:urls?|links?)|(?:urls?|links?) in (?:the |this |instagram )?caption)\b[\s\S]{0,80}\b(?:not clickable|non-clickable)\b/i.test(social.caption) ||
        /\b(?:links?|urls?)\s+(?:is\s+|are\s+)?in\s+(?:(?:our|the|my|your|instagram)\s+)?bio\b|\b(?:visit|check|see|open|tap|click|go to)\b.{0,40}\bbio\b|\b(?:click|tap)\s+(?:on\s+)?(?:(?:the|this)\s+)?(?:caption\s+)?(?:link|url)\b/i.test(social.caption))) fail('Instagram must state caption nonclickability without an invented bio/click claim.');
    const checked = past(reconciliation.checkedAt, now, `${channel} reconciliation`);
    const historySince = past(reconciliation.historySince, now, `${channel} historySince`);
    if (checked < Math.max(firstSeen, updated) || checked > reviewed || historySince > Math.min(firstSeen, published)) fail(`${channel} reconciliation does not cover the family lifetime before review.`);
  }
  if (automatedCandidateHash(release) !== release.independentReview.candidateSha256) fail('Whole-candidate review hash changed.');
  unique(release.independentReview.artifactHashes.map(artifact => artifact.key), 'review artifact keys');
  const artifacts = new Map(release.independentReview.artifactHashes.map(artifact => [artifact.key, artifact.sha256]));
  if (automatedArtifactHashes(release).some(artifact => artifacts.get(artifact.key) !== artifact.sha256)) fail('Review must bind the article, all captions, and all media.');

  // Read validation deliberately has no age expiry. Only admission is time-limited and requires server rechecks.
  if (options.requireFresh) {
    if (release.activation !== 'enabled') fail('Release activation is held.');
    if (Date.parse(release.notBefore) > now) fail('Release is not due yet.');
    fresh(release.vendorUpdatedAt, now, automatedAdvisoryLimits.vendorUpdateAgeMs, 'Vendor update');
    fresh(release.independentReview.reviewedAt, now, automatedAdvisoryLimits.reviewAgeMs, 'Independent review');
    for (const channel of channels) fresh(release.nativeReconciliation[channel].checkedAt, now, automatedAdvisoryLimits.reconciliationAgeMs, `${channel} reconciliation`);
    if (!options.runtime) fail('Admission requires trusted server source/review rechecks and connected accounts.');
    const runtime = rechecksSchema.parse(JSON.parse(canonicalJson(options.runtime)));
    unique(runtime.sources.map(source => source.url), 'source rechecks');
    if (runtime.sources.length !== release.sources.length) fail('Every exact source URL needs a body-hash recheck.');
    for (const source of release.sources) {
      const observed = runtime.sources.find(item => item.url === source.url);
      if (!observed || observed.bodySha256 !== source.bodySha256) fail('Exact source URL/body hash changed; a new review is required.');
      if (fresh(observed.checkedAt, now, automatedAdvisoryLimits.sourceAgeMs, 'Source recheck') < reviewed) fail('Source recheck predates independent review.');
    }
    if (runtime.review.candidateSha256 !== release.independentReview.candidateSha256 || runtime.review.reviewSha256 !== automatedStableHash(release.independentReview)) fail('External review recheck does not bind the exact receipt and candidate.');
    if (fresh(runtime.review.checkedAt, now, automatedAdvisoryLimits.reviewAgeMs, 'Review recheck') < reviewed) fail('Review recheck predates the receipt.');
    for (const channel of channels) if (runtime.accounts[channel].accountId !== release.social[channel].accountId) fail(`${channel} server connection does not match the release member/account binding.`);
  }
  return freeze(release);
}

const catalogSchema = z.strictObject({ schemaVersion: z.literal(1), activation: z.enum(['held', 'enabled']), releases: z.array(z.unknown()).max(automatedAdvisoryLimits.catalogReleases) });
export type AutomatedReleaseCatalog = DeepReadonly<{ schemaVersion: 1; activation: 'held' | 'enabled'; releases: ApprovedAdvisoryRelease[] }>;
function sameFamily(value: AutomatedFamilyIdentity, release: ApprovedAdvisoryRelease): boolean {
  return normalize(value.slug) === normalize(release.slug) || normalize(value.externalId) === normalize(release.externalId) ||
    Array.isArray(value.cves) && value.cves.some(cve => typeof cve === 'string' && release.cves.some(known => normalize(known) === normalize(cve))) ||
    Boolean(sourceIdentity(value.sourceUrl || value.sourceURL) && release.sources.some(source => sourceIdentity(source.url) === sourceIdentity(value.sourceUrl || value.sourceURL)));
}
export function matchesAutomatedFamily(value:AutomatedFamilyIdentity,release:ApprovedAdvisoryRelease){return sameFamily(value,release);}
function exclusionFor(releases: readonly ApprovedAdvisoryRelease[]): Prisma.SecurityAdvisoryWhereInput {
  const families: Prisma.SecurityAdvisoryWhereInput[] = [];
  for (const release of releases) {
    families.push({ slug: { equals: release.slug, mode: 'insensitive' } }, { externalId: { equals: release.externalId, mode: 'insensitive' } });
    for (const source of release.sources) families.push({ sourceUrl: { startsWith: sourceIdentity(source.url), mode: 'insensitive' } });
    // Prisma JSON containment is case-sensitive, unlike identity matching.
    for (const cve of release.cves) for (const prefix of ['CVE', 'CVe', 'CvE', 'Cve', 'cVE', 'cVe', 'cvE', 'cve']) families.push({ cves: { array_contains: [prefix + cve.slice(3)] } });
  }
  // Conservative source prefixes can over-exclude aliases; they never authorize a publication.
  return families.length ? { NOT: { OR: families } } : {};
}

/** Immutable metadata only. It cannot attest receipt authenticity or authorize live publishing. */
export function createAutomatedAdvisoryRegistry(input: unknown) {
  const snapshot = freeze(JSON.parse(canonicalJson(input, automatedAdvisoryLimits.catalogBytes)) as unknown);
  function getCatalog(options: AutomatedReleaseValidationOptions = {}): AutomatedReleaseCatalog {
    const parsed = catalogSchema.parse(snapshot);
    if (options.requireFresh && parsed.activation !== 'enabled') fail('Catalog activation is held.');
    const releases = parsed.releases.map(release => validateRelease(release, options));
    unique(releases.map(release => release.releaseId), 'catalog release IDs');
    for (let i = 0; i < releases.length; i++) for (let j = 0; j < i; j++) {
      if (sameFamily(releases[i], releases[j]) || releases[i].sources.some(source => sameFamily({ sourceUrl: source.url }, releases[j]))) fail('Catalog has overlapping advisory families.');
    }
    return freeze({ schemaVersion: 1 as const, activation: parsed.activation, releases });
  }
  getCatalog();
  return Object.freeze({
    getCatalog,
    getAutomatedReleases: (options: AutomatedReleaseValidationOptions = {}) => getCatalog(options).releases,
    automatedReleaseBySlug: (slug: string, options: AutomatedReleaseValidationOptions = {}) => {
      const current = getCatalog(), release = current.releases.find(item => item.slug === slug);
      if (!release) return null;
      if (options.requireFresh && current.activation !== 'enabled') fail('Catalog activation is held.');
      return validateRelease(release, options);
    },
    isAutomatedFamily: (identity: AutomatedFamilyIdentity) => getCatalog().releases.some(release => sameFamily(identity, release)),
    catalogExclusionPrismaWhere: () => exclusionFor(getCatalog().releases),
  });
}
const registry = createAutomatedAdvisoryRegistry(catalog);
export const getAutomatedReleaseCatalog = registry.getCatalog;
export const getAutomatedReleases = registry.getAutomatedReleases;
export const automatedReleaseBySlug = registry.automatedReleaseBySlug;
export const isAutomatedFamily = registry.isAutomatedFamily;
export const catalogExclusionPrismaWhere = registry.catalogExclusionPrismaWhere;
