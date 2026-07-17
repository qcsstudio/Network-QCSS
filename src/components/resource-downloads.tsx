"use client";

import { useState } from "react";
import { CardVisual } from "@/components/card-visual";
import { resources } from "@/lib/content";
import { getStoredConsent } from "@/components/consent-banner";
import { trackBrowserEvent } from "@/lib/client-tracking";

export function ResourceDownloads() {
  const [status, setStatus] = useState("Choose a resource to review the checklist, template, or roadmap.");

  async function download(slug: string) {
    trackBrowserEvent("lead_magnet_download", { resource: slug });
    await fetch("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resource: slug,
        consent: getStoredConsent(),
        attribution: { landing: window.location.pathname, referrer: document.referrer || undefined }
      })
    });
    setStatus("Resource request saved. QCS can use this context if you ask for a deeper review.");
  }

  return (
    <div>
      <div className="resource-grid">
        {resources.map((resource) => (
          <article className="resource-card" key={resource.slug}>
            <CardVisual title={resource.title} context={`${resource.type} ${resource.audience}`} />
            <p className="eyebrow">{resource.type}</p>
            <h3>{resource.title}</h3>
            <p>{resource.summary}</p>
            <span className="resource-audience">{resource.audience}</span>
            <button className="button secondary" onClick={() => download(resource.slug)} type="button">
              Get Resource
            </button>
          </article>
        ))}
      </div>
      <p className="form-note">{status}</p>
    </div>
  );
}
