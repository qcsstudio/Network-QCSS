import type { LinkedInProfileSnapshot } from "../types/linkedinProfile";

export const normalizeKeyword = (keyword = "") => keyword.toLowerCase().trim().replace(/[^a-z0-9+#.\s-]/gi, "").replace(/\s+/g, " ");

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const keywordMatchScore = (text = "", keywords: string[] = []) => {
  const normalizedText = normalizeKeyword(text);
  const normalizedKeywords = keywords.map(normalizeKeyword).filter(Boolean);
  if (!normalizedKeywords.length) return normalizedText ? 55 : 0;

  let points = 0;
  normalizedKeywords.forEach((keyword) => {
    const count = (normalizedText.match(new RegExp(`\\b${escapeRegex(keyword)}\\b`, "g")) || []).length;
    if (count === 1) points += 20;
    if (count === 2) points += 28;
    if (count >= 3) points += 34;
  });

  return Math.min(100, Math.round(points / normalizedKeywords.length));
};

export const detectKeywordStuffing = (text = "") => {
  const words = normalizeKeyword(text).split(/\s+/).filter((word) => word.length > 3);
  const repeatedTerms: string[] = [];
  const counts = new Map<string, number>();
  words.forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  counts.forEach((count, word) => {
    if (count >= 8 || count / Math.max(words.length, 1) > 0.12) repeatedTerms.push(word);
  });

  const commaDump = text.split(",").length >= 10 && text.split(/\s+/).length < 80;
  return {
    isStuffed: repeatedTerms.length > 0 || commaDump,
    reason: commaDump ? "Looks like a comma-separated keyword dump." : repeatedTerms.length ? "Some terms are repeated too often." : undefined,
    repeatedTerms,
  };
};

export const distributedKeywordCoverage = (profile: LinkedInProfileSnapshot, keywords: string[] = []) => {
  const sections = [
    profile.headline,
    profile.about,
    ...(profile.experience || []).map((item) => `${item.title || ""} ${item.description || ""}`),
    ...(profile.skills || []).map((skill) => skill.name),
  ];
  if (!keywords.length) return sections.some(Boolean) ? 55 : 0;
  const covered = keywords.filter((keyword) => sections.some((section) => keywordMatchScore(section || "", [keyword]) > 0));
  const sectionSpread = sections.filter((section) => keywordMatchScore(section || "", keywords) > 0).length;
  return Math.min(100, Math.round((covered.length / keywords.length) * 70 + Math.min(sectionSpread, 4) * 7.5));
};
