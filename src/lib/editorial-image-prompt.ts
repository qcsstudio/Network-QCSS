type ArticleImageBrief = {
  answer: string;
  audience: string;
  category: string;
  description: string;
  excerpt: string;
  keywords: string[];
  primaryKeyword: string;
  sections: Array<{ heading: string; body: string; bullets?: string[] }>;
  sources: Array<{ label: string; url: string }>;
  takeaways: string[];
  title: string;
};

type AdvisoryImageBrief = {
  affectedVersions: unknown;
  cves: unknown;
  cvssScore: number | null;
  exploitationStatus: string;
  fixedVersions: unknown;
  products: unknown;
  remediation: string;
  severity: string;
  summary: string;
  title: string;
  vendor: string;
  workaround: string | null;
};

export type EditorialImagePromptInput = {
  context: string;
  title: string;
};

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clip(value: string, limit: number) {
  const normalized = normalize(value);
  if (normalized.length <= limit) return normalized;
  const partial = normalized.slice(0, limit - 1);
  return `${partial.slice(0, Math.max(partial.lastIndexOf(" "), Math.floor(limit * 0.75))).replace(/[,:;.!?\s]+$/, "")}...`;
}

export function buildArticleImageContext(content: ArticleImageBrief) {
  const sections = content.sections.map((section) => {
    const bullets = section.bullets?.join("; ") || "";
    return `${section.heading}: ${clip(section.body, 560)}${bullets ? ` Key details: ${clip(bullets, 460)}` : ""}`;
  });
  return [
    `Content category: ${content.category}.`,
    `Primary topic: ${content.primaryKeyword}.`,
    `Search description: ${clip(content.description, 320)}`,
    `Editorial summary: ${clip(content.excerpt, 420)}`,
    `Editorial answer: ${clip(content.answer, 760)}`,
    `Audience: ${content.audience}.`,
    `Supporting topics: ${content.keywords.join(", ")}.`,
    `Key takeaways: ${content.takeaways.join("; ")}.`,
    ...sections,
    `Source context: ${content.sources.map((source) => source.label).join(", ")}.`
  ].join("\n");
}
export function buildAdvisoryImageContext(advisory: AdvisoryImageBrief) {
  return [
    `Vendor: ${advisory.vendor}.`,
    `Severity: ${advisory.severity}${advisory.cvssScore === null ? "" : `, CVSS ${advisory.cvssScore}`}.`,
    `Exploitation status: ${advisory.exploitationStatus}.`,
    `Affected products: ${strings(advisory.products).join(", ") || "See vendor advisory"}.`,
    `Affected versions: ${strings(advisory.affectedVersions).join(", ") || "See vendor advisory"}.`,
    `Fixed versions: ${strings(advisory.fixedVersions).join(", ") || "See vendor advisory"}.`,
    `CVE identifiers: ${strings(advisory.cves).join(", ") || "Not assigned"}.`,
    `Summary: ${clip(advisory.summary, 1_000)}`,
    `Required action: ${clip(advisory.remediation, 800)}`,
    `Workaround: ${clip(advisory.workaround || "No vendor workaround stated", 500)}`
  ].join("\n");
}

export function buildEditorialImagePrompt(input: EditorialImagePromptInput) {
  return [
    "Create one original, context-specific editorial illustration for a professional network engineering and cybersecurity publication.",
    "Read the complete editorial brief below before designing anything. Infer the actual systems, actors, traffic paths, control boundaries, cause-and-effect relationship, operational evidence, and decision being discussed. Invent this article's visual concept from those facts. Do not select or reuse a standard cybersecurity theme.",
    "",
    `ARTICLE TITLE: ${input.title}`,
    input.context,
    "",
    "VISUAL REQUIREMENTS:",
    "- Show the concrete technical situation described in this brief. Use only infrastructure, interfaces, paths, environments, people, or operational artifacts that belong to this exact subject.",
    "- Communicate the article's core relationship or tension at a glance. Derive it from the brief rather than from a predefined theme, preset, motif library, or category template.",
    "- Choose the most suitable visual language for this specific story: realistic editorial scene, architectural cutaway, process-focused technical illustration, evidence-led close-up, or another original approach. Do not force different stories into the same composition style.",
    "- Do not use a reusable visual template, dashboard card, radial topology, four-node diagram, generic network map, or generic cybersecurity scene.",
    "- Do not use generic padlocks, shields, glowing globes, hooded people, binary rain, stock-photo operators, random server racks, or decorative circuit patterns unless this exact article materially requires that object.",
    "- No text, letters, numbers, vendor logos, watermarks, UI labels, or invented product branding. Exact QCS branding is applied separately after generation.",
    "- Wide 16:9 editorial composition, full bleed, one clear focal subject, rich detail at professional publication quality, realistic materials blended with restrained technical illustration only where useful.",
    "- Keep the top-left area visually calm enough for a small QCS logo overlay. Keep all essential subjects inside the central 84% so the 1.91:1 LinkedIn crop remains complete.",
    "- Let the subject determine the lighting, setting, perspective, and palette. Use QCS orange, coral, blue, or magenta only as restrained accents; never impose a fixed brand-colored scene."
  ].join("\n");
}
