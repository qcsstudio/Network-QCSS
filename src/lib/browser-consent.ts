import type { ConsentState } from "./types";

export const CONSENT_KEY = "network-qcss-consent";
export const defaultConsent: ConsentState = {
  necessary: true,
  analytics: false,
  marketing: false,
  personalization: false,
  sessionReplay: false
};

export function parseConsent(saved: string | null): ConsentState {
  try {
    const value: unknown = JSON.parse(saved || "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return { ...defaultConsent };
    const consent = value as Record<string, unknown>;
    return {
      necessary: true,
      analytics: consent.analytics === true,
      marketing: consent.marketing === true,
      personalization: consent.personalization === true,
      sessionReplay: consent.sessionReplay === true,
      contact: consent.contact === true
    };
  } catch {
    return { ...defaultConsent };
  }
}

export function readBrowserConsent(): ConsentState {
  try {
    return parseConsent(window.localStorage.getItem(CONSENT_KEY));
  } catch {
    return { ...defaultConsent };
  }
}
