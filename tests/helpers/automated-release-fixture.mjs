import {
  automatedArtifactHashes, automatedCandidateHash, automatedCanonicalUrl, automatedSha256, automatedStableHash,
} from '../../src/lib/automated-advisory-domain.ts';

// SYNTHETIC ONLY. These are mock bytes, identities, native checks, and review fields, not real evidence.
// Never copy these values into the genuine catalog or treat hash consistency as receipt authenticity.
export const syntheticSourceUrl = 'https://www.fortiguard.com/psirt/synthetic-domain-test';
export const syntheticSourceBody = 'SYNTHETIC vendor body, not real evidence';
export function syntheticMediaBytes(key) {
  if (!['diagram', 'linkedin', 'reel'].includes(key)) throw new Error('Unknown synthetic media key.');
  return Buffer.from(`SYNTHETIC ${key} mock bytes; not an actual image/video or visual-review evidence.`);
}
const hex = value => automatedSha256(`SYNTHETIC ${value}`);

// Test-only rebinding, deliberately not exported from the production domain module.
export function bindSyntheticRelease(release) {
  for (const channel of ['linkedin', 'facebook', 'instagram']) release.social[channel].captionSha256 = automatedSha256(release.social[channel].caption);
  release.independentReview.candidateSha256 = automatedCandidateHash(release);
  release.independentReview.artifactHashes = structuredClone(automatedArtifactHashes(release));
  return release;
}
export function syntheticRelease({ now = new Date() } = {}) {
  const clock = new Date(now).getTime();
  if (!Number.isFinite(clock)) throw new Error('Invalid synthetic clock.');
  const at = minutesBefore => new Date(clock - minutesBefore * 60_000).toISOString();
  const releaseId = 'synthetic-domain-test', slug = 'synthetic-domain-test';
  const caption = `SYNTHETIC security fixture. ${automatedCanonicalUrl(slug)}\n#Security #Networking #Patching #Advisory #QCSStudio`;
  const social = Object.fromEntries(['linkedin', 'facebook', 'instagram'].map(channel => [channel, {
    accountId: channel === 'linkedin' ? 'synthetic-member-id' : channel === 'facebook' ? '428759466975905' : '17841468939564779',
    caption: channel === 'instagram' ? `${caption}\nCaption URLs are references, not clickable Instagram links.` : caption,
    assetKey: channel === 'linkedin' ? 'linkedin' : 'reel', captionSha256: hex('unbound caption'),
  }]));
  const assets = ['diagram', 'linkedin', 'reel'].map(key => {
    const bytes = syntheticMediaBytes(key), sha256 = automatedSha256(bytes);
    return {
      key, path: `/automated-advisories/${releaseId}/${sha256}.${key === 'reel' ? 'mp4' : key === 'linkedin' ? 'jpg' : 'png'}`,
      sha256, bytes: bytes.length, mimeType: key === 'reel' ? 'video/mp4' : key === 'linkedin' ? 'image/jpeg' : 'image/png',
      width: key === 'reel' ? 1080 : 1200, height: key === 'reel' ? 1920 : 675,
      ...(key === 'reel' ? { durationSeconds: 12 } : {}),
      alt: 'Synthetic packet-flow illustration identifying the affected service boundary.',
    };
  });
  return bindSyntheticRelease({
    schemaVersion: 1, activation: 'enabled', releaseId, slug, externalId: 'SYNTHETIC-DOMAIN-TEST', vendor: 'Fortinet',
    title: 'Synthetic advisory fixture', summary: 'Synthetic fixture, not a real advisory or review.',
    firstSeenAt: at(10), notBefore: at(1), vendorPublishedAt: at(105), vendorUpdatedAt: at(45),
    severity: 'unknown', cvssScore: null, cves: ['CVE-2026-9999999'], products: ['Synthetic product'],
    affectedVersions: [], fixedVersions: [], exploitationStatus: 'Unknown in the synthetic source.',
    mechanism: 'The synthetic source does not establish the mechanism.', affectedConditions: 'Unknown in the synthetic vendor body.',
    remediation: 'Consult the synthetic vendor body; no appliance commands are asserted.', workaround: null,
    verification: 'No device or exploit test was performed.', recovery: 'Recovery procedure is not specified in this synthetic source.',
    limitations: ['Version status and impact remain unknown in the cited synthetic source.'],
    definitions: [{ term: 'Unknown', definition: 'Not established by the cited source; not an all-clear.' }],
    sections: [{ heading: 'Synthetic source limitations', body: 'The synthetic vendor body leaves applicability unknown.', sourceUrls: [syntheticSourceUrl] }],
    sources: [{ url: syntheticSourceUrl, bodySha256: automatedSha256(syntheticSourceBody) }], assets, social,
    nativeReconciliation: Object.fromEntries(['linkedin', 'facebook', 'instagram'].map(channel => [channel, {
      accountId: social[channel].accountId, checkedAt: at(3), historySince: at(30 * 24 * 60),
      complete: true, existingDelivery: false, existingReservation: false, evidenceSha256: hex(`synthetic native ${channel}`),
    }])),
    independentReview: { authorAgentId: 'SYNTHETIC-author', reviewerAgentId: 'SYNTHETIC-distinct-reviewer', verdict: 'PASS',
      authorshipOrRepairPerformed: false, technicalPassed: true, visualPassed: true, reviewedAt: at(2),
      candidateSha256: hex('unbound candidate'), artifactHashes: [] },
  });
}
export function syntheticRuntime(release, { now = new Date() } = {}) {
  const checkedAt = new Date(now).toISOString();
  return {
    sources: release.sources.map(source => ({ ...source, checkedAt })),
    review: { checkedAt, candidateSha256: release.independentReview.candidateSha256, reviewSha256: automatedStableHash(release.independentReview) },
    accounts: { linkedin: { accountId: release.social.linkedin.accountId, kind: 'member' },
      facebook: { accountId: release.social.facebook.accountId }, instagram: { accountId: release.social.instagram.accountId } },
  };
}
