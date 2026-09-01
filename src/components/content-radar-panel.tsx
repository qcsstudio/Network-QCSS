"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Activity, Archive, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Clipboard, Clock3, ExternalLink, Eye, FilePenLine, FilePlus2, FileText, Globe2, RefreshCw, RotateCcw, Save, Search, ShieldCheck, Sparkles, Trash2, Upload } from "lucide-react";
import type { BlogPost } from "@/lib/blog";
import type { EditorialResearchCoverage } from "@/lib/editorial-content-agents";
import { contentPostStatuses, type ContentPostStatus } from "@/lib/content-admin-domain";
import { evaluateEditorialReadiness } from "@/lib/editorial-publication-policy";

type RadarDraft = {
  slot: string;
  format: string;
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  answerBlock: string;
  sections: string[];
  internalLinks: string[];
  sourceUrl: string;
  sourceName?: string;
  sourceRole?: "authority" | "demand" | "discovery";
  sourcePublishedAt?: string;
  sourceSummary?: string;
  supportingSources?: Array<{ label: string; url: string; summary?: string }>;
  businessAngle?: string;
  servicePath?: string;
  keywordCluster?: string[];
  imageRecommendation: string;
};

type ContentRadarResponse = {
  ok: boolean;
  scannedAt: string;
  sourceStatus: { source: string; role: "authority" | "demand" | "discovery"; ok: boolean; status: number; items: number }[];
  topics: {
    topic: string;
    source: string;
    sourceUrl: string;
    sourceRole: "authority" | "demand" | "discovery";
    score: number;
    supportingSignals: number;
    businessAngle: string;
    servicePath: string;
    keywordCluster: string[];
    suggestedSlug: string;
    reason: string;
    draft: RadarDraft;
  }[];
  drafts: RadarDraft[];
};

export type ContentPostRecord = {
  id: string;
  slug: string;
  title: string;
  status: ContentPostStatus;
  content: BlogPost;
  sourceUrl: string;
  approvedBy: string;
  approvedAt: string;
  publishedAt: string;
  qualityScore: number | null;
  researchCoverage: EditorialResearchCoverage | null;
  updatedAt: string;
  revisions: { id: string; version: number; action: string; actor: string; createdAt: string }[];
};

type LinkItem = { label: string; href: string };
type SourceItem = { label: string; url: string };
type ContentKindFilter = "all" | "blog" | "resource";
type ContentStatusFilter = "all" | ContentPostStatus;
type ContentSort = "updated-desc" | "updated-asc" | "published-desc" | "title-asc";
type ContentListResponse = {
  posts?: ContentPostRecord[];
  counts?: Record<ContentPostStatus, number>;
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
  error?: string;
};

const statusLabels: Record<ContentPostStatus, string> = {
  approved: "Approved",
  archived: "Archived",
  deleted: "Deleted",
  draft: "Draft",
  published: "Published"
};

function initialStatusCounts(posts: ContentPostRecord[]) {
  const counts = Object.fromEntries(contentPostStatuses.map((item) => [item, 0])) as Record<ContentPostStatus, number>;
  for (const post of posts) counts[post.status] += 1;
  return counts;
}

function draftText(draft: RadarDraft) {
  return [
    `Slot: ${draft.slot} - ${draft.format}`,
    `Title: ${draft.title}`,
    `Slug: ${draft.slug}`,
    `Meta title: ${draft.metaTitle}`,
    `Meta description: ${draft.metaDescription}`,
    `Answer block: ${draft.answerBlock}`,
    `Sections: ${draft.sections.join(" | ")}`,
    `Internal links: ${draft.internalLinks.join(", ")}`,
    `Source: ${draft.sourceName || "Primary source"} - ${draft.sourceUrl}`,
    `Signal type: ${draft.sourceRole || "authority"}`,
    `Image: ${draft.imageRecommendation}`
  ].join("\n");
}

function lines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function LineListField({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (value: string[]) => void; hint?: string }) {
  return (
    <label className="content-field content-field-wide">
      <span>{label}</span>
      <textarea rows={Math.min(8, Math.max(3, value.length + 1))} value={value.join("\n")} onChange={(event) => onChange(lines(event.target.value))} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function LinkListEditor({
  disabled = false,
  label,
  items,
  pathKey,
  onChange
}: {
  disabled?: boolean;
  label: string;
  items: (LinkItem | SourceItem)[];
  pathKey: "href" | "url";
  onChange: (items: (LinkItem | SourceItem)[]) => void;
}) {
  return (
    <fieldset className="content-array-editor" disabled={disabled}>
      <legend>{label}</legend>
      {items.map((item, index) => (
        <div className="content-pair-row" key={`${pathKey}-${index}`}>
          <input
            aria-label={`${label} ${index + 1} label`}
            onChange={(event) => {
              const next = [...items];
              next[index] = { ...item, label: event.target.value };
              onChange(next);
            }}
            placeholder="Link label"
            value={item.label}
          />
          <input
            aria-label={`${label} ${index + 1} ${pathKey}`}
            onChange={(event) => {
              const next = [...items];
              next[index] = { ...item, [pathKey]: event.target.value };
              onChange(next);
            }}
            placeholder={pathKey === "href" ? "/internal-path" : "https://authoritative-source"}
            value={pathKey === "href" ? (item as LinkItem).href : (item as SourceItem).url}
          />
          <button className="icon-button" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))} title={`Remove ${label.toLowerCase()} row`} type="button">
            <Archive aria-hidden="true" size={17} />
          </button>
        </div>
      ))}
      <button
        className="button secondary compact-button"
        onClick={() => onChange([...items, pathKey === "href" ? { label: "", href: "/" } : { label: "", url: "https://" }])}
        type="button"
      >
        <FilePlus2 aria-hidden="true" size={16} /> Add link
      </button>
    </fieldset>
  );
}

