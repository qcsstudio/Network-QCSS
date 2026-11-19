import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  automatedAdvisoryLimits, automatedAdvisoryOrigin, automatedArtifactHashes, automatedArticleHash,
  automatedAssetUrl, automatedCandidateHash, automatedCanonicalUrl, automatedFirstSeenAfter,
  automatedReleaseBySlug, automatedSha256, automatedStableHash, catalogExclusionPrismaWhere,
  createAutomatedAdvisoryRegistry, getAutomatedReleaseCatalog, getAutomatedReleases,
  isAutomatedFamily, isAutomatedOfficialSourceUrl, validateRelease,
} from '../src/lib/automated-advisory-domain.ts';
import {
  bindSyntheticRelease as rebind, syntheticMediaBytes, syntheticRelease, syntheticRuntime,
  syntheticSourceBody, syntheticSourceUrl as sourceUrl,
} from './helpers/automated-release-fixture.mjs';

// SYNTHETIC ONLY. No source fetch, actual media, genuine independent review, or publish approval.
// Hash consistency in these fixtures is deliberately NOT evidence of external receipt authenticity.
const now = new Date('2026-11-19T12:45:00Z');
const clone = value => structuredClone(value);
const hex = value => automatedSha256(`SYNTHETIC ${value}`);
const fixture = () => syntheticRelease({ now });
const runtime = (release, checkedAt = now.toISOString()) => syntheticRuntime(release, { now: checkedAt });
const admit = (release, options = {}) => validateRelease(release, { now, requireFresh: true, runtime: runtime(release), ...options });
function rejectedMutation(mutate, pattern) {
  const release = fixture();
  mutate(release);
  rebind(release);
  assert.throws(() => admit(release), pattern);
}

test('genuine catalog is empty and held; it contains no synthetic approval', () => {
  assert.deepEqual(JSON.parse(readFileSync(new URL('../src/content/automated-advisory-releases.json', import.meta.url), 'utf8')),
    { schemaVersion: 1, activation: 'held', releases: [] });
  assert.deepEqual(getAutomatedReleases(), []);
  assert.equal(getAutomatedReleaseCatalog().activation, 'held');
  assert.equal(automatedReleaseBySlug('synthetic-domain-test'), null);
  assert.equal(isAutomatedFamily({ cves: ['CVE-2026-9999999'] }), false);
  assert.deepEqual(catalogExclusionPrismaWhere(), {});
  assert.throws(() => getAutomatedReleases({ requireFresh: true }), /held/);
});

test('synthetic consistency passes read/admission without claiming a genuine review', () => {
  const release = fixture(), validated = admit(release);
  assert.deepEqual(validated, release);
  assert.ok(Object.isFrozen(validated) && Object.isFrozen(validated.social.instagram) && Object.isFrozen(validated.assets));
  assert.throws(() => { validated.title = 'tamper'; }, TypeError);
  assert.equal(automatedArtifactHashes(release).length, 7);
});

test('shared worker fixture exposes byte-consistent synthetic source/media mocks without registering a release', () => {
  const release = fixture();
  assert.equal(release.sources[0].bodySha256, automatedSha256(syntheticSourceBody));
  for (const asset of release.assets) {
    const bytes = syntheticMediaBytes(asset.key);
    assert.equal(asset.sha256, automatedSha256(bytes));
    assert.equal(asset.bytes, bytes.length);
  }
  assert.equal(automatedAdvisoryLimits.sourceBodyBytes, 4 * 1024 * 1024);
  assert.equal(getAutomatedReleases().length, 0);
});

test('read has no 24-hour expiry; admission does, and supports an explicit validation clock', () => {
  const release = fixture(), later = new Date('2026-11-21T12:45:00Z');
  assert.equal(validateRelease(release, { now: later }).releaseId, release.releaseId);
  assert.throws(() => admit(release, { now: later }), /stale/);
  assert.doesNotThrow(() => admit(release, { now: now.toISOString() }));
  assert.throws(() => admit(release, { now: new Date(NaN) }), /clock/);
});

