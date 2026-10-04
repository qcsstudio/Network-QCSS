import type { ConsentState } from "./types";

// This public project identifier is not a credential. An empty override disables the integration.
export const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_ID ?? "tjdh7hfz98";

const publicPages = /^\/(?:$|(?:services|solutions)(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?\/?$|(?:resources|security-advisories)(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?\/?$|intelligence\/?$)/;
const publicAnchors = new Set(["", "#contact", "#services", "#main-content", "#site-footer"]);

export function isClarityPage(value: string, origin: string): boolean {
  try {
    const url = new URL(value, origin);
    return url.origin === origin &&
      !url.search && publicAnchors.has(url.hash) &&
      !/training|institute|ccna|course/.test(url.pathname) &&
      publicPages.test(url.pathname);
  } catch {
    return false;
  }
}

export function isClarityReferrerSafe(referrer: string, origin: string): boolean {
  if (!referrer) return true;
  try {
    const url = new URL(referrer);
    if (url.search || url.hash) return false;
    return url.origin !== origin || isClarityPage(url.href, origin);
  } catch {
    return false;
  }
}

export function hasReplayConsent(consent: ConsentState): boolean {
  return consent.analytics === true && consent.sessionReplay === true;
}
