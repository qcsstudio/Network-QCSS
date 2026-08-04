import type { BlogPost } from "./blog.ts";

export type BlogArchiveQuery = {
  format?: string;
  page?: number | string;
  query?: string;
  topic?: string;
};

const firstPageCapacity = 9;
const laterPageCapacity = 8;

function normalize(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim() || "";
}

export function blogArchivePage(posts: BlogPost[], query: BlogArchiveQuery = {}) {
  const search = normalize(query.query).toLowerCase();
  const topic = normalize(query.topic);
  const format = normalize(query.format);
  const topics = [...new Set(posts.map((post) => post.category))].sort((left, right) => left.localeCompare(right));
  const filtered = posts.filter((post) => {
    if (topic && post.category !== topic) return false;
    if (format && (post.contentType || "blog") !== format) return false;
    if (!search) return true;
    return [post.title, post.description, post.excerpt, post.category, post.primaryKeyword, ...post.keywords]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
  const totalPages = Math.max(
    1,
    filtered.length <= firstPageCapacity
      ? 1
      : 1 + Math.ceil((filtered.length - firstPageCapacity) / laterPageCapacity)
  );
  const requestedPage = typeof query.page === "number" ? query.page : Number(query.page || 1);
  const page = Math.min(Math.max(Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1, 1), totalPages);
  const start = page === 1 ? 1 : firstPageCapacity + (page - 2) * laterPageCapacity;
  return {
    featured: page === 1 ? filtered[0] || null : null,
    items: page === 1 ? filtered.slice(1, firstPageCapacity) : filtered.slice(start, start + laterPageCapacity),
    page,
    topics,
    total: filtered.length,
    totalPages
  };
}

export function blogArchiveHref(query: BlogArchiveQuery, page: number) {
  const params = new URLSearchParams();
  const search = normalize(query.query);
  const topic = normalize(query.topic);
  const format = normalize(query.format);
  if (search) params.set("q", search);
  if (topic) params.set("topic", topic);
  if (format) params.set("format", format);
  if (page > 1) params.set("page", String(page));
  const suffix = params.toString();
  return suffix ? `/resources?${suffix}#blog-posts` : "/resources#blog-posts";
}

function words(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function sentenceSegments(value: string) {
  try {
    return [...new Intl.Segmenter("en", { granularity: "sentence" }).segment(value)]
      .map((entry) => entry.segment.trim())
      .filter(Boolean);
  } catch {
    return value.match(/[^.!?]+(?:[.!?]+["']?|$)/g)?.map((sentence) => sentence.trim()).filter(Boolean) || [value];
  }
}

export function articleParagraphs(value: string, targetWords = 68) {
  const explicitParagraphs = value
    .split(/\n{2,}/)
    .map(normalize)
    .filter(Boolean);
  return explicitParagraphs.flatMap((paragraph) => {
    if (words(paragraph) <= targetWords) return [paragraph];
    const sentences = sentenceSegments(paragraph);
    const chunks: string[] = [];
    let chunk: string[] = [];
    let chunkWords = 0;
    for (const sentence of sentences) {
      const sentenceWords = words(sentence);
      if (chunk.length && (chunkWords + sentenceWords > targetWords || chunk.length >= 3)) {
        chunks.push(chunk.join(" "));
        chunk = [];
        chunkWords = 0;
      }
      chunk.push(sentence);
      chunkWords += sentenceWords;
    }
    if (chunk.length) chunks.push(chunk.join(" "));
    return chunks;
  });
}

export function relatedBlogPosts(posts: BlogPost[], current: BlogPost, limit = 3) {
  const currentKeywords = new Set(current.keywords.map((keyword) => keyword.toLowerCase()));
  return posts
    .filter((post) => post.slug !== current.slug)
    .map((post) => ({
      post,
      score:
        (post.category === current.category ? 8 : 0) +
        (post.contentType === current.contentType ? 2 : 0) +
        post.keywords.filter((keyword) => currentKeywords.has(keyword.toLowerCase())).length * 3
    }))
    .sort((left, right) => right.score - left.score || right.post.publishedAt.localeCompare(left.post.publishedAt))
    .slice(0, limit)
    .map((entry) => entry.post);
}
