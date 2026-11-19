import type { CcnaLessonContent } from "./ccna-lesson-schema.ts";

const readerWording: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "ipv4-static-routes": {
    "No independent review, image QA or runtime success is implied by static content validation.":
      "The examples describe expected behaviour, not measured lab results. Record your own route-table and reachability evidence."
  },
  "default-host-and-floating-routes": {
    "No runtime, pixel QA or independent review is claimed here.":
      "The examples describe expected behaviour; validate route selection and recovery in your isolated lab."
  },
  "ospfv2-neighbors-and-router-id": {
    "Keep predictions distinct from actual terminal output and independent review.":
      "Keep predicted behaviour distinct from the terminal output you actually observe."
  },
  "ospfv3-for-ipv6": {
    "An authoring checklist does not prove that a learner executed the configurations.":
      "Completing a reading checklist is not a substitute for executing and verifying the configurations in an isolated lab.",
    "Do not describe a predicted recovery as measured convergence or a completed independent review.":
      "Do not describe a predicted recovery as measured convergence; record timestamps and actual routing evidence."
  },
  "first-hop-redundancy": {
    "Retain measured and predicted evidence separately; image rendering and independent review remain parent-owned.":
      "Retain measured and predicted evidence separately; an illustrative diagram is not a record of device execution."
  },
  "aaa-tacacs-and-radius": {
    "The paper alternative can demonstrate reasoning about source, policy and fallback but cannot establish hands-on central AAA competence. v1.1 remains current through 2 February 2027 and v2.0 begins 3 February 2027. The parent and independent reviewer still own visual inspection and release decisions.":
      "The paper alternative can demonstrate reasoning about source, policy and fallback but cannot establish hands-on central AAA competence. v1.1 remains current through 2 February 2027 and v2.0 begins 3 February 2027."
  },
  "layer2-security-controls": {
    "Runtime, independent review and rendered-visual inspection are separate from authored coverage.":
      "Reading the explanation does not establish device behaviour. Record the actual validation results from your isolated lab."
  },
  "json-for-network-engineers": {
    "A deterministic authoring check is not independent review or observed learner execution.":
      "Checking the example text does not establish that it ran successfully. Record the parser output you actually observe."
  }
};

// Exact, lesson-scoped display substitutions leave stored lessons and social payloads intact.
export function ccnaReaderContent(slug: string, content: CcnaLessonContent): CcnaLessonContent {
  if (!Object.hasOwn(readerWording, slug)) return content;
  const wording = readerWording[slug];
  const display = (text: string) => Object.hasOwn(wording, text) ? wording[text] : text;
  return {
    ...content,
    sections: content.sections.map((section) => ({
      ...section,
      keyPoints: section.keyPoints.map(display),
      example: display(section.example)
    })),
    lab: { ...content.lab, cleanup: content.lab.cleanup.map(display) }
  };
}

export function ccnaComparisonBoundary(content: Pick<CcnaLessonContent, "teachingPrelude">, passages: string[]) {
  return /\b(?:access[ -]points?|firewalls?)\b/i.test(passages.join(" ")) ? content.teachingPrelude?.labBoundary : undefined;
}

export function ccnaSectionBoundary(content: CcnaLessonContent, section: CcnaLessonContent["sections"][number]) {
  const legacy = section.keyPoints.find((point) => /^Lab boundary:/i.test(point));
  return ccnaComparisonBoundary(content, [section.heading, section.explanation, section.example, ...section.keyPoints])
    || (legacy ? content.teachingPrelude?.labBoundary || legacy : undefined);
}
