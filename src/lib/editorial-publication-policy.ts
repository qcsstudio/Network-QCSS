import type { BlogPost } from "./blog.ts";
import { storySpineQualityIssues } from "./editorial-story-lineage.ts";

const placeholderPattern = /draft required|replace this|todo|placeholder/i;

function wordCount(value: string) {
  return value.split(/\s+/).filter(Boolean).length;
}

export function usefulArticleWordCount(post: BlogPost) {
  return wordCount(
    [
      post.description,
      post.excerpt,
      post.answer,
      ...post.sections.flatMap((section) => [section.heading, section.body, ...(section.bullets || [])])
    ].join(" ")
  );
}

export function articleCitationUrls(post: BlogPost) {
  return [...post.sections, ...post.questions].flatMap((item) => item.sourceUrls || []);
}

export function evaluateEditorialReadiness(post: BlogPost) {
  const issues: string[] = [];
  const searchableText = [
    post.description,
    post.excerpt,
    post.answer,
    ...post.sections.flatMap((section) => [section.heading, section.body, ...(section.bullets || [])])
  ].join(" ");
  const usefulWords = usefulArticleWordCount(post);
  const minimumUsefulWords = post.contentType === "resource" ? 800 : 1_000;
  const citations = articleCitationUrls(post);
  const uniqueCitations = [...new Set(citations)];
  const sourceSet = new Set(post.sources.map((source) => source.url));
  const citedSections = post.sections.filter((section) => (section.sourceUrls || []).length).length;
  const minimumCitedSections = Math.ceil(post.sections.length * 0.67);
  const sectionHeadings = post.sections.map((section) => section.heading).join(" | ");
  const checklistText = post.checklist.join(" ");

  if (placeholderPattern.test(searchableText)) issues.push("Replace all draft placeholders.");
  if (post.metaTitle.length > 60) issues.push("Keep the meta title at 60 characters or fewer.");
  if (post.description.length > 160) issues.push("Keep the meta description at 160 characters or fewer.");
  if (post.sections.length < 3) issues.push("Add at least three substantive sections.");
  if (post.sources.length < 1) issues.push("Add at least one authoritative source.");

  const headings = post.sections.map((section) => section.heading.trim().toLowerCase());
  if (new Set(headings).size !== headings.length) issues.push("Use a unique, decision-focused heading for every section.");

  if (post.contentVersion === 2) {
    if (usefulWords < minimumUsefulWords) {
      issues.push(`Add original technical analysis; this format requires at least ${minimumUsefulWords} useful words.`);
    }
    if (post.sections.length < 5) issues.push("Add at least five substantive sections covering the decision from answer to validation.");
    if (post.answer.length < 100) issues.push("Make the answer-first block specific enough to stand alone in search and AI results.");
    if (!post.readerOutcome) issues.push("State the practical reader outcome.");
    if (!post.reviewedBy) issues.push("Name the technical review team.");
    if (!post.editorialMethod) issues.push("Disclose the editorial research and review method.");
    if (!post.definitions || post.definitions.length < 2) issues.push("Define at least two important entities or technical terms.");
    if (!post.visualBrief) issues.push("Add a factual, topic-specific visual brief.");
    if ((post.visualBrief?.factualAnchors.length || 0) < 3) issues.push("Anchor the contextual image to at least three verified facts.");
    if (post.takeaways.length < 3) issues.push("Add at least three decision-useful takeaways.");
    if (post.checklist.length < 6) issues.push("Add at least six actionable checklist steps.");
    if (post.questions.length < 4) issues.push("Answer at least four practical follow-up questions.");
    if (uniqueCitations.length < 1) issues.push("Attach primary-source citations to the claims they support.");
    if (citations.some((url) => !sourceSet.has(url))) issues.push("Use only listed research sources for claim-level citations.");
  }

  if (post.contentVersion === 3) {
    if (usefulWords < minimumUsefulWords) {
      issues.push(`Add original technical analysis; this format requires at least ${minimumUsefulWords} useful words.`);
    }
    if (post.sections.length < 6) issues.push("Add at least six substantive sections covering the problem, mechanism, solution, implementation, validation, and limitations.");
    if (post.answer.length < 100) issues.push("Make the answer-first block specific enough to stand alone in search and AI results.");
    if (!post.readerOutcome) issues.push("State the practical reader outcome.");
    if (!post.reviewedBy) issues.push("Name the technical review team.");
    if (!post.editorialMethod) issues.push("Disclose the editorial research and review method.");
    if (!post.definitions || post.definitions.length < 2) issues.push("Define at least two important entities or technical terms.");
    if (!post.visualBrief) issues.push("Add a factual, topic-specific visual brief.");
    if ((post.visualBrief?.factualAnchors.length || 0) < 3) issues.push("Anchor the contextual image to at least three verified facts.");
    if (post.takeaways.length < 3) issues.push("Add at least three decision-useful takeaways.");
    if (post.checklist.length < 8) issues.push("Add at least eight actionable technical-guide steps.");
    if (post.questions.length < 4) issues.push("Answer at least four practical follow-up questions.");
    if (post.sources.length < 3) issues.push("Research at least three authoritative sources before approval.");
    if (uniqueCitations.length < Math.min(3, post.sources.length)) issues.push("Map at least three authoritative sources to the claims they support.");
    if (citedSections < minimumCitedSections) issues.push(`Attach claim-level evidence to at least ${minimumCitedSections} of the ${post.sections.length} article sections.`);
    if (post.sources[0] && !uniqueCitations.includes(post.sources[0].url)) issues.push("Cite the primary source within the article body or FAQs.");
    if (citations.some((url) => !sourceSet.has(url))) issues.push("Use only listed research sources for claim-level citations.");
    const requiredSectionIntents: Array<[RegExp, string]> = [
      [/problem|scope|why .*matter|what .*mean/i, "Define the practical problem and its scope in a dedicated section."],
      [/mechanism|how .*work|technical|evidence|root cause/i, "Explain the technical mechanism and supporting evidence in a dedicated section."],
      [/solution|response|decision|option|recommend/i, "Compare the practical solution or response choices in a dedicated section."],
      [/implement|deployment|procedure|runbook|step-by-step|change sequence/i, "Provide a dedicated implementation or step-by-step technical guide section."],
      [/validat|verify|test|proof|success criteria/i, "Provide a dedicated validation section with observable success criteria."],
      [/limit|unknown|rollback|backout|recover|escalat/i, "Document limitations, rollback or recovery, and escalation conditions in a dedicated section."]
    ];
    for (const [pattern, issue] of requiredSectionIntents) {
      if (!pattern.test(sectionHeadings)) issues.push(issue);
    }
    if (!/validat|verify|confirm|test/i.test(checklistText)) issues.push("Add an explicit validation step to the technical checklist.");
    if (!/rollback|backout|recover|restore|revert/i.test(checklistText)) issues.push("Add an explicit rollback or recovery step to the technical checklist.");
    issues.push(...storySpineQualityIssues(post));
  }

  return {
    citationCount: uniqueCitations.length,
    citedSections,
    minimumCitedSections,
    issues,
    minimumUsefulWords,
    usefulWords
  };
}
