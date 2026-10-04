"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { trackBrowserEvent, updateConsentMode } from "@/lib/client-tracking";
import { CONSENT_KEY, defaultConsent, readBrowserConsent } from "@/lib/browser-consent";
import type { ConsentState } from "@/lib/types";

const optionalChoices: {
  key: keyof Pick<ConsentState, "analytics" | "marketing" | "personalization" | "sessionReplay">;
  label: string;
  description: string;
}[] = [
  {
    key: "analytics",
    label: "Analytics",
    description: "Page and tool usage."
  },
  {
    key: "sessionReplay",
    label: "Session recordings",
    description: "Microsoft Clarity heatmaps and masked interaction recordings on public business pages. Requires Analytics."
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
  return readBrowserConsent();
}

export function CookieSettingsButton() {
  return (
    <button className="qcs-cookie-settings" type="button" onClick={() => window.dispatchEvent(new Event("qcs-open-consent"))}>
      <Settings2 size={18} aria-hidden="true" /> Cookie settings
    </button>
  );
}

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [consent, setConsent] = useState<ConsentState>(defaultConsent);
  const [showPreferences, setShowPreferences] = useState(false);

  useEffect(() => {
    const openPreferences = () => {
      setConsent(getStoredConsent());
      setShowPreferences(true);
      setVisible(true);
      window.setTimeout(() => document.querySelector<HTMLButtonElement>(".cookie-save")?.focus(), 0);
    };
    window.addEventListener("qcs-open-consent", openPreferences);
    const timer = window.setTimeout(() => {
      let saved: string | null = null;
      try { saved = window.localStorage.getItem(CONSENT_KEY); } catch { /* Keep optional consent off. */ }
      const storedConsent = getStoredConsent();
      setVisible(!saved);
      setConsent(storedConsent);
      updateConsentMode(storedConsent);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("qcs-open-consent", openPreferences);
    };
  }, []);

  function save(nextConsent: ConsentState) {
    nextConsent = { ...nextConsent, sessionReplay: nextConsent.analytics && nextConsent.sessionReplay === true };
    try { window.localStorage.setItem(CONSENT_KEY, JSON.stringify(nextConsent)); } catch { nextConsent = { ...defaultConsent }; }
    window.dispatchEvent(new Event("qcs-consent-change"));
    setConsent(nextConsent);
    setVisible(false);
    updateConsentMode(nextConsent);
    trackBrowserEvent("consent_updated", {
      analytics: nextConsent.analytics,
      marketing: nextConsent.marketing,
      personalization: nextConsent.personalization,
      sessionReplay: nextConsent.sessionReplay === true
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
    }).catch(() => undefined);
  }

  if (!visible) return null;

  return (
    <aside
      className="cookie-panel"
      data-clarity-mask="true"
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      aria-describedby="cookie-consent-summary"
    >
      <div className="cookie-panel-header">
        <p className="eyebrow">Privacy</p>
        <h2 id="cookie-consent-title">Your privacy choices</h2>
        <p id="cookie-consent-summary">
          Essential storage keeps the site secure and functional. Optional analytics and marketing remain off unless
          you allow them. Allow all also enables Microsoft Clarity heatmaps and masked session recordings on public business pages.
        </p>
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
                  disabled={choice.key === "sessionReplay" && !consent.analytics}
                  type="checkbox"
                  onChange={(event) => setConsent((current) => ({
                    ...current,
                    [choice.key]: event.target.checked,
                    ...(choice.key === "analytics" && !event.target.checked ? { sessionReplay: false } : {})
                  }))}
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
          Essential only
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
          onClick={() => save({ necessary: true, analytics: true, marketing: true, personalization: true, sessionReplay: true })}
        >
          Allow all
        </button>
      </div>

      <p className="cookie-footnote">
        Read the <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </aside>
  );
}
