"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { trackBrowserEvent, updateConsentMode } from "@/lib/client-tracking";
import type { ConsentState } from "@/lib/types";

const defaultConsent: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
  personalization: false
};

const optionalChoices: {
  key: keyof Pick<ConsentState, "analytics" | "marketing" | "personalization">;
  label: string;
  description: string;
}[] = [
  {
    key: "analytics",
    label: "Analytics",
    description: "Page and tool usage."
  },
  {
    key: "marketing",
    label: "Campaigns",
    description: "Ad and referral performance."
  },
  {
    key: "personalization",
    label: "Preferences",
    description: "Saved website choices."
  }
];

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
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem("network-qcss-consent");
      const storedConsent = getStoredConsent();
      setVisible(!saved);
      setConsent(storedConsent);
      updateConsentMode(storedConsent);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function save(nextConsent: ConsentState) {
    window.localStorage.setItem("network-qcss-consent", JSON.stringify(nextConsent));
    setConsent(nextConsent);
    setVisible(false);
    updateConsentMode(nextConsent);
    trackBrowserEvent("consent_updated", {
      analytics: nextConsent.analytics,
      marketing: nextConsent.marketing,
      personalization: nextConsent.personalization
    });

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
    <aside
      className="cookie-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-summary"
    >
      <div className="cookie-panel-header">
        <p className="eyebrow">Privacy</p>
        <h2 id="cookie-consent-title">Choose optional tracking.</h2>
        <p id="cookie-consent-summary">
          QCS uses essential storage for tools, forms, security, and consent. Analytics and campaign tracking stay off
          unless you allow them.
        </p>
        <p className="cookie-short-note">We do not read browser email, passwords, local files, or generated passwords.</p>
      </div>

      {showPreferences && (
        <div className="cookie-preferences" id="cookie-preferences">
          <div className="cookie-options" aria-label="Consent preferences">
            <label className="cookie-option locked">
              <input checked readOnly type="checkbox" />
              <span>
                <strong>Essential</strong>
                <small>Required.</small>
              </span>
            </label>
            {optionalChoices.map((choice) => (
              <label className="cookie-option" key={choice.key}>
                <input
                  checked={Boolean(consent[choice.key])}
                  type="checkbox"
                  onChange={(event) => setConsent((current) => ({ ...current, [choice.key]: event.target.checked }))}
                />
                <span>
                  <strong>{choice.label}</strong>
                  <small>{choice.description}</small>
                </span>
              </label>
            ))}
          </div>
          <button className="button secondary cookie-save" type="button" onClick={() => save(consent)}>
            Save preferences
          </button>
        </div>
      )}

      <div className="cookie-actions">
        <button className="button secondary cookie-choice" type="button" onClick={() => save(defaultConsent)}>
          Reject optional
        </button>
        <button
          aria-controls="cookie-preferences"
          aria-expanded={showPreferences}
          className="button secondary cookie-choice"
          type="button"
          onClick={() => setShowPreferences((current) => !current)}
        >
          {showPreferences ? "Hide choices" : "Customize"}
        </button>
        <button
          className="button secondary cookie-choice"
          type="button"
          onClick={() => save({ necessary: true, analytics: true, marketing: true, personalization: true })}
        >
          Accept optional
        </button>
      </div>

      <p className="cookie-footnote">
        Details: <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </aside>
  );
}
