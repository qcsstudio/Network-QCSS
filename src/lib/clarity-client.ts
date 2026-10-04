import { CONSENT_KEY, readBrowserConsent } from "./browser-consent";
import { CLARITY_PROJECT_ID, hasReplayConsent, isClarityPage, isClarityReferrerSafe } from "./clarity-policy";

type ClarityFunction = ((...args: unknown[]) => void) & { q?: unknown[][]; v?: string };
type ClarityWindow = Window & { clarity?: ClarityFunction };
const denied = { analytics_Storage: "denied", ad_Storage: "denied" };
let initialized = false;
let requested = false;
let blockedForDocument = false;

function callClarity(...args: unknown[]) {
  try {
    (window as ClarityWindow).clarity?.(...args);
  } catch {
    // Optional analytics must never interrupt navigation, consent, or form submission.
  }
}

function clearReplayCookies() {
  const host = window.location.hostname;
  for (const name of ["_clck", "_clsk"]) {
    for (const domain of ["", host, ".qcsstudio.com"]) {
      document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax${domain ? `; domain=${domain}` : ""}`;
    }
  }
}

export function stopClarity() {
  blockedForDocument = true;
  if (!requested) return;
  callClarity("consentv2", denied);
  callClarity("stop");
  document.getElementById("qcs-clarity")?.remove();
  clearReplayCookies();
}

export function guardClarityNavigation(destination: string) {
  if (typeof window === "undefined" || isClarityPage(destination, window.location.origin)) return;
  const loading = requested && !(window as ClarityWindow).clarity?.v && !blockedForDocument;
  stopClarity();
  // Unload a pending third-party script before a private page can mount.
  if (loading) window.location.assign(new URL(destination, window.location.href).href);
}

function startClarity() {
  if (blockedForDocument || requested || !hasReplayConsent(readBrowserConsent())) return;
  if (!isClarityPage(window.location.href, window.location.origin)) return;
  const win = window as ClarityWindow;
  if (win.clarity || document.querySelector('script[src*="clarity.ms/tag/"]')) return;

  const queue: ClarityFunction = (...args: unknown[]) => { queue.q?.push(args); };
  queue.q = [];
  win.clarity = queue;
  requested = true;
  callClarity("consentv2", { analytics_Storage: "granted", ad_Storage: "denied" });
  const script = document.createElement("script");
  script.id = "qcs-clarity";
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_PROJECT_ID}`;
  script.referrerPolicy = "strict-origin";
  script.onerror = () => stopClarity();
  document.head.appendChild(script);
}

export function initializeClarity() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  const productionHost = /^(www\.)?qcsstudio\.com$/.test(window.location.hostname);
  const localDevelopment = process.env.NODE_ENV === "development" && /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  if ((!productionHost && !localDevelopment) || !/^[a-z0-9]+$/.test(CLARITY_PROJECT_ID)) return;
  if (!isClarityPage(window.location.href, window.location.origin) || !isClarityReferrerSafe(document.referrer, window.location.origin)) {
    blockedForDocument = true;
    return;
  }

  const sync = () => {
    if (!hasReplayConsent(readBrowserConsent())) {
      if (requested) {
        const loading = !blockedForDocument && !(window as ClarityWindow).clarity?.v;
        stopClarity();
        if (loading) window.location.reload();
      }
      return;
    }
    if (document.readyState === "complete") startClarity();
  };
  window.addEventListener("qcs-consent-change", sync);
  window.addEventListener("storage", (event) => { if (!event.key || event.key === CONSENT_KEY) sync(); });
  window.addEventListener("load", sync, { once: true });
  window.addEventListener("popstate", () => guardClarityNavigation(window.location.href));
  window.addEventListener("hashchange", () => guardClarityNavigation(window.location.href));
  window.addEventListener("pageshow", () => {
    guardClarityNavigation(window.location.href);
    sync();
  });
  window.addEventListener("pagehide", () => {
    if (requested) {
      blockedForDocument = true;
      callClarity("stop");
    }
  });
  sync();
}

export function trackClarityLead() {
  if (!requested || blockedForDocument || !hasReplayConsent(readBrowserConsent())) return;
  if (!isClarityPage(window.location.href, window.location.origin)) return;
  callClarity("event", "generate_lead");
}
