"use client";

import { useState } from "react";

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
  drafts: {
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
  }[];
};

function draftText(draft: ContentRadarResponse["drafts"][number]) {
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

export function ContentRadarPanel() {
  const [data, setData] = useState<ContentRadarResponse | null>(null);
  const [status, setStatus] = useState("Scan trusted sources to prepare two blog briefs for the week.");
  const [loading, setLoading] = useState(false);

  async function scan() {
    setLoading(true);
    setStatus("Scanning trusted network, cloud, routing, and security sources...");
    try {
      const response = await fetch("/api/admin/content-radar", { cache: "no-store" });
      const result = (await response.json()) as ContentRadarResponse | { error?: unknown };
      if (!response.ok || !("topics" in result)) {
        const message = "error" in result && typeof result.error === "string" ? result.error : "Content radar failed.";
        throw new Error(message);
      }
      setData(result);
      setStatus(`Radar scan complete. ${result.topics.length} topic(s) ranked for QCS.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to scan content sources.");
    } finally {
      setLoading(false);
    }
  }

  async function copyDraft(draft: ContentRadarResponse["drafts"][number]) {
    await navigator.clipboard.writeText(draftText(draft));
    setStatus(`Copied ${draft.slot} brief.`);
  }

  return (
    <section className="admin-panel content-radar-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Content radar</p>
          <h2>Two SEO/AEO blog briefs per week.</h2>
          <p>
            Scan trusted niche feeds, rank topics by QCS relevance, and prepare article briefs before publishing them as
            reviewed blog posts.
          </p>
        </div>
        <button className="button secondary" disabled={loading} onClick={scan} type="button">
          {loading ? "Scanning..." : "Scan topics"}
        </button>
      </div>

      <p className="form-note">{status}</p>

      {data ? (
        <div className="content-radar-grid">
          <div className="content-radar-column">
            <h3>Recommended weekly drafts</h3>
            <div className="stack-list">
              {data.drafts.map((draft) => (
                <article className="stack-item content-draft-card" key={`${draft.slot}-${draft.slug}`}>
                  <p className="eyebrow">{draft.slot}</p>
                  <h4>{draft.title}</h4>
                  <span>{draft.metaDescription}</span>
                  <div className="mini-chip-row">
                    {draft.internalLinks.map((link) => (
                      <i key={link}>{link}</i>
                    ))}
                  </div>
                  <button className="button secondary" onClick={() => copyDraft(draft)} type="button">
                    Copy brief
                  </button>
                </article>
              ))}
            </div>
          </div>

          <div className="content-radar-column">
            <h3>Ranked trend signals</h3>
            <div className="stack-list">
              {data.topics.slice(0, 6).map((topic) => (
                <a className="stack-item content-topic-card" href={topic.sourceUrl} key={`${topic.source}-${topic.topic}`} rel="noreferrer" target="_blank">
                  <strong>{topic.topic}</strong>
                  <span>
                    {topic.score} score | {topic.source}
                  </span>
                  <em>{topic.businessAngle}</em>
                </a>
              ))}
            </div>
          </div>

          <div className="content-radar-column source-health">
            <h3>Source health</h3>
            <div className="stack-list">
              {data.sourceStatus.map((source) => (
                <div className="stack-item" key={source.source}>
                  <strong>{source.source}</strong>
                  <span>
                    {source.ok ? "OK" : "Check"} | HTTP {source.status || "n/a"} | {source.items} item(s)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
