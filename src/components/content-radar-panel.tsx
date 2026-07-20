"use client";

import { useState } from "react";
import { Archive, Clipboard, ExternalLink, Eye, FilePlus2, MessageCircle, RefreshCw, Save, ShieldCheck, Upload } from "lucide-react";
import type { BlogPost } from "@/lib/blog";

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
  imageRecommendation: string;
};

type ContentRadarResponse = {
  ok: boolean;
  scannedAt: string;
  sourceStatus: { source: string; ok: boolean; status: number; items: number }[];
  topics: {
    topic: string;
    source: string;
    sourceUrl: string;
    score: number;
    businessAngle: string;
    servicePath: string;
    keywordCluster: string[];
    suggestedSlug: string;
    reason: string;
  }[];
  drafts: RadarDraft[];
};

export type ContentPostRecord = {
  id: string;
  slug: string;
  title: string;
  status: "draft" | "approved" | "published" | "archived";
  content: BlogPost;
  sourceUrl: string;
  approvedBy: string;
  approvedAt: string;
  publishedAt: string;
  updatedAt: string;
  revisions: { id: string; version: number; action: string; actor: string; createdAt: string }[];
};

type LinkItem = { label: string; href: string };
type SourceItem = { label: string; url: string };

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
    `Source: ${draft.sourceUrl}`,
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
  label,
  items,
  pathKey,
  onChange
}: {
  label: string;
  items: (LinkItem | SourceItem)[];
  pathKey: "href" | "url";
  onChange: (items: (LinkItem | SourceItem)[]) => void;
}) {
  return (
    <fieldset className="content-array-editor">
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

export function ContentRadarPanel({ initialPosts = [] }: { initialPosts?: ContentPostRecord[] }) {
  const [radar, setRadar] = useState<ContentRadarResponse | null>(null);
  const [posts, setPosts] = useState<ContentPostRecord[]>(initialPosts);
  const [selected, setSelected] = useState<ContentPostRecord | null>(null);
  const [draft, setDraft] = useState<BlogPost | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [status, setStatus] = useState("Content Studio is ready. Scan sources or continue a saved draft.");
  const [busy, setBusy] = useState("");

  async function loadPosts() {
    const response = await fetch("/api/admin/content-posts", { cache: "no-store" });
    const result = (await response.json()) as { posts?: ContentPostRecord[]; error?: string };
    if (!response.ok || !result.posts) throw new Error(result.error || "Unable to load the editorial queue.");
    setPosts(result.posts);
  }

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

  async function createPost(payload: { draft?: RadarDraft; staticSlug?: string }) {
    setBusy(payload.staticSlug || payload.draft?.slug || "create");
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
      setStatus(`Draft created for ${result.post.title}. Complete the placeholders before approval.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to create the draft.");
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

  async function mutate(action: "save" | "approve" | "publish" | "archive") {
    if (!selected || !draft) return;
    setBusy(action);
    try {
      const response = await fetch(`/api/admin/content-posts/${selected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action === "save" ? { action, content: draft, sourceUrl } : { action })
      });
      const result = (await response.json()) as { post?: ContentPostRecord; error?: string };
      if (!response.ok || !result.post) throw new Error(result.error || `Unable to ${action} the article.`);
      setSelected(result.post);
      setDraft(structuredClone(result.post.content));
      setSourceUrl(result.post.sourceUrl);
      await loadPosts();
      setStatus(`${result.post.title} is now ${result.post.status}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `Unable to ${action} the article.`);
    } finally {
      setBusy("");
    }
  }

  async function requestWhatsAppReview() {
    if (!selected) return;
    setBusy("whatsapp-review");
    try {
      const response = await fetch(`/api/admin/content-posts/${selected.id}/approval`, { method: "POST" });
      const result = (await response.json()) as { approval?: { expiresAt: string }; error?: string };
      if (!response.ok || !result.approval) throw new Error(result.error || "Unable to send the WhatsApp review.");
      setStatus(`WhatsApp review sent for revision ${selected.revisions[0]?.version || 1}. It expires ${new Date(result.approval.expiresAt).toLocaleString("en-IN")}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to send the WhatsApp review.");
    } finally {
      setBusy("");
    }
  }

  function patchContent<K extends keyof BlogPost>(key: K, value: BlogPost[K]) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <section className="admin-panel content-radar-panel" id="content-studio">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Content Studio</p>
          <h2>Research, review, approve, and publish.</h2>
          <p>Radar findings become editable drafts. Only approved articles can move to the public blog.</p>
        </div>
        <div className="content-action-row">
          <button className="button secondary" disabled={Boolean(busy)} onClick={() => loadPosts().catch((error) => setStatus(String(error)))} type="button">
            <RefreshCw aria-hidden="true" size={17} /> Refresh
          </button>
          <button className="button primary" disabled={Boolean(busy)} onClick={scan} type="button">
            <RefreshCw aria-hidden="true" size={17} /> {busy === "scan" ? "Scanning..." : "Scan topics"}
          </button>
        </div>
      </div>

      <p aria-live="polite" className="form-note">{status}</p>

      <div className="content-queue-header">
        <div>
          <h3>Editorial queue</h3>
          <p>{posts.length} saved article(s), with approval and revision history.</p>
        </div>
        {!posts.some((post) => post.slug === "cisco-roomos-security-hardening-release-july-2026") ? (
          <button className="button secondary" disabled={Boolean(busy)} onClick={() => createPost({ staticSlug: "cisco-roomos-security-hardening-release-july-2026" })} type="button">
            <FilePlus2 aria-hidden="true" size={17} /> Add Cisco article
          </button>
        ) : null}
      </div>

      <div className="content-queue">
        {posts.length ? (
          posts.map((post) => (
            <article className="content-queue-card" key={post.id}>
              <div>
                <span className={`status-pill content-status-${post.status}`}>{post.status}</span>
                <h4>{post.title}</h4>
                <p>Updated {new Date(post.updatedAt).toLocaleString("en-IN")} | Revision {post.revisions[0]?.version || 1}</p>
              </div>
              <div className="content-action-row">
                <button className="button secondary compact-button" onClick={() => editPost(post)} type="button">
                  <Save aria-hidden="true" size={16} /> Edit
                </button>
                <a className="icon-button" href={`/admin/content/preview/${post.id}`} rel="noreferrer" target="_blank" title="Preview article">
                  <Eye aria-hidden="true" size={18} />
                </a>
              </div>
            </article>
          ))
        ) : (
          <div className="content-empty-state">No saved drafts yet. Scan the radar or add the reviewed Cisco article.</div>
        )}
      </div>

      {radar ? (
        <div className="content-radar-grid">
          <div className="content-radar-column">
            <h3>Recommended weekly drafts</h3>
            <div className="stack-list">
              {radar.drafts.map((radarDraft) => (
                <article className="stack-item content-draft-card" key={`${radarDraft.slot}-${radarDraft.slug}`}>
                  <p className="eyebrow">{radarDraft.slot}</p>
                  <h4>{radarDraft.title}</h4>
                  <span>{radarDraft.metaDescription}</span>
                  <div className="content-action-row">
                    <button className="button primary compact-button" disabled={Boolean(busy)} onClick={() => createPost({ draft: radarDraft })} type="button">
                      <FilePlus2 aria-hidden="true" size={16} /> Create draft
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
            <h3>Ranked trend signals</h3>
            <div className="stack-list">
              {radar.topics.slice(0, 6).map((topic) => (
                <a className="stack-item content-topic-card" href={topic.sourceUrl} key={`${topic.source}-${topic.topic}`} rel="noreferrer" target="_blank">
                  <strong>{topic.topic}</strong>
                  <span>{topic.score} score | {topic.source}</span>
                  <em>{topic.businessAngle}</em>
                </a>
              ))}
            </div>
          </div>

          <div className="content-radar-column source-health">
            <h3>Source health</h3>
            <div className="stack-list">
              {radar.sourceStatus.map((source) => (
                <div className="stack-item" key={source.source}>
                  <strong>{source.source}</strong>
                  <span>{source.ok ? "OK" : "Check"} | HTTP {source.status || "n/a"} | {source.items} item(s)</span>
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

          <fieldset className="content-editor-section">
            <legend>Article and search metadata</legend>
            <div className="content-field-grid">
              <label className="content-field content-field-wide"><span>Title</span><input value={draft.title} onChange={(event) => patchContent("title", event.target.value)} /></label>
              <label className="content-field"><span>Slug</span><input value={draft.slug} onChange={(event) => patchContent("slug", event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))} /></label>
              <label className="content-field"><span>Category</span><input value={draft.category} onChange={(event) => patchContent("category", event.target.value)} /></label>
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
              <label className="content-field"><span>Image path</span><input value={draft.image} onChange={(event) => patchContent("image", event.target.value)} /></label>
              <label className="content-field"><span>Image alt text</span><input value={draft.imageAlt} onChange={(event) => patchContent("imageAlt", event.target.value)} /></label>
              <LineListField label="Keywords" value={draft.keywords} onChange={(value) => patchContent("keywords", value)} hint="One keyword per line; use one primary intent and close supporting entities." />
            </div>
          </fieldset>

          <fieldset className="content-editor-section">
            <legend>Answer depth</legend>
            <div className="content-field-grid">
              <LineListField label="Key takeaways" value={draft.takeaways} onChange={(value) => patchContent("takeaways", value)} />
              <LineListField label="Practical checklist" value={draft.checklist} onChange={(value) => patchContent("checklist", value)} />
            </div>
          </fieldset>

          <fieldset className="content-editor-section">
            <legend>Article sections</legend>
            <div className="content-section-list">
              {draft.sections.map((section, index) => (
                <article className="content-section-row" key={`section-${index}`}>
                  <div className="content-row-heading"><strong>Section {index + 1}</strong><button className="icon-button" onClick={() => patchContent("sections", draft.sections.filter((_, sectionIndex) => sectionIndex !== index))} title="Remove section" type="button"><Archive aria-hidden="true" size={17} /></button></div>
                  <input aria-label={`Section ${index + 1} heading`} value={section.heading} onChange={(event) => { const next = [...draft.sections]; next[index] = { ...section, heading: event.target.value }; patchContent("sections", next); }} />
                  <textarea aria-label={`Section ${index + 1} body`} rows={6} value={section.body} onChange={(event) => { const next = [...draft.sections]; next[index] = { ...section, body: event.target.value }; patchContent("sections", next); }} />
                  <textarea aria-label={`Section ${index + 1} bullets`} placeholder="Optional bullets, one per line" rows={3} value={(section.bullets || []).join("\n")} onChange={(event) => { const next = [...draft.sections]; const bullets = lines(event.target.value); next[index] = { ...section, bullets: bullets.length ? bullets : undefined }; patchContent("sections", next); }} />
                </article>
              ))}
            </div>
            <button className="button secondary compact-button" onClick={() => patchContent("sections", [...draft.sections, { heading: "New section", body: "Develop this section with verified facts, operational evidence, and a clear next action." }])} type="button"><FilePlus2 aria-hidden="true" size={16} /> Add section</button>
          </fieldset>

          <fieldset className="content-editor-section">
            <legend>Questions and answers</legend>
            <div className="content-section-list">
              {draft.questions.map((faq, index) => (
                <article className="content-section-row" key={`faq-${index}`}>
                  <div className="content-row-heading"><strong>Question {index + 1}</strong><button className="icon-button" onClick={() => patchContent("questions", draft.questions.filter((_, faqIndex) => faqIndex !== index))} title="Remove question" type="button"><Archive aria-hidden="true" size={17} /></button></div>
                  <input aria-label={`Question ${index + 1}`} value={faq.question} onChange={(event) => { const next = [...draft.questions]; next[index] = { ...faq, question: event.target.value }; patchContent("questions", next); }} />
                  <textarea aria-label={`Answer ${index + 1}`} rows={4} value={faq.answer} onChange={(event) => { const next = [...draft.questions]; next[index] = { ...faq, answer: event.target.value }; patchContent("questions", next); }} />
                </article>
              ))}
            </div>
            <button className="button secondary compact-button" onClick={() => patchContent("questions", [...draft.questions, { question: "New operational question?", answer: "Provide a direct, evidence-based answer with the practical next action." }])} type="button"><FilePlus2 aria-hidden="true" size={16} /> Add question</button>
          </fieldset>

          <div className="content-link-grid">
            <LinkListEditor label="Related tools" items={draft.relatedTools} pathKey="href" onChange={(items) => patchContent("relatedTools", items as LinkItem[])} />
            <LinkListEditor label="Related services" items={draft.relatedServices} pathKey="href" onChange={(items) => patchContent("relatedServices", items as LinkItem[])} />
            <LinkListEditor label="Sources" items={draft.sources} pathKey="url" onChange={(items) => patchContent("sources", items as SourceItem[])} />
          </div>

          <div className="content-publish-bar">
            <div>
              <span className={`status-pill content-status-${selected.status}`}>{selected.status}</span>
              <small>Save, review the private preview, approve, then publish. Every step is recorded.</small>
            </div>
            <div className="content-action-row">
              <button className="button secondary" disabled={Boolean(busy)} type="submit"><Save aria-hidden="true" size={17} /> {busy === "save" ? "Saving..." : "Save draft"}</button>
              <button className="button primary" disabled={Boolean(busy) || selected.status !== "draft"} onClick={requestWhatsAppReview} type="button"><MessageCircle aria-hidden="true" size={17} /> {busy === "whatsapp-review" ? "Sending..." : "WhatsApp review"}</button>
              <button className="button secondary" disabled={Boolean(busy) || selected.status !== "draft"} onClick={() => mutate("approve")} type="button"><ShieldCheck aria-hidden="true" size={17} /> Approve</button>
              <button className="button primary" disabled={Boolean(busy) || selected.status !== "approved"} onClick={() => mutate("publish")} type="button"><Upload aria-hidden="true" size={17} /> Publish</button>
              <button className="icon-button danger" disabled={Boolean(busy)} onClick={() => mutate("archive")} title="Archive article" type="button"><Archive aria-hidden="true" size={18} /></button>
            </div>
          </div>
        </form>
      ) : null}
    </section>
  );
}
