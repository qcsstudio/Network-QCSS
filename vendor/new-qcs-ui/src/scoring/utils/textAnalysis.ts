export const countWords = (text = "") => text.trim().split(/\s+/).filter(Boolean).length;

export const countChars = (text = "") => text.trim().length;

export const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, Math.round(value)));

export const scoreLengthRange = (value: number, idealMin: number, idealMax: number, hardMax?: number) => {
  if (!value) return 0;
  if (value >= idealMin && value <= idealMax) return 100;
  if (value < idealMin) return clamp((value / idealMin) * 100);
  if (hardMax && value > hardMax) return 55;
  return 82;
};

export const extractNumbersAndMetrics = (text = "") => {
  const matches = text.match(/(?:\$|₹)?\b\d+(?:[,.]\d+)*(?:%|x|k|m|cr|crore|lakh|\+)?\b/gi);
  return matches ? Array.from(new Set(matches)) : [];
};

export const hasQuantifiedProof = (text = "") => extractNumbersAndMetrics(text).length > 0;

const BUZZWORDS = [
  "passionate",
  "dynamic",
  "results-driven",
  "hard working",
  "team player",
  "growth hacker",
  "ninja",
  "guru",
  "rockstar",
  "quota crusher",
  "go-getter",
];

export const detectGenericBuzzwords = (text = "") => {
  const normalized = text.toLowerCase();
  return BUZZWORDS.filter((word) => normalized.includes(word));
};

export const hasClearCTA = (text = "") => /\b(book|schedule|connect|message|email|visit|apply|download|contact|dm|reach out|let'?s talk)\b/i.test(text);

export const detectOutcomeLanguage = (text = "") => /\b(increase|reduce|grow|improve|accelerate|save|drive|generate|convert|hire|scale|revenue|pipeline|retention|productivity|efficiency|qualified|profit|cost|time)\b/i.test(text);

export const detectStandardTitle = (title = "", targetTitles: string[] = []) => {
  if (!title.trim()) return 0;
  const lowerTitle = title.toLowerCase();
  if (targetTitles.some((target) => lowerTitle.includes(target.toLowerCase()))) return 100;
  if (/\b(founder|ceo|consultant|coach|recruiter|talent|sales|account executive|sdr|business development|engineer|manager|director|specialist|analyst|designer|developer|marketer)\b/i.test(title)) return 75;
  return 45;
};
