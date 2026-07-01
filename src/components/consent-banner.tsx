"use client";

import { useEffect, useState } from "react";
import type { ConsentState } from "@/lib/types";

const defaultConsent: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
  personalization: false
};

export function getStoredConsent(): ConsentState {
  if (typeof window === "undefined") return defaultConsent;
  const saved = window.localStorage.getItem("network-qcss-consent");
  if (!saved) return defaultConsent;

  try {
    return { ...defaultConsent, ...(JSON.parse(saved) as Partial<ConsentState>) };
  } catch {
    return defaultConsent;
  }
}

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [consent, setConsent] = useState<ConsentState>(defaultConsent);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem("network-qcss-consent");
      setVisible(!saved);
      setConsent(getStoredConsent());
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function save(nextConsent: ConsentState) {
    window.localStorage.setItem("network-qcss-consent", JSON.stringify(nextConsent));
    setConsent(nextConsent);
    setVisible(false);

    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "consent_updated",
        consent: nextConsent,
        requiresAnalytics: false,
        metadata: { source: "banner" }
      })
    });
  }

  if (!visible) return null;

  return (
    <aside className="cookie-panel" aria-label="Cookie consent">
      <div>
        <p className="eyebrow">Privacy-safe tracking</p>
        <h2>Choose how this site can learn from your visit.</h2>
        <p>
          Necessary storage is always on. Analytics and marketing activate only if you allow them. We never read your
          email from the browser.
        </p>
      </div>

      <div className="cookie-options">
        <label>
          <input checked readOnly type="checkbox" /> Necessary
        </label>
        {(["analytics", "marketing", "personalization"] as const).map((key) => (
          <label key={key}>
            <input
              checked={Boolean(consent[key])}
              type="checkbox"
              onChange={(event) => setConsent((current) => ({ ...current, [key]: event.target.checked }))}
            />
            {key[0].toUpperCase() + key.slice(1)}
          </label>
        ))}
      </div>

      <div className="button-row">
        <button className="button secondary" type="button" onClick={() => save(defaultConsent)}>
          Necessary only
        </button>
        <button className="button primary" type="button" onClick={() => save(consent)}>
          Save choices
        </button>
      </div>
    </aside>
  );
}
