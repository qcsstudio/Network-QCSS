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
    label: "Performance analytics",
    description: "Helps us understand which pages, tools, and resources are useful."
  },
  {
    key: "marketing",
    label: "Campaign measurement",
    description: "Helps measure ads, referrals, and conversion paths without reading private browser data."
  },
  {
    key: "personalization",
    label: "Preference memory",
    description: "Helps remember relevant choices and improve future website experiences."
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
        <p className="eyebrow">Privacy choices</p>
        <h2 id="cookie-consent-title">Choose how QCS can improve your website experience.</h2>
        <p id="cookie-consent-summary">
          Essential storage keeps forms, diagnostics, security controls, and consent choices working. Optional tracking
          starts only if you allow it.
        </p>
        <ul className="cookie-trust-list">
          <li>We do not read your email, passwords, local files, or private browser data.</li>
          <li>Tool inputs and generated passwords are not used for marketing personalization.</li>
          <li>You can continue with only essential storage.</li>
        </ul>
      </div>

      <div className="cookie-options" aria-label="Consent preferences">
        <label className="cookie-option locked">
          <input checked readOnly type="checkbox" />
          <span>
            <strong>Essential</strong>
            <small>Required for security, forms, tools, session state, and consent records.</small>
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

      <div className="cookie-actions">
        <button className="button secondary cookie-choice" type="button" onClick={() => save(defaultConsent)}>
          Reject optional
        </button>
        <button className="button secondary" type="button" onClick={() => save(consent)}>
          Save preferences
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
        Review details in the <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </aside>
  );
}
