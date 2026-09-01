export type EditorialCitationEvidence = {
  label: string;
  url: string;
  text: string;
};

const stopWords = new Set([
  "about", "after", "also", "and", "are", "before", "being", "between", "could", "for", "from", "has", "have",
  "into", "more", "must", "only", "other", "our", "should", "than", "that", "the", "their", "there", "these",
  "this", "through", "using", "was", "were", "when", "where", "which", "with", "without", "your"
]);

function tokens(value: string) {
  return new Set(
    (value.toLowerCase().match(/[a-z0-9][a-z0-9.+-]{2,}/g) || [])
      .filter((token) => !stopWords.has(token))
  );
}

function overlapScore(claim: string, evidence: EditorialCitationEvidence) {
  const claimTokens = tokens(claim);
  if (!claimTokens.size) return 0;
  const evidenceTokens = tokens(`${evidence.label} ${evidence.text}`);
  const matches = [...claimTokens].filter((token) => evidenceTokens.has(token)).length;
  return matches / claimTokens.size;
}

export function mapClaimSourceUrls(values: string[], claim: string, evidence: EditorialCitationEvidence[]) {
  const allowed = new Set(evidence.map((source) => source.url));
  const explicit = [...new Set(values.filter((url) => allowed.has(url)))].slice(0, 4);
  if (explicit.length || !evidence.length) return explicit;

  const ranked = evidence
    .map((source, index) => ({ source, index, score: overlapScore(claim, source) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const strongest = ranked[0];
  if (!strongest) return [];

  const mapped = ranked
    .filter((candidate) => candidate.score >= Math.max(0.12, strongest.score * 0.72))
    .slice(0, 2)
    .map((candidate) => candidate.source.url);
  return mapped.length ? mapped : [evidence[0].url];
}
