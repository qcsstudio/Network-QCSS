import type { BlogPost } from "./blog.ts";

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
  const minimumUsefulWords = post.contentType === "resource" ? 700 : 900;
  const citations = articleCitationUrls(post);
  const uniqueCitations = [...new Set(citations)];
  const sourceSet = new Set(post.sources.map((source) => source.url));

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

  return {
    citationCount: uniqueCitations.length,
    issues,
    minimumUsefulWords,
    usefulWords
  };
}