test('source/review runtime checks are mandatory, exact, complete, and no more than 24 hours old', () => {
  const release = fixture();
  assert.throws(() => validateRelease(release, { now, requireFresh: true }), /trusted server/);
  for (const mutate of [
    checks => { checks.sources = []; },
    checks => { checks.sources[0].url += '-different'; },
    checks => { checks.sources[0].bodySha256 = hex('changed body'); },
    checks => { checks.sources.push(clone(checks.sources[0])); },
    checks => { checks.sources[0].checkedAt = '2026-11-18T12:44:59Z'; },
    checks => { checks.sources[0].checkedAt = '2026-11-19T12:45:01Z'; },
    checks => { checks.sources[0].checkedAt = '2026-11-19T12:42:59Z'; },
    checks => { checks.review.reviewSha256 = hex('different receipt'); },
    checks => { checks.review.candidateSha256 = hex('different candidate'); },
    checks => { checks.review.checkedAt = '2026-11-18T12:44:59Z'; },
    checks => { checks.review.checkedAt = '2026-11-19T12:45:01Z'; },
    checks => { checks.review.checkedAt = '2026-11-19T12:42:59Z'; },
  ]) {
    const checks = runtime(release); mutate(checks);
    assert.throws(() => admit(release, { runtime: checks }));
  }
});

