import { z } from "zod";

export const advisoryImagePolicyVersion = "advisory-concept-v1";
export const advisoryImagePolicyMarker = `ADVISORY IMAGE POLICY: ${advisoryImagePolicyVersion}`;
export const articleImagePolicyMarker = "ARTICLE IMAGE POLICY: evidence-concept-v1";
export const articleConceptInstructions = [
  articleImagePolicyMarker,
  "Populate advisoryConcept (the shared evidence-mapping field) for this article too: map two to five exact excerpts from the article facts to visible relationships in the scene.",
  "Propose genuinely different spatial concepts, then explain the chosen composition and how it differs from recent images. A changed title, logo, colour or vendor is not a new concept.",
  "Use the label-removal test: the image must teach the article's specific mechanism, decision or trade-off without a title. Never invent a measured result, product UI or causal relationship.",
  "Choose the composition from the topic. Do not force a three-panel sequence, shield, radial topology, dashboard or security theme onto every story.",
  "One reviewed master serves the website and social channels. Use supported aspect ratios without cutting off the technical relationship. Captions and authentic QCS branding are applied separately."
].join("\n");

export const advisoryConceptSchema = z.object({
  evidenceToVisual: z.array(z.object({
    evidenceQuote: z.string().min(15).max(600),
    visualElement: z.string().min(15).max(400)
  })).min(2).max(5),
  compositionRationale: z.string().min(30).max(600),
  differenceFromRecent: z.string().min(30).max(600)
});

export const advisoryConceptInstructions = [
  advisoryImagePolicyMarker,
  "Design the entire composition from this advisory, not an existing layout with different text, colours, vendor names or devices.",
  "Populate advisoryConcept with two to five evidence-to-visual mappings. Each evidenceQuote must be an exact excerpt from the supplied advisory facts, not from the visual instructions. Explain the visible relationship each fact motivates.",
  "Explain why this spatial arrangement teaches this advisory's central mechanism or remediation decision. Compare it with recent compositions, not merely their titles or colours.",
  "Read all mechanism, impact, workaround and uncertainty details. Unknown exploitation is not confirmed exploitation, and a patch instruction is not proof that remediation succeeded.",
  "The establish/explain/resolve chronology is a reasoning aid, not a mandatory three-panel layout. Choose the layout, environment, objects, camera and visual language anew.",
  "Apply the label-removal test: without the title, CVE and logo, the scene must still explain this particular technical relationship. Reject a generic security diagram with substituted labels.",
  "Use one approved master scene for both the website and LinkedIn. Only the crop and authentic QCS logo placement may differ."
].join("\n");

function normalized(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function advisoryConceptIssues(
  evidence: string,
  direction: {
    advisoryConcept?: z.infer<typeof advisoryConceptSchema> | null;
    sceneConcept: string;
    diversitySignature: string;
  },
  recent: Array<{ sceneConcept: string; diversitySignature: string }>
) {
  const parsed = advisoryConceptSchema.safeParse(direction.advisoryConcept);
  if (!parsed.success) return ["Create an evidence-mapped advisory concept before rendering."];
  const issues: string[] = [];
  const facts = normalized(evidence);
  for (const mapping of parsed.data.evidenceToVisual) {
    if (!facts.includes(normalized(mapping.evidenceQuote))) {
      issues.push("Visual evidence must quote the supplied advisory facts exactly.");
    }
  }
  if (new Set(parsed.data.evidenceToVisual.map((item) => normalized(item.evidenceQuote))).size < 2) {
    issues.push("Map at least two distinct advisory facts to the scene.");
  }
  if (recent.some((item) => normalized(item.sceneConcept) === normalized(direction.sceneConcept) ||
    normalized(item.diversitySignature) === normalized(direction.diversitySignature))) {
    issues.push("The advisory composition repeats recent work; develop a different visual explanation.");
  }
  return [...new Set(issues)];
}

// No procedural fallback: unavailable generation must not masquerade as bespoke art.
export async function generateAdvisoryConceptImage<T>(
  config: { premiumAllowed: boolean; openAIConfigured: boolean; bflConfigured: boolean; openAIFallbackEnabled: boolean },
  runners: { bfl: () => Promise<T>; openAI: () => Promise<T> }
) {
  if (!config.openAIConfigured) throw new Error("Editorial image pending: configure OpenAI for concept planning and visual review.");
  if (!config.premiumAllowed) throw new Error("Editorial image pending: paid-image budget unavailable. No template was substituted.");
  if (config.bflConfigured) return runners.bfl();
  if (config.openAIFallbackEnabled) return runners.openAI();
  throw new Error("Editorial image pending: configure BFL or explicitly enable direct OpenAI image generation. No template was substituted.");
}

export function advisoryRenderNeedsManualRetry(input: {
  contentType: string; status: string; renderAttempts: unknown; force: boolean; promptChanged: boolean;
}) {
  return ["security_advisory", "content_post"].includes(input.contentType) && input.status === "failed" &&
    typeof input.renderAttempts === "number" && input.renderAttempts >= 1 && !input.force && !input.promptChanged;
}
