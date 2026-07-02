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

function numericEnv(name: string, fallback: number) {
  const value = Number(process.env[name] || "");
  return Number.isFinite(value) ? value : fallback;
}

function conversionParams(event: string, params: JsonRecord): JsonRecord {
  const currency = process.env.NEXT_PUBLIC_CONVERSION_CURRENCY || "INR";
  const leadValue = numericEnv("NEXT_PUBLIC_LEAD_CONVERSION_VALUE", 0);
  const assessmentValue = numericEnv("NEXT_PUBLIC_ASSESSMENT_CONVERSION_VALUE", 0);

  if (event === "generate_lead") {
    return {
      ...params,
      currency,
      value: leadValue,
      event_category: "lead_generation"
    };
  }

  if (event === "assessment_complete") {
    return {
      ...params,
      currency,
      value: assessmentValue,
      event_category: "diagnostic_tool"
    };
  }

  return params;
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
  const conversion = conversionParams(event, params);
  win.dataLayer = win.dataLayer || [];
  win.dataLayer.push({ event, ...conversion });
  win.gtag?.("event", event, conversion);

  if (event === "generate_lead") {
    const googleAdsSendTo = process.env.NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO;
    const linkedInConversionId = process.env.NEXT_PUBLIC_LINKEDIN_LEAD_CONVERSION_ID;
    if (googleAdsSendTo) {
      win.gtag?.("event", "conversion", {
        send_to: googleAdsSendTo,
        currency: String(conversion.currency || process.env.NEXT_PUBLIC_CONVERSION_CURRENCY || "INR"),
        value: typeof conversion.value === "number" ? conversion.value : 0
      });
    }
    win.fbq?.("track", "Lead", conversion);
    win.lintrk?.("track", linkedInConversionId ? { conversion_id: linkedInConversionId } : conversion);
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
