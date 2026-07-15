"use client";

import { useState } from "react";
import { resources } from "@/lib/content";
import { getStoredConsent } from "@/components/consent-banner";
import { trackBrowserEvent } from "@/lib/client-tracking";

export function ResourceDownloads() {
  const [status, setStatus] = useState("Choose a resource to create a content-led signal.");

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
    setStatus("Resource intent saved. In production this can trigger email, WhatsApp, and retargeting workflows.");
  }

  return (
    <div>
      <div className="resource-grid">
        {resources.map((resource) => (
          <article className="resource-card" key={resource.slug}>
            <p className="eyebrow">{resource.type}</p>
            <h3>{resource.title}</h3>
            <p>{resource.summary}</p>
            <span className="resource-audience">{resource.audience}</span>
            <button className="button secondary" onClick={() => download(resource.slug)} type="button">
              Capture Download
            </button>
          </article>
        ))}
      </div>
      <p className="form-note">{status}</p>
    </div>
  );
}
