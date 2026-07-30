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
  visualBrief?: {
    storyThesis: string;
    sceneConcept: string;
    factualAnchors: string[];
    avoid: string[];
  };
};

type AdvisoryImageBrief = {
  affectedVersions: unknown;
  businessImpact: string;
  cves: unknown;
  cvssScore: number | null;
  evidenceChecklist: unknown;
  exploitationStatus: string;
  fixedVersions: unknown;
  products: unknown;
  remediation: string;
  severity: string;
  sourceUrl: string;
  summary: string;
  technicalExplanation: string;
  title: string;
  vendor: string;
  workaround: string | null;
};

export type EditorialImagePromptInput = {
  contentType: "content_post" | "security_advisory";
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

function listSummary(value: unknown, limit: number, fallback: string) {
  const values = strings(value).map(normalize).filter(Boolean);
  if (!values.length) return fallback;
  const visible = values.slice(0, limit).join(", ");
  const remaining = values.length - limit;
  return remaining > 0 ? `${visible} (${remaining} additional items in the authoritative source)` : visible;
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
    ...(content.visualBrief
      ? [
          `Editorial visual thesis: ${content.visualBrief.storyThesis}.`,
          `Preferred factual scene: ${content.visualBrief.sceneConcept}.`,
          `Facts the visual may communicate: ${content.visualBrief.factualAnchors.join("; ")}.`,
          `Topic-specific visual exclusions: ${content.visualBrief.avoid.join("; ")}.`
        ]
      : []),
    ...sections,
    `Source context: ${content.sources.map((source) => source.label).join(", ")}.`
  ].join("\n");
}
export function buildAdvisoryImageContext(advisory: AdvisoryImageBrief) {
  const cves = strings(advisory.cves);
  const cveScope = cves.length
    ? `${cves.length} listed; representative identifiers: ${cves.slice(0, 3).join(", ")}${cves.length > 3 ? ". Do not attempt to visualize the remaining identifiers" : ""}`
    : "Not assigned";
  return [
    `Vendor: ${advisory.vendor}.`,
    `Severity: ${advisory.severity}${advisory.cvssScore === null ? "" : `, CVSS ${advisory.cvssScore}`}.`,
    `Exploitation status: ${advisory.exploitationStatus}.`,
    `Affected products: ${listSummary(advisory.products, 6, "See vendor advisory")}.`,
    `Affected versions: ${listSummary(advisory.affectedVersions, 4, "See vendor advisory")}.`,
    `Fixed versions: ${listSummary(advisory.fixedVersions, 4, "See vendor advisory")}.`,
    `CVE scope: ${cveScope}.`,
    `Plain-language summary: ${clip(advisory.summary, 1_000)}`,
    `Technical mechanism from the reviewed advisory: ${clip(advisory.technicalExplanation, 1_400)}`,
    `Operational and business consequence: ${clip(advisory.businessImpact, 800)}`,
    `Required action: ${clip(advisory.remediation, 800)}`,
    `Workaround: ${clip(advisory.workaround || "No vendor workaround stated", 500)}`,
    `Evidence an operator should verify: ${listSummary(advisory.evidenceChecklist, 6, "Confirm product, version, exposure, and remediation state")}.`,
    `Authoritative source: ${advisory.sourceUrl}.`,
    "Accuracy boundary: if the source does not describe an exact exploit mechanism, visualize the affected product boundary, observable evidence, and remediation decision instead of inventing an attack sequence."
  ].join("\n");
}

export function buildEditorialImagePrompt(input: EditorialImagePromptInput) {
  const contextRules =
    input.contentType === "security_advisory"
      ? [
          "- This is a security advisory visual. Anchor the scene to the affected product class, the stated technical mechanism, the exposure boundary, and the remediation or verification action.",
          "- Do not portray active exploitation, data theft, remote access, malware, a vulnerable interface, or a successful compromise unless the brief explicitly confirms it.",
          "- Versions, CVEs, severity, and vendor identity guide the art direction but must not appear as rendered text or invented vendor hardware."
        ]
      : [
          "- This is a researched article visual. Use its editorial visual thesis and factual anchors when supplied, while keeping the scene legible without labels."
        ];
  return [
    "Create one original, context-specific editorial illustration for a professional network engineering and cybersecurity publication.",
    "Read the complete editorial brief below before designing anything. Infer the actual systems, actors, traffic paths, control boundaries, cause-and-effect relationship, operational evidence, and decision being discussed. Invent this article's visual concept from those facts. Do not select or reuse a standard cybersecurity theme.",
    "",
    `ARTICLE TITLE: ${input.title}`,
    input.context,
    "",
    "VISUAL REQUIREMENTS:",
    ...contextRules,
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