function CitationPicker({
  label,
  sources,
  value,
  onChange
}: {
  label: string;
  sources: SourceItem[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  return (
    <div className="content-citation-picker">
      <span>{label}</span>
      {sources.length ? (
        <div className="content-citation-options">
          {sources.map((source, index) => (
            <label key={`${source.url}-${index}`}>
              <input
                checked={value.includes(source.url)}
                onChange={(event) => onChange(event.target.checked ? [...new Set([...value, source.url])] : value.filter((url) => url !== source.url))}
                type="checkbox"
              />
              <span>{source.label || `Source ${index + 1}`}</span>
            </label>
          ))}
        </div>
      ) : (
        <small>Add an authoritative source before mapping claims.</small>
      )}
      <small>Select only the primary sources that support factual claims in this block.</small>
    </div>
  );
}

export function ContentRadarPanel({ initialPosts = [] }: { initialPosts?: ContentPostRecord[] }) {
  const [radar, setRadar] = useState<ContentRadarResponse | null>(null);
  const [posts, setPosts] = useState<ContentPostRecord[]>(initialPosts);
  const [selected, setSelected] = useState<ContentPostRecord | null>(null);
  const [draft, setDraft] = useState<BlogPost | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [status, setStatus] = useState("Content Studio is ready. Scan sources, review a complete article, or continue a saved draft.");
  const [busy, setBusy] = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [contentFilter, setContentFilter] = useState<ContentKindFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ContentStatusFilter>("all");
  const [sort, setSort] = useState<ContentSort>("updated-desc");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [total, setTotal] = useState(initialPosts.length);
  const [totalPages, setTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState(() => initialStatusCounts(initialPosts));

  const loadPosts = useCallback(async (signal?: AbortSignal) => {
    setListLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort });
      if (searchQuery) params.set("q", searchQuery);
      if (contentFilter !== "all") params.set("format", contentFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const response = await fetch(`/api/admin/content-posts?${params.toString()}`, { cache: "no-store", signal });
      const result = (await response.json()) as ContentListResponse;
      if (!response.ok || !result.posts) throw new Error(result.error || "Unable to load the editorial queue.");
      setPosts(result.posts);
      setTotal(result.total ?? result.posts.length);
      setTotalPages(result.totalPages || 1);
      if (result.counts) setStatusCounts(result.counts);
      if (result.page && result.page !== page) setPage(result.page);
    } finally {
      if (!signal?.aborted) setListLoading(false);
    }
  }, [contentFilter, page, pageSize, searchQuery, sort, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      loadPosts(controller.signal).catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus(error instanceof Error ? error.message : "Unable to load the editorial queue.");
      });
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadPosts]);

  async function scan() {
    setBusy("scan");
    setStatus("Scanning trusted network, cloud, routing, and security sources...");
    try {
      const response = await fetch("/api/admin/content-radar", { cache: "no-store" });
      const result = (await response.json()) as ContentRadarResponse | { error?: unknown };
      if (!response.ok || !("topics" in result)) {
        throw new Error("error" in result && typeof result.error === "string" ? result.error : "Content radar failed.");
      }
      setRadar(result);
      setStatus(`Radar scan complete. ${result.topics.length} topic(s) ranked for QCS.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to scan content sources.");
    } finally {
      setBusy("");
    }
  }

  async function createPost(payload: { draft?: RadarDraft; staticSlug?: string; kind?: "blog" | "resource" }) {
    setBusy(payload.staticSlug || payload.draft?.slug || payload.kind || "create");
    try {
      const response = await fetch("/api/admin/content-posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = (await response.json()) as { post?: ContentPostRecord; error?: string };
      if (!response.ok || !result.post) throw new Error(result.error || "Unable to create the draft.");
      await loadPosts();
      setSelected(result.post);
      setDraft(structuredClone(result.post.content));
      setSourceUrl(result.post.sourceUrl);
      setStatus(
        (result.post.qualityScore || 0) >= 84
          ? `QA-ready draft created for ${result.post.title}. Verify the source and article before approval.`
          : `Research draft saved for ${result.post.title}. Review the flagged quality requirements or regenerate it before approval.`
      );
      window.setTimeout(() => document.querySelector("#content-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create the draft.");
    } finally {
      setBusy("");
    }
  }

  async function syncSiteLibrary() {
    setBusy("sync-library");
    try {
      const response = await fetch("/api/admin/content-posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ importCatalog: true })
      });
      const result = (await response.json()) as { imported?: number; posts?: ContentPostRecord[]; error?: string };
      if (!response.ok || !result.posts) throw new Error(result.error || "Unable to synchronize the public site library.");
      await loadPosts();
      setStatus(result.imported ? `${result.imported} public article(s) imported. Every live guide is now manageable here.` : "The public site library is already fully managed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to synchronize the public site library.");
    } finally {
      setBusy("");
    }
  }

  function editPost(post: ContentPostRecord) {
    setSelected(post);
    setDraft(structuredClone(post.content));
    setSourceUrl(post.sourceUrl);
    setStatus(`Editing ${post.title}. Saving content returns it to draft review.`);
    window.setTimeout(() => document.querySelector("#content-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function mutate(action: "save" | "regenerate" | "approve" | "publish" | "archive" | "restore" | "draft") {
    if (!selected || !draft) return;
    if (action === "draft" && selected.status === "published") {
      const confirmed = window.confirm("Move this published article to draft? It will be removed from the public blog and sitemap until it is approved and published again.");
      if (!confirmed) return;
    }
    if (action === "archive" && selected.status === "published") {
      const confirmed = window.confirm("Archive this published article? It will be removed from the public blog and sitemap.");
      if (!confirmed) return;
    }
    setBusy(action);
    try {
      const persistDraft = action === "save" || ((action === "approve" || action === "regenerate") && hasUnsavedChanges);
      const response = await fetch(`/api/admin/content-posts/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(persistDraft ? { action, content: draft, sourceUrl } : { action })
      });
      const result = (await response.json()) as { post?: ContentPostRecord; error?: string };
      if (!response.ok || !result.post) throw new Error(result.error || `Unable to ${action} the article.`);
      await loadPosts();
      if (action === "publish" || action === "archive") {
        setSelected(null);
        setDraft(null);
        setSourceUrl("");
      } else {
        setSelected(result.post);
        setDraft(structuredClone(result.post.content));
        setSourceUrl(result.post.sourceUrl);
      }
      setStatus(`${result.post.title} is now ${result.post.status}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Unable to ${action} the article.`);
    } finally {
      setBusy("");
    }
  }

  async function transitionPost(
    post: ContentPostRecord,
    action: "approve" | "publish" | "archive" | "restore" | "draft",
    options: { openEditor?: boolean } = {}
  ) {
    if (action === "draft" && post.status === "published") {
      const confirmed = window.confirm("Move this published article to draft? It will be removed from the public blog and sitemap until it is approved and published again.");
      if (!confirmed) return;
    }
    if (action === "archive" && post.status === "published") {
      const confirmed = window.confirm("Archive this published article? It will be removed from the public blog and sitemap.");
      if (!confirmed) return;
    }
    const operation = `${action}-${post.id}`;
    setBusy(operation);
    try {
      const response = await fetch(`/api/admin/content-posts/${post.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action })
      });
      const result = (await response.json()) as { post?: ContentPostRecord; error?: string };
      if (!response.ok || !result.post) throw new Error(result.error || `Unable to ${action} the article.`);
      await loadPosts();
      if (options.openEditor || selected?.id === post.id) {
        setSelected(result.post);
        setDraft(structuredClone(result.post.content));
        setSourceUrl(result.post.sourceUrl);
      }
      if (options.openEditor) {
        window.setTimeout(() => document.querySelector("#content-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
      }
      setStatus(
        action === "draft" || action === "restore"
          ? `${result.post.title} is now an editable draft.`
          : action === "publish"
            ? `${result.post.title} is published. The public blog and LinkedIn delivery queue were updated.`
            : `${result.post.title} is now ${result.post.status}.`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Unable to ${action} the article.`);
    } finally {
      setBusy("");
    }
  }

  async function openForEditing(post: ContentPostRecord) {
    if (post.status === "draft") {
      editPost(post);
      return;
    }
    if (post.status === "deleted" || post.status === "archived") {
      await transitionPost(post, "restore", { openEditor: true });
      return;
    }
    await transitionPost(post, "draft", { openEditor: true });
  }

  async function deletePost(post: ContentPostRecord) {
    const contentType = post.content.contentType || "blog";
    if (!window.confirm(`Delete this ${contentType} from the public content system? Revision history will be retained for recovery.`)) return;
    setBusy(`delete-${post.id}`);
    try {
      const response = await fetch(`/api/admin/content-posts/${post.id}`, { method: "DELETE" });
      const result = (await response.json()) as { post?: ContentPostRecord; error?: string };
      if (!response.ok || !result.post) throw new Error(result.error || `Unable to delete the ${contentType}.`);
      await loadPosts();
      if (selected?.id === post.id) {
        setSelected(result.post);
        setDraft(structuredClone(result.post.content));
      }
      setStatus(`${post.title} is deleted from public content. Use Restore to continue editing it.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Unable to delete the ${contentType}.`);
    } finally {
      setBusy("");
    }
  }

  async function restorePost(post: ContentPostRecord) {
    setBusy(`restore-${post.id}`);
    try {
      const response = await fetch(`/api/admin/content-posts/${post.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "restore" })
      });
      const result = (await response.json()) as { post?: ContentPostRecord; error?: string };
      if (!response.ok || !result.post) throw new Error(result.error || "Unable to restore the content item.");
      setSelected(result.post);
      setDraft(structuredClone(result.post.content));
      setSourceUrl(result.post.sourceUrl);
      await loadPosts();
      setStatus(`${result.post.title} is restored as a draft.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to restore the content item.");
    } finally {
      setBusy("");
    }
  }

  function patchContent<K extends keyof BlogPost>(key: K, value: BlogPost[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function patchSlug(value: string) {
    const slug = value.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    setDraft((current) => (current ? { ...current, slug, image: `/resources/${slug}/visual` } : current));
  }

  const allStatusCount = useMemo(() => contentPostStatuses.reduce((sum, item) => sum + statusCounts[item], 0), [statusCounts]);
  const rangeStart = total ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = total ? Math.min(page * pageSize, total) : 0;
  const hasUnsavedChanges = Boolean(
    draft && selected && (JSON.stringify(draft) !== JSON.stringify(selected.content) || sourceUrl !== selected.sourceUrl)
  );
  const approvalReadiness = useMemo(() => {
    if (!draft) return null;
    const readiness = evaluateEditorialReadiness(draft);
    const issues = [...readiness.issues];
    if (draft.contentVersion === 3) {
      if (hasUnsavedChanges) {
        issues.push("Save these edits, then run Complete draft to refresh research and editorial QA.");
      } else if (selected?.qualityScore === null || selected?.qualityScore === undefined) {
        issues.push("Run Complete draft so the research and editorial QA can be verified.");
      } else if (selected.qualityScore < 84) {
        issues.push("Regenerate or manually review this article because its editorial quality score is below 84.");
      }
      if (!hasUnsavedChanges) {
        if (!selected?.researchCoverage?.liveWebResearch) issues.push("Complete a live-web research pass before approval.");
        if ((selected?.researchCoverage?.webQueries || 0) < 3) issues.push("Complete at least three distinct web research queries before approval.");
        if ((selected?.researchCoverage?.researchQuestions || 0) < 4) issues.push("Resolve at least four source-backed research questions before approval.");
        if ((selected?.researchCoverage?.evidenceSources || 0) < 3) issues.push("Verify at least three authoritative evidence sources before approval.");
        if ((selected?.researchCoverage?.technicalSteps || 0) < 5) issues.push("Build a researched technical guide with at least five validated steps.");
      }
    }
    return { ...readiness, issues: [...new Set(issues)] };
  }, [draft, hasUnsavedChanges, selected]);
  const needsRegeneration = Boolean(approvalReadiness?.issues.length);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = String(form.get("q") || "").replace(/\s+/g, " ").trim();
    setSearchInput(next);
    setPage(1);
    if (next === searchQuery && page === 1) loadPosts().catch((error) => setStatus(error instanceof Error ? error.message : "Unable to search content."));
    else setSearchQuery(next);
  }

  function resetQueue() {
    setSearchInput("");
    setSearchQuery("");
    setContentFilter("all");
    setStatusFilter("all");
    setSort("updated-desc");
    setPage(1);
  }

  return (
    <section className="admin-panel content-radar-panel" id="content-studio">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Content Studio</p>
          <h2>Research, verify, approve, and publish.</h2>
          <p>Radar findings become researched, editable articles. Every Monday and Thursday the scheduler prepares one evidence-grounded draft for your approval.</p>
        </div>
        <div className="content-action-row">
          <button className="button secondary" disabled={Boolean(busy) || listLoading} onClick={() => loadPosts().catch((error) => setStatus(String(error)))} type="button">
            <RefreshCw aria-hidden="true" size={17} /> {listLoading ? "Refreshing..." : "Refresh"}
          </button>
          <button className="button primary" disabled={Boolean(busy)} onClick={scan} type="button">
            <RefreshCw aria-hidden="true" size={17} /> {busy === "scan" ? "Scanning..." : "Scan topics"}
          </button>
          <button className="button secondary" disabled={Boolean(busy)} onClick={() => createPost({ kind: "blog" })} type="button">
            <FileText aria-hidden="true" size={17} /> New blog
          </button>
          <button className="button secondary" disabled={Boolean(busy)} onClick={() => createPost({ kind: "resource" })} type="button">
            <BookOpen aria-hidden="true" size={17} /> New resource
          </button>
          <button className="button secondary" disabled={Boolean(busy)} onClick={syncSiteLibrary} type="button">
            <RefreshCw aria-hidden="true" size={17} /> {busy === "sync-library" ? "Syncing..." : "Sync site library"}
          </button>
        </div>
      </div>

      <p aria-live="polite" className="form-note">{status}</p>

      <div className="editorial-control-strip" aria-label="Content workflow summary">
        <article><Clock3 aria-hidden="true" /><span>Draft review</span><strong>{statusCounts.draft}</strong></article>
        <article><CheckCircle2 aria-hidden="true" /><span>Approved</span><strong>{statusCounts.approved}</strong></article>
        <article><Globe2 aria-hidden="true" /><span>Published</span><strong>{statusCounts.published}</strong></article>
        <article><Activity aria-hidden="true" /><span>Radar status</span><strong>{radar ? "Ready" : "Idle"}</strong></article>
      </div>

      <div className="content-queue-header">
        <div>
          <h3>Editorial queue</h3>
          <p>Search the complete library, review status, and move every article through a controlled publishing workflow.</p>
        </div>
        <div className="content-queue-count">
          <strong>{total}</strong>
          <span>{total === 1 ? "matching item" : "matching items"}</span>
        </div>
      </div>

      <div aria-label="Filter by publication status" className="content-status-tabs" role="group">
        <button aria-pressed={statusFilter === "all"} disabled={listLoading} onClick={() => { setStatusFilter("all"); setPage(1); }} type="button">
          <span>All</span><strong>{allStatusCount}</strong>
        </button>
        {contentPostStatuses.map((item) => (
          <button aria-pressed={statusFilter === item} disabled={listLoading} key={item} onClick={() => { setStatusFilter(item); setPage(1); }} type="button">
            <span>{statusLabels[item]}</span><strong>{statusCounts[item]}</strong>
          </button>
        ))}
      </div>

      <form className="content-queue-toolbar" onSubmit={submitSearch} role="search">
        <label className="content-queue-search">
          <span>Search articles</span>
          <div>
            <Search aria-hidden="true" size={17} />
            <input name="q" onChange={(event) => setSearchInput(event.target.value)} placeholder="Title, slug, vendor, or source URL" type="search" value={searchInput} />
          </div>
        </label>
        <label>
          <span>Content type</span>
          <select onChange={(event) => { setContentFilter(event.target.value as ContentKindFilter); setPage(1); }} value={contentFilter}>
            <option value="all">Blogs and resources</option>
            <option value="blog">Blogs</option>
            <option value="resource">Resources</option>
          </select>
        </label>
        <label>
          <span>Sort by</span>
          <select onChange={(event) => { setSort(event.target.value as ContentSort); setPage(1); }} value={sort}>
            <option value="updated-desc">Recently updated</option>
            <option value="updated-asc">Oldest updated</option>
            <option value="published-desc">Recently published</option>
            <option value="title-asc">Title A-Z</option>
          </select>
        </label>
        <button className="button primary compact-button" disabled={Boolean(busy) || listLoading} type="submit"><Search aria-hidden="true" size={16} /> {listLoading ? "Loading..." : "Search"}</button>
        <button className="icon-button" disabled={Boolean(busy) || listLoading} onClick={resetQueue} title="Reset queue filters" type="button"><RotateCcw aria-hidden="true" size={17} /></button>
      </form>

      <div className="content-queue-result-row" aria-live="polite">
        <span>{listLoading ? "Refreshing editorial queue..." : total ? `Showing ${rangeStart}-${rangeEnd} of ${total}` : "No matching content"}</span>
        {searchQuery ? <span>Search: {searchQuery}</span> : null}
      </div>

      <div aria-busy={listLoading} className="content-queue">
        {posts.length ? (
          posts.map((post) => {
            const queueReadiness = evaluateEditorialReadiness(post.content);
            const approvalBlocked = queueReadiness.issues.length > 0 || (post.qualityScore !== null && post.qualityScore < 84);
            return (
              <article className="content-queue-card" key={post.id}>
              <div className="content-queue-card-main">
                <div className="content-card-statuses">
                  <span className={`status-pill content-status-${post.status}`}>{post.status}</span>
                  <span className="status-pill content-kind-pill">{post.content.contentType || "blog"}</span>
                  {post.qualityScore !== null ? <span className="status-pill content-kind-pill">QA {post.qualityScore}</span> : <span className="status-pill content-kind-pill">manual review</span>}
                </div>
                <h4>{post.title}</h4>
                <p className="content-queue-excerpt">{post.content.excerpt}</p>
                <dl className="content-queue-facts">
                  <div><dt>Category</dt><dd>{post.content.category}</dd></div>
                  <div><dt>Updated</dt><dd>{new Date(post.updatedAt).toLocaleString("en-IN")}</dd></div>
                  <div><dt>Revision</dt><dd>{post.revisions[0]?.version || 1}</dd></div>
                  <div><dt>Slug</dt><dd>{post.slug}</dd></div>
                </dl>
              </div>
              <div className="content-queue-actions">
                {post.status === "draft" ? (
                  <>
                    <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => editPost(post)} type="button"><FilePenLine aria-hidden="true" size={16} /> Edit draft</button>
                    <button className="button primary compact-button" disabled={Boolean(busy) || approvalBlocked} onClick={() => transitionPost(post, "approve")} title={approvalBlocked ? "Open the editor to resolve publication checks" : "Approve the reviewed revision"} type="button"><ShieldCheck aria-hidden="true" size={16} /> {approvalBlocked ? "Checks required" : "Approve"}</button>
                  </>
                ) : null}
                {post.status === "approved" ? (
                  <>
                    <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => openForEditing(post)} type="button"><FilePenLine aria-hidden="true" size={16} /> Edit as draft</button>
                    <button className="button primary compact-button" disabled={Boolean(busy)} onClick={() => transitionPost(post, "publish")} type="button"><Upload aria-hidden="true" size={16} /> Publish</button>
                  </>
                ) : null}
                {post.status === "published" ? (
                  <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => transitionPost(post, "draft")} type="button"><FilePenLine aria-hidden="true" size={16} /> Move to draft</button>
                ) : null}
                {post.status === "archived" || post.status === "deleted" ? (
                  <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => transitionPost(post, "restore", { openEditor: true })} type="button"><RotateCcw aria-hidden="true" size={16} /> Restore draft</button>
                ) : null}
                {post.status !== "deleted" ? (
                  <a className="icon-button" href={`/admin/content/preview/${post.id}`} rel="noreferrer" target="_blank" title="Open private preview"><Eye aria-hidden="true" size={18} /></a>
                ) : null}
                {post.status === "published" ? (
                  <a className="icon-button" href={`/resources/${post.slug}`} rel="noreferrer" target="_blank" title="Open public article"><ExternalLink aria-hidden="true" size={18} /></a>
                ) : null}
                {post.status === "draft" || post.status === "approved" || post.status === "published" ? (
                  <button className="icon-button" disabled={Boolean(busy)} onClick={() => transitionPost(post, "archive")} title="Archive article" type="button"><Archive aria-hidden="true" size={18} /></button>
                ) : null}
                {post.status !== "deleted" ? (
                  <button className="icon-button danger" disabled={Boolean(busy)} onClick={() => deletePost(post)} title={`Delete ${post.content.contentType || "blog"}`} type="button"><Trash2 aria-hidden="true" size={18} /></button>
                ) : null}
              </div>
              </article>
            );
          })
        ) : (
          <div className="content-empty-state">No content matches these filters. Reset the queue or create a new article.</div>
        )}
      </div>

      {totalPages > 1 ? (
        <nav aria-label="Editorial queue pages" className="content-queue-pagination">
          <button className="button secondary compact-button" disabled={Boolean(busy) || listLoading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} type="button"><ChevronLeft aria-hidden="true" size={16} /> Previous</button>
          <span>Page {page} of {totalPages}</span>
          <button className="button secondary compact-button" disabled={Boolean(busy) || listLoading || page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} type="button">Next <ChevronRight aria-hidden="true" size={16} /></button>
        </nav>
      ) : null}

      {radar ? (
        <div className="content-radar-grid">
          <div className="content-radar-column">
            <h3>Ranked weekly briefs</h3>
            <div className="stack-list">
              {radar.drafts.map((radarDraft) => (
                <article className="stack-item content-draft-card" key={`${radarDraft.slot}-${radarDraft.slug}`}>
                  <p className="eyebrow">{radarDraft.slot}</p>
                  <h4>{radarDraft.title}</h4>
                  <span>{radarDraft.metaDescription}</span>
                  <div className="content-action-row">
                    <button className="button primary compact-button" disabled={Boolean(busy)} onClick={() => createPost({ draft: radarDraft })} type="button">
                      <FilePlus2 aria-hidden="true" size={16} /> Research draft
                    </button>
                    <button className="icon-button" onClick={() => navigator.clipboard.writeText(draftText(radarDraft)).then(() => setStatus(`Copied ${radarDraft.slot} brief.`))} title="Copy brief" type="button">
                      <Clipboard aria-hidden="true" size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="content-radar-column">
            <div className="content-radar-column-heading">
              <h3>Ranked article opportunities</h3>
              <span>{radar.topics.length} ranked</span>
            </div>
            <div className="stack-list">
              {radar.topics.map((topic, index) => {
                const savedPost = posts.find((post) => post.slug === topic.suggestedSlug || post.content.slug === topic.suggestedSlug);
                return (
                  <article className="stack-item content-topic-card" key={`${topic.source}-${topic.topic}`}>
                    <div className="content-topic-rank-row">
                      <span className="content-rank-pill">#{index + 1} | {topic.score} score</span>
                      <span className={`status-pill content-source-${topic.sourceRole}`}>{topic.sourceRole}</span>
                    </div>
                    <h4>{topic.topic}</h4>
                    <span>{topic.source}{topic.supportingSignals ? ` | ${topic.supportingSignals} supporting signal(s)` : ""}</span>
                    <em>{topic.businessAngle}</em>
                    <div className="content-topic-actions">
                      {savedPost ? (
                        savedPost.status === "deleted" ? (
                          <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => restorePost(savedPost)} type="button">
                            <RotateCcw aria-hidden="true" size={16} /> Restore draft
                          </button>
                        ) : (
                          <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={() => openForEditing(savedPost)} type="button">
                            <FileText aria-hidden="true" size={16} /> Open {savedPost.status}
                          </button>
                        )
                      ) : (
                        <button className="button primary compact-button" disabled={Boolean(busy)} onClick={() => createPost({ draft: topic.draft })} type="button">
                          <FilePlus2 aria-hidden="true" size={16} /> Move to draft
                        </button>
                      )}
                      <a className="icon-button" href={topic.sourceUrl} rel="noreferrer" target="_blank" title={`Open source from ${topic.source}`}>
                        <ExternalLink aria-hidden="true" size={17} />
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="content-radar-column source-health">
            <h3>Source health</h3>
            <div className="stack-list">
              {radar.sourceStatus.map((source) => (
                <div className="stack-item" key={source.source}>
                  <strong>{source.source}</strong>
                  <span>{source.role} | {source.ok ? "OK" : "Check"} | HTTP {source.status || "n/a"} | {source.items} item(s)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {selected && draft ? (
        <form className="content-editor" id="content-editor" onSubmit={(event) => { event.preventDefault(); mutate("save"); }}>
          <div className="content-editor-heading">
            <div>
              <p className="eyebrow">Structured editor</p>
              <h3>{draft.title}</h3>
              <p>Metadata limits and completeness are checked again before approval.</p>
            </div>
            <div className="content-action-row">
              <a className="icon-button" href={`/admin/content/preview/${selected.id}`} rel="noreferrer" target="_blank" title="Open private preview">
                <Eye aria-hidden="true" size={18} />
              </a>
              {selected.sourceUrl ? (
                <a className="icon-button" href={selected.sourceUrl} rel="noreferrer" target="_blank" title="Open primary source">
                  <ExternalLink aria-hidden="true" size={18} />
                </a>
              ) : null}
            </div>
          </div>

          <fieldset className="content-editor-section" disabled={selected.status !== "draft"}>
            <legend>Article and search metadata</legend>
            <div className="content-field-grid">
              <label className="content-field content-field-wide"><span>Title</span><input value={draft.title} onChange={(event) => patchContent("title", event.target.value)} /></label>
              <label className="content-field"><span>Slug</span><input value={draft.slug} onChange={(event) => patchSlug(event.target.value)} /></label>
              <label className="content-field"><span>Category</span><input value={draft.category} onChange={(event) => patchContent("category", event.target.value)} /></label>
              <label className="content-field"><span>Content type</span><select value={draft.contentType || "blog"} onChange={(event) => patchContent("contentType", event.target.value as "blog" | "resource")}><option value="blog">Blog</option><option value="resource">Resource</option></select></label>
              <label className="content-field content-field-wide"><span>Meta title ({draft.metaTitle.length}/60)</span><input value={draft.metaTitle} onChange={(event) => patchContent("metaTitle", event.target.value)} /></label>
              <label className="content-field content-field-wide"><span>Meta description ({draft.description.length}/160)</span><textarea rows={3} value={draft.description} onChange={(event) => patchContent("description", event.target.value)} /></label>
              <label className="content-field content-field-wide"><span>Card excerpt</span><textarea rows={3} value={draft.excerpt} onChange={(event) => patchContent("excerpt", event.target.value)} /></label>
              <label className="content-field content-field-wide"><span>Answer-first block</span><textarea rows={4} value={draft.answer} onChange={(event) => patchContent("answer", event.target.value)} /></label>
              <label className="content-field content-field-wide"><span>Audience</span><input value={draft.audience} onChange={(event) => patchContent("audience", event.target.value)} /></label>
              <label className="content-field"><span>Primary keyword</span><input value={draft.primaryKeyword} onChange={(event) => patchContent("primaryKeyword", event.target.value)} /></label>
              <label className="content-field"><span>Read time</span><input value={draft.readTime} onChange={(event) => patchContent("readTime", event.target.value)} /></label>
              <label className="content-field"><span>Published date</span><input type="date" value={draft.publishedAt} onChange={(event) => patchContent("publishedAt", event.target.value)} /></label>
              <label className="content-field"><span>Updated date</span><input type="date" value={draft.updatedAt} onChange={(event) => patchContent("updatedAt", event.target.value)} /></label>
              <label className="content-field content-field-wide"><span>Primary source URL</span><input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} /></label>
              <label className="content-field"><span>Generated visual URL</span><input readOnly value={`/resources/${draft.slug}/visual`} /></label>
              <label className="content-field"><span>Image alt text</span><input value={draft.imageAlt} onChange={(event) => patchContent("imageAlt", event.target.value)} /></label>
              <LineListField label="Keywords" value={draft.keywords} onChange={(value) => patchContent("keywords", value)} hint="One keyword per line; use one primary intent and close supporting entities." />
            </div>
          </fieldset>

          <fieldset className="content-editor-section" disabled={selected.status !== "draft"}>
            <legend>Answer depth</legend>
            <div className="content-field-grid">
              <LineListField label="Key takeaways" value={draft.takeaways} onChange={(value) => patchContent("takeaways", value)} />
              <LineListField label="Practical checklist" value={draft.checklist} onChange={(value) => patchContent("checklist", value)} />
            </div>
          </fieldset>

          <fieldset className="content-editor-section" disabled={selected.status !== "draft"}>
            <legend>Article sections</legend>
            <div className="content-section-list">
              {draft.sections.map((section, index) => (
                <article className="content-section-row" key={`section-${index}`}>
                  <div className="content-row-heading"><strong>Section {index + 1}</strong><button className="icon-button" onClick={() => patchContent("sections", draft.sections.filter((_, sectionIndex) => sectionIndex !== index))} title="Remove section" type="button"><Archive aria-hidden="true" size={17} /></button></div>
                  <input aria-label={`Section ${index + 1} heading`} value={section.heading} onChange={(event) => { const next = [...draft.sections]; next[index] = { ...section, heading: event.target.value }; patchContent("sections", next); }} />
                  <textarea aria-label={`Section ${index + 1} body`} rows={6} value={section.body} onChange={(event) => { const next = [...draft.sections]; next[index] = { ...section, body: event.target.value }; patchContent("sections", next); }} />
                  <textarea aria-label={`Section ${index + 1} bullets`} placeholder="Optional bullets, one per line" rows={3} value={(section.bullets || []).join("\n")} onChange={(event) => { const next = [...draft.sections]; const bullets = lines(event.target.value); next[index] = { ...section, bullets: bullets.length ? bullets : undefined }; patchContent("sections", next); }} />
                  <CitationPicker label="Claim-level sources" sources={draft.sources} value={section.sourceUrls || []} onChange={(sourceUrls) => { const next = [...draft.sections]; next[index] = { ...section, sourceUrls }; patchContent("sections", next); }} />
                </article>
              ))}
            </div>
            <button className="button secondary compact-button" onClick={() => patchContent("sections", [...draft.sections, { heading: "New section", body: "Develop this section with verified facts, operational evidence, and a clear next action." }])} type="button"><FilePlus2 aria-hidden="true" size={16} /> Add section</button>
          </fieldset>

          <fieldset className="content-editor-section" disabled={selected.status !== "draft"}>
            <legend>Questions and answers</legend>
            <div className="content-section-list">
              {draft.questions.map((faq, index) => (
                <article className="content-section-row" key={`faq-${index}`}>
                  <div className="content-row-heading"><strong>Question {index + 1}</strong><button className="icon-button" onClick={() => patchContent("questions", draft.questions.filter((_, faqIndex) => faqIndex !== index))} title="Remove question" type="button"><Archive aria-hidden="true" size={17} /></button></div>
                  <input aria-label={`Question ${index + 1}`} value={faq.question} onChange={(event) => { const next = [...draft.questions]; next[index] = { ...faq, question: event.target.value }; patchContent("questions", next); }} />
                  <textarea aria-label={`Answer ${index + 1}`} rows={4} value={faq.answer} onChange={(event) => { const next = [...draft.questions]; next[index] = { ...faq, answer: event.target.value }; patchContent("questions", next); }} />
                  <CitationPicker label="Answer sources" sources={draft.sources} value={faq.sourceUrls || []} onChange={(sourceUrls) => { const next = [...draft.questions]; next[index] = { ...faq, sourceUrls }; patchContent("questions", next); }} />
                </article>
              ))}
            </div>
            <button className="button secondary compact-button" onClick={() => patchContent("questions", [...draft.questions, { question: "New operational question?", answer: "Provide a direct, evidence-based answer with the practical next action." }])} type="button"><FilePlus2 aria-hidden="true" size={16} /> Add question</button>
          </fieldset>

          <div className="content-link-grid">
            <LinkListEditor disabled={selected.status !== "draft"} label="Related tools" items={draft.relatedTools} pathKey="href" onChange={(items) => patchContent("relatedTools", items as LinkItem[])} />
            <LinkListEditor disabled={selected.status !== "draft"} label="Related services" items={draft.relatedServices} pathKey="href" onChange={(items) => patchContent("relatedServices", items as LinkItem[])} />
            <LinkListEditor disabled={selected.status !== "draft"} label="Sources" items={draft.sources} pathKey="url" onChange={(items) => patchContent("sources", items as SourceItem[])} />
          </div>

          <div className="content-publish-bar">
            <div className={`content-readiness-summary ${needsRegeneration ? "needs-work" : "is-ready"}`}>
              <span className={`status-pill content-status-${selected.status}`}>{selected.status}</span>
              <strong>{needsRegeneration ? `${approvalReadiness?.issues.length || 0} approval check(s) need attention` : "Ready for editorial approval"}</strong>
              <small>{approvalReadiness ? `${approvalReadiness.usefulWords}/${approvalReadiness.minimumUsefulWords} useful words | ${approvalReadiness.citedSections}/${draft.sections.length} cited sections | ${selected.researchCoverage?.evidenceSources || draft.sources.length} evidence source(s)` : "Checking article readiness..."}</small>
              {selected.researchCoverage ? <small>{`${selected.researchCoverage.webQueries} web search(es) | ${selected.researchCoverage.researchQuestions} research question(s) | ${selected.researchCoverage.technicalSteps} technical step(s) | live web ${selected.researchCoverage.liveWebResearch ? "verified" : "not verified"}`}</small> : null}
              {needsRegeneration ? <ul>{approvalReadiness?.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul> : <small>Approval locks the reviewed revision; publishing updates the public blog, sitemap, and LinkedIn delivery queue.</small>}
            </div>
            <div className="content-action-row">
              {selected.status === "draft" ? (
                <>
                  <button className="button secondary" disabled={Boolean(busy)} type="submit"><Save aria-hidden="true" size={17} /> {busy === "save" ? "Saving..." : "Save draft"}</button>
                  {needsRegeneration ? <button className="button secondary" disabled={Boolean(busy) || selected.status !== "draft"} onClick={() => mutate("regenerate")} type="button"><Sparkles aria-hidden="true" size={17} /> {busy === "regenerate" ? "Completing..." : "Complete draft"}</button> : null}
                  <button className="button primary" disabled={Boolean(busy) || needsRegeneration} onClick={() => mutate("approve")} title={needsRegeneration ? "Resolve the listed readiness checks before approval" : "Approve the reviewed revision"} type="button"><ShieldCheck aria-hidden="true" size={17} /> Approve</button>
                  <button className="icon-button danger" disabled={Boolean(busy)} onClick={() => mutate("archive")} title="Archive article" type="button"><Archive aria-hidden="true" size={18} /></button>
                  <button className="icon-button danger" disabled={Boolean(busy)} onClick={() => deletePost(selected)} title={`Delete ${draft.contentType || "blog"}`} type="button"><Trash2 aria-hidden="true" size={18} /></button>
                </>
              ) : null}
              {selected.status === "approved" ? (
                <>
                  <button className="button secondary" disabled={Boolean(busy)} onClick={() => mutate("draft")} type="button"><FilePenLine aria-hidden="true" size={17} /> Return to draft</button>
                  <button className="button primary" disabled={Boolean(busy)} onClick={() => mutate("publish")} type="button"><Upload aria-hidden="true" size={17} /> Publish</button>
                </>
              ) : null}
              {selected.status === "published" ? (
                <button className="button secondary" disabled={Boolean(busy)} onClick={() => mutate("draft")} type="button"><FilePenLine aria-hidden="true" size={17} /> Move to draft</button>
              ) : null}
              {selected.status === "archived" || selected.status === "deleted" ? (
                <button className="button secondary" disabled={Boolean(busy)} onClick={() => mutate("restore")} type="button"><RotateCcw aria-hidden="true" size={17} /> Restore draft</button>
              ) : null}
            </div>
          </div>
        </form>
      ) : null}
    </section>
  );
}