test('all source bodies need rechecks, not just primary metadata or matching timestamps', () => {
  const release = fixture();
  release.sources.push({ url: 'https://nvd.nist.gov/vuln/detail/CVE-2026-9999999', bodySha256: hex('synthetic metadata') });
  rebind(release);
  assert.doesNotThrow(() => admit(release));
  const checks = runtime(release); checks.sources.pop();
  assert.throws(() => admit(release, { runtime: checks }), /Every exact source/);
  rejectedMutation(r => { r.sources.unshift({ url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', bodySha256: hex('KEV') }); }, /primary vendor body/);
  rejectedMutation(r => { r.vendor = 'Cisco'; }, /primary vendor body/);
});

test('only prospective discovery is allowed, never clearance of a previously delivered family', () => {
  rejectedMutation(r => { r.firstSeenAt = automatedFirstSeenAfter; }, /strictly after/);
  rejectedMutation(r => { r.firstSeenAt = '2026-11-19T12:34:09Z'; }, /strictly after/);
  for (const channel of ['linkedin', 'facebook', 'instagram']) {
    rejectedMutation(r => { r.nativeReconciliation[channel].existingDelivery = true; });
    rejectedMutation(r => { r.nativeReconciliation[channel].existingReservation = true; });
    rejectedMutation(r => { r.nativeReconciliation[channel].complete = false; });
    rejectedMutation(r => { r.nativeReconciliation[channel].historySince = r.firstSeenAt; }, /family lifetime/);
    rejectedMutation(r => { r.nativeReconciliation[channel].checkedAt = '2026-11-19T12:45:01Z'; }, /future/);
    rejectedMutation(r => { r.nativeReconciliation[channel].accountId = 'other-account'; }, /account binding/);
    rejectedMutation(r => { r.nativeReconciliation[channel].evidenceSha256 = ''; });
  }
});

test('native reconciliation is candidate-bound and fresh to 15 minutes on all channels', () => {
  for (const channel of ['linkedin', 'facebook', 'instagram']) {
    const release = fixture();
    release.nativeReconciliation[channel].checkedAt = '2026-11-19T12:35:00Z';
    rebind(release);
    assert.doesNotThrow(() => admit(release, { now: '2026-11-19T12:50:00Z', runtime: runtime(release, '2026-11-19T12:50:00Z') }));
    assert.throws(() => admit(release, { now: '2026-11-19T12:50:00.001Z', runtime: runtime(release, '2026-11-19T12:50:00.001Z') }), /stale/);
    const tampered = fixture(); tampered.nativeReconciliation[channel].evidenceSha256 = hex('changed native evidence');
    assert.throws(() => admit(tampered), /candidate/);
  }
});

test('known Meta accounts and a real connected LinkedIn member binding are required, not guessed numeric IDs', () => {
  assert.doesNotThrow(() => admit(fixture()));
  rejectedMutation(r => { r.social.facebook.accountId = r.nativeReconciliation.facebook.accountId = 'wrong-page'; }, /account binding/);
  rejectedMutation(r => { r.social.instagram.accountId = r.nativeReconciliation.instagram.accountId = '@qcsstudio'; });
  rejectedMutation(r => { r.social.linkedin.accountId = r.nativeReconciliation.linkedin.accountId = 'https://www.linkedin.com/in/synthetic/'; });
  rejectedMutation(r => { r.social.linkedin.accountId = r.nativeReconciliation.linkedin.accountId = ''; });
  for (const channel of ['linkedin', 'facebook', 'instagram']) {
    const release = fixture(), checks = runtime(release); checks.accounts[channel].accountId = 'other-connection';
    assert.throws(() => admit(release, { runtime: checks }), /server connection/);
  }
  const release = fixture(), checks = runtime(release); checks.accounts.linkedin.kind = 'organization';
  assert.throws(() => admit(release, { runtime: checks }));
});

test('pinned Cisco CVEs, aliases, and source URL are never admitted', () => {
  for (const cve of ['CVE-2026-111497', 'CVE-2026-105482', 'CVE-2026-105483', 'CVE-2026-106069']) rejectedMutation(r => { r.cves = [cve]; }, /pinned Cisco/);
  rejectedMutation(r => { r.slug = 'cisco-cisco-sa-oct2026-node-js-jj3sq19u'; }, /pinned Cisco/);
  rejectedMutation(r => { r.externalId = 'CISCO-SA-OCT2026-NODE-JS-JJ3SQ19U'; }, /pinned Cisco/);
  rejectedMutation(r => { r.sources.push({ url: 'https://sec.cloudapps.cisco.com/security/center/content/CiscoSecurityAdvisory/cisco-sa-oct2026-node-js-Jj3SQ19u', bodySha256: hex('reserved') }); }, /pinned Cisco/);
});

test('timestamps are real, nonfuture, chronological; notBefore and vendor-update age gate only admission', () => {
  for (const field of ['firstSeenAt', 'vendorPublishedAt', 'vendorUpdatedAt']) rejectedMutation(r => { r[field] = '2026-11-19T12:45:01Z'; }, /future/);
  rejectedMutation(r => { r.vendorPublishedAt = '2026-02-30T00:00:00Z'; });
  rejectedMutation(r => { r.independentReview.reviewedAt = '2026-11-19T12:45:01Z'; }, /future/);
  rejectedMutation(r => { r.vendorUpdatedAt = '2026-11-19T10:00:00Z'; }, /chronology/);
  rejectedMutation(r => { r.cves = ['CVE-2027-12345']; }, /future/);
  const due = fixture(); due.notBefore = '2026-11-20T00:00:00Z'; rebind(due);
  assert.doesNotThrow(() => validateRelease(due, { now }));
  assert.throws(() => admit(due), /not due/);
  const stale = fixture(); stale.vendorPublishedAt = stale.vendorUpdatedAt = '2026-11-16T12:44:59Z'; rebind(stale);
  assert.doesNotThrow(() => validateRelease(stale, { now }));
  assert.throws(() => admit(stale), /Vendor update is stale/);
  stale.vendorPublishedAt = stale.vendorUpdatedAt = '2026-11-16T12:45:00Z'; rebind(stale);
  assert.doesNotThrow(() => admit(stale));
});

test('allowlisted URLs are exact HTTPS hosts, without userinfo, ports, fragments, or normalization tricks', () => {
  assert.equal(isAutomatedOfficialSourceUrl(sourceUrl, 'Fortinet'), true);
  assert.equal(isAutomatedOfficialSourceUrl('https://security.paloaltonetworks.com/CVE-2026-9999999', 'Palo Alto Networks'), true);
  assert.equal(isAutomatedOfficialSourceUrl('https://aws.amazon.com/security/security-bulletins/synthetic', 'AWS'), true);
  for (const url of ['http://www.fortiguard.com/psirt/synthetic', 'https://www.fortiguard.com.evil.test/psirt/synthetic',
    'https://evil.test@www.fortiguard.com/psirt/synthetic', 'https://www.fortiguard.com:443/psirt/synthetic',
    `${sourceUrl}#fragment`, 'https://www.fortiguard.com/a/../psirt/synthetic', 'https://127.0.0.1/source',
    'https://arbitrary.fortinet.com/source', 'https://www.fortiguard.com/']) assert.equal(isAutomatedOfficialSourceUrl(url), false, url);
  rejectedMutation(r => { r.sections[0].sourceUrls = ['https://www.fortiguard.com/psirt/not-declared']; }, /citations/);
  rejectedMutation(r => { r.sections[0].body += ' https://evil.test/source'; }, /unbound or untrusted/);
});

test('hashes are stable by object-key order but bind every article/caption/account/media/reconciliation field', () => {
  assert.equal(automatedStableHash({ b: 2, a: 1 }), automatedStableHash({ a: 1, b: 2 }));
  assert.equal(automatedStableHash({ a: 1, b: 2 }), createHash('sha256').update('{"a":1,"b":2}').digest('hex'));
  assert.notEqual(automatedStableHash([1, 2]), automatedStableHash([2, 1]));
  const release = fixture(), receiptOnly = clone(release); receiptOnly.independentReview.reviewerAgentId = 'another-synthetic-reviewer';
  assert.equal(automatedCandidateHash(release), automatedCandidateHash(receiptOnly));
  for (const mutate of [
    r => { r.title += ' changed'; }, r => { r.sections[0].body += ' changed'; },
    r => { r.social.facebook.caption += ' changed'; }, r => { r.social.instagram.caption += ' changed'; },
    r => { r.social.linkedin.caption += ' changed'; }, r => { r.social.linkedin.accountId = 'changed'; },
    r => { r.assets[0].alt += ' changed'; }, r => { r.assets[2].bytes++; },
    r => { r.sources[0].bodySha256 = hex('changed'); }, r => { r.nativeReconciliation.facebook.historySince = '2026-10-01T00:00:00Z'; },
  ]) {
    const changed = clone(release); mutate(changed);
    assert.notEqual(automatedCandidateHash(changed), automatedCandidateHash(release));
    assert.throws(() => admit(changed));
  }
  assert.equal(automatedArticleHash(release), automatedArticleHash(receiptOnly));
});

test('independent review cannot be self-authored, incomplete, repaired, or caption-blind', () => {
  for (const mutate of [
    r => { r.independentReview.authorAgentId = r.independentReview.reviewerAgentId; },
    r => { r.independentReview.reviewerAgentId = r.independentReview.authorAgentId.toUpperCase(); },
    r => { r.independentReview.authorshipOrRepairPerformed = true; },
    r => { r.independentReview.verdict = 'FAIL'; }, r => { r.independentReview.technicalPassed = false; },
    r => { r.independentReview.visualPassed = false; }, r => { delete r.independentReview; },
    r => { r.independentReview.artifactHashes = r.independentReview.artifactHashes.filter(a => a.key !== 'caption:instagram'); },
    r => { r.independentReview.artifactHashes.find(a => a.key === 'caption:facebook').sha256 = hex('unreviewed caption'); },
    r => { r.independentReview.artifactHashes[0] = clone(r.independentReview.artifactHashes[1]); },
    r => { r.independentReview.candidateSha256 = hex('different whole candidate'); },
  ]) { const release = fixture(); mutate(release); assert.throws(() => admit(release)); }
});

test('caption limits, five case-insensitively distinct hashtags, exact canonical and truthful Instagram copy', () => {
  for (const channel of ['linkedin', 'facebook', 'instagram']) {
    rejectedMutation(r => { r.social[channel].caption += 'x'.repeat(channel === 'linkedin' ? 3000 : 2200); });
    rejectedMutation(r => { r.social[channel].caption = r.social[channel].caption.replace('#Security #Networking #Patching #Advisory #QCSStudio', '#Security #SECURITY #security #Security #Security'); }, /five distinct/);
    rejectedMutation(r => { r.social[channel].caption = r.social[channel].caption.replace(automatedCanonicalUrl(r.slug), `${automatedCanonicalUrl(r.slug)}?fake=true`); }, /exact QCS/);
  }
  rejectedMutation(r => { r.social.instagram.caption = r.social.facebook.caption; }, /nonclickability/);
  rejectedMutation(r => { r.social.instagram.caption += ' Link in bio.'; }, /invented bio/);
  rejectedMutation(r => { r.social.instagram.caption += ' Tap the caption link.'; }, /invented bio/);
  const release = fixture(); release.social.facebook.captionSha256 = hex('wrong caption');
  assert.throws(() => admit(release), /caption hash/);
});

test('security AI topics and source-backed unknowns are allowed, internal process/cost stamps are not', () => {
  const release = fixture(); release.title = 'Synthetic AI service vulnerability';
  release.sections[0].body = 'AI security risk remains unknown in the synthetic vendor source. Do not infer a safe appliance rule.';
  rebind(release); assert.doesNotThrow(() => admit(release));
  for (const stamp of ['AI-generated report', 'Generated by AI', 'Codex reviewed this', 'API cost: zero', 'Independent review: PASS', 'reviewerAgentId: hidden']) rejectedMutation(r => { r.summary = stamp; }, /stamp/);
});

test('assets are hash-addressed under the sole QCS origin, with strict media and reel bounds', () => {
  const release = fixture();
  for (const asset of release.assets) assert.equal(automatedAssetUrl(asset), automatedAdvisoryOrigin + asset.path);
  for (const mutate of [
    r => { r.assets[0].path = 'https://evil.test/asset.png'; }, r => { r.assets[0].path = r.assets[0].path.replace(r.releaseId, 'different-release'); },
    r => { r.assets[0].path += '?q=1'; }, r => { r.assets[0].path = r.assets[0].path.replace('.png', '.svg'); },
    r => { r.assets[0].sha256 = hex('different bytes'); }, r => { r.assets[0].bytes = automatedAdvisoryLimits.assetBytes + 1; },
    r => { r.assets[0].alt = ''; }, r => { r.assets[0].width = 0; }, r => { r.assets[0].durationSeconds = 3; },
    r => { r.assets[2].width = 1920; }, r => { r.assets[2].height = 1080; }, r => { r.assets[2].durationSeconds = 2.999; },
    r => { r.assets[2].durationSeconds = 90.001; }, r => { delete r.assets[2].durationSeconds; },
    r => { r.social.facebook.assetKey = 'linkedin'; }, r => { r.social.linkedin.assetKey = 'reel'; },
  ]) rejectedMutation(mutate);
  for (const seconds of [3, 90]) { const r = fixture(); r.assets[2].durationSeconds = seconds; rebind(r); assert.doesNotThrow(() => admit(r)); }
});

function matches(row, where) {
  return Object.entries(where).every(([key, value]) => {
    if (key === 'NOT') return !matches(row, value);
    if (key === 'OR') return value.some(item => matches(row, item));
    if (value.array_contains) return value.array_contains.every(item => row[key]?.includes(item));
    const actual = String(row[key] || '').toLowerCase();
    return value.equals ? actual === value.equals.toLowerCase() : actual.startsWith(value.startsWith.toLowerCase());
  });
}
test('immutable catalog matches identity aliases, never the entire vendor/time range, and excludes Prisma families', () => {
  const release = fixture(), input = { schemaVersion: 1, activation: 'enabled', releases: [release] };
  const registry = createAutomatedAdvisoryRegistry(input);
  input.releases[0].title = 'outside mutation'; input.releases.length = 0;
  assert.equal(registry.automatedReleaseBySlug(release.slug).title, 'Synthetic advisory fixture');
  assert.ok(Object.isFrozen(registry.getAutomatedReleases()));
  for (const identity of [{ slug: release.slug.toUpperCase() }, { externalId: release.externalId.toLowerCase() },
    { sourceURL: sourceUrl + '?utm_source=test#fragment' }, { sourceUrl: sourceUrl.toUpperCase() }]) assert.equal(registry.isAutomatedFamily(identity), true);
  for (const prefix of ['CVE', 'CVe', 'CvE', 'Cve', 'cVE', 'cVe', 'cvE', 'cve']) {
    const row = { cves: [prefix + release.cves[0].slice(3)] };
    assert.equal(registry.isAutomatedFamily(row), true);
    assert.equal(matches(row, registry.catalogExclusionPrismaWhere()), false);
  }
  for (const row of [{ slug: release.slug }, { externalId: release.externalId }, { sourceUrl: sourceUrl + '?alias=1' }]) assert.equal(matches(row, registry.catalogExclusionPrismaWhere()), false);
  const unrelated = { slug: 'ordinary-advisory', externalId: 'different', cves: [], sourceUrl: 'https://www.fortiguard.com/psirt/ordinary' };
  assert.equal(registry.isAutomatedFamily(unrelated), false);
  assert.equal(matches(unrelated, registry.catalogExclusionPrismaWhere()), true);
  assert.equal(registry.isAutomatedFamily({ cves: ['CVE-2026-111497'] }), false);
});

test('held catalogs/releases stay held; overlapping families and duplicate identities cannot enter the registry', () => {
  const release = fixture();
  const held = createAutomatedAdvisoryRegistry({ schemaVersion: 1, activation: 'held', releases: [release] });
  assert.equal(held.getAutomatedReleases().length, 1);
  assert.throws(() => held.automatedReleaseBySlug(release.slug, { now, requireFresh: true, runtime: runtime(release) }), /held/);
  release.activation = 'held'; rebind(release);
  assert.doesNotThrow(() => validateRelease(release, { now }));
  assert.throws(() => admit(release), /held/);
  assert.throws(() => createAutomatedAdvisoryRegistry({ schemaVersion: 1, activation: 'enabled', releases: [fixture(), fixture()] }), /Duplicate/);
  const first = fixture(), second = fixture(); second.releaseId = 'second-release';
  for (const asset of second.assets) asset.path = asset.path.replace(first.releaseId, second.releaseId);
  rebind(second);
  assert.throws(() => createAutomatedAdvisoryRegistry({ schemaVersion: 1, activation: 'enabled', releases: [first, second] }), /overlapping/);
});

test('strict versioned bounded JSON rejects unknown fields, overflows, cycles, coercion, and accessor execution', () => {
  rejectedMutation(r => { r.schemaVersion = 2; });
  rejectedMutation(r => { r.unreviewedExtraField = 'not permitted'; });
  rejectedMutation(r => { r.sections = Array(21).fill(r.sections[0]); });
  rejectedMutation(r => { r.cvssScore = 10.1; });
  rejectedMutation(r => { r.cves.push(r.cves[0]); }, /Duplicate/);
  assert.throws(() => automatedStableHash({ enormous: 'a'.repeat(automatedAdvisoryLimits.releaseBytes + 1) }), /byte limit/);
  const cyclic = {}; cyclic.self = cyclic; assert.throws(() => automatedStableHash(cyclic), /depth/);
  for (const value of [undefined, NaN, Infinity, new Date(), new Map(), [undefined], Array(2)]) assert.throws(() => automatedStableHash(value));
  let executed = false;
  const accessor = Object.defineProperty({}, 'value', { enumerable: true, get() { executed = true; return 'bad'; } });
  assert.throws(() => automatedStableHash(accessor), /accessor/);
  assert.equal(executed, false);
  assert.throws(() => createAutomatedAdvisoryRegistry({ schemaVersion: 2, activation: 'held', releases: [] }));
});
