"use client";

import type { ConsentState, JsonRecord } from "@/lib/types";

type MetaPixelFn = ((...args: unknown[]) => void) & {
  queue?: unknown[];
  callMethod?: (...params: unknown[]) => void;
  loaded?: boolean;
  version?: string;
};

type LinkedInInsightFn = ((...args: unknown[]) => void) & {
  q?: unknown[];
};

type TrackingWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: MetaPixelFn;
  lintrk?: LinkedInInsightFn;
  _fbq?: unknown;
  _linkedin_data_partner_ids?: string[];
};

function trackingWindow() {
  return window as TrackingWindow;
}

export function updateConsentMode(consent: ConsentState) {
  const win = trackingWindow();
  const update = {
    ad_storage: consent.marketing ? "granted" : "denied",
    analytics_storage: consent.analytics ? "granted" : "denied",
    ad_user_data: consent.marketing ? "granted" : "denied",
    ad_personalization: consent.personalization ? "granted" : "denied"
  };

  win.gtag?.("consent", "update", update);
  win.dataLayer = win.dataLayer || [];
  win.dataLayer.push({ event: "consent_updated_app", consent: update });

  if (consent.marketing) {
    loadMarketingPixels();
  }
}

export function trackBrowserEvent(event: string, params: JsonRecord = {}) {
  const win = trackingWindow();
  win.dataLayer = win.dataLayer || [];
  win.dataLayer.push({ event, ...params });
  win.gtag?.("event", event, params);

  if (event === "generate_lead") {
    win.fbq?.("track", "Lead", params);
    win.lintrk?.("track", params);
  }
}

export function loadMarketingPixels() {
  loadMetaPixel();
  loadLinkedInInsight();
}

function loadMetaPixel() {
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const win = trackingWindow();
  if (!pixelId || win.fbq) return;

  const fbq: MetaPixelFn = (...args: unknown[]) => {
    if (fbq.callMethod) {
      fbq.callMethod(...args);
      return;
    }
    fbq.queue?.push(args);
  };

  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = "2.0";
  win.fbq = fbq;
  win._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  fbq("init", pixelId);
  fbq("track", "PageView");
}

function loadLinkedInInsight() {
  const partnerId = process.env.NEXT_PUBLIC_LINKEDIN_PARTNER_ID;
  const win = trackingWindow();
  if (!partnerId || win.lintrk) return;

  win._linkedin_data_partner_ids = win._linkedin_data_partner_ids || [];
  win._linkedin_data_partner_ids.push(partnerId);
  const lintrk: LinkedInInsightFn = (...args: unknown[]) => {
    lintrk.q?.push(args);
  };
  lintrk.q = [];
  win.lintrk = lintrk;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
  document.head.appendChild(script);
}
