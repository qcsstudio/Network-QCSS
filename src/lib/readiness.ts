import type { DeploymentReadiness, ReadinessGroup, ReadinessItem, ReadinessStatus } from "@/lib/types";

const placeholderValues = [
  "change-this-password",
  "change-this-long-random-secret",
  "change-this-api-token",
  "network.qcss.example",
  "USER:PASSWORD",
  "your-automation-endpoint.example"
];

function envValue(name: string) {
  return process.env[name]?.trim() || "";
}

function isConfigured(name: string) {
  const value = envValue(name);
  if (!value) return false;
  return !placeholderValues.some((placeholder) => value.includes(placeholder));
}

function hasAny(names: string[]) {
  return names.some(isConfigured);
}

function jsonIsValid(name: string) {
  const value = envValue(name);
  if (!value) return true;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed));
  } catch {
    return false;
  }
}

function item(
  key: string,
  label: string,
  ready: boolean,
  detail: string,
  options: { required?: boolean; warning?: boolean } = {}
): ReadinessItem {
  const status: ReadinessStatus = ready ? "ready" : options.warning ? "warning" : "missing";
  return {
    key,
    label,
    status,
    detail,
    required: options.required ?? false
  };
}

function buildGroups(): ReadinessGroup[] {
  const storeDriver = envValue("STORE_DRIVER") || "file";
  const postgresSelected = storeDriver === "postgres";
  const hubspotMappingValid = jsonIsValid("HUBSPOT_FIELD_MAPPING_JSON");
  const zohoMappingValid = jsonIsValid("ZOHO_FIELD_MAPPING_JSON");

  return [
    {
      key: "core",
      label: "Core Deployment",
      items: [
        item("site-url", "Canonical site URL", isConfigured("NEXT_PUBLIC_SITE_URL"), "Used for metadata, sitemap, and absolute URLs.", {
          required: true
        }),
        item("admin-login", "Production admin login", isConfigured("ADMIN_EMAIL") && isConfigured("ADMIN_PASSWORD"), "Required before admin login works in production.", {
          required: true
        }),
        item("admin-session", "Stable session secret", isConfigured("ADMIN_SESSION_SECRET"), "Keeps admin cookies valid across deploys.", {
          required: true
        }),
        item("admin-api-token", "Admin API token", isConfigured("ADMIN_API_TOKEN"), "Protects server-to-server dashboard and export access.", {
          required: true
        }),
        item("cron-secret", "Content cron secret", isConfigured("CRON_SECRET"), "Protects twice-weekly blog topic radar scans.", {
          required: true
        })
      ]
    },
    {
      key: "database",
      label: "Database",
      items: [
        item("store-driver", "PostgreSQL store selected", postgresSelected, `Current STORE_DRIVER is ${storeDriver}.`, {
          required: true
        }),
        item("database-url", "Database URL", isConfigured("DATABASE_URL"), "Required when STORE_DRIVER=postgres.", {
          required: true
        })
      ]
    },
    {
      key: "growth",
      label: "Growth Tracking",
      items: [
        item("gtm", "Google Tag Manager", isConfigured("NEXT_PUBLIC_GTM_ID"), "Recommended container for Ads, GA4, and remarketing tags.", {
          warning: true
        }),
        item("ga4", "GA4 measurement", isConfigured("NEXT_PUBLIC_GA_ID"), "Captures consent-aware analytics events.", {
          warning: true
        }),
        item(
          "ads-conversion",
          "Google Ads conversion",
          isConfigured("NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO"),
          "Maps generate_lead to a Google Ads conversion action.",
          { warning: true }
        ),
        item(
          "marketing-pixels",
          "Retargeting pixels",
          hasAny(["NEXT_PUBLIC_META_PIXEL_ID", "NEXT_PUBLIC_LINKEDIN_PARTNER_ID"]),
          "Meta and LinkedIn load only after marketing consent.",
          { warning: true }
        )
      ]
    },
    {
      key: "lead-routing",
      label: "Lead Routing",
      items: [
        item("generic-webhook", "Lead webhook", isConfigured("LEAD_WEBHOOK_URL"), "Can feed Zapier, Make, n8n, or a custom backend.", {
          warning: true
        }),
        item("crm", "CRM connector", hasAny(["HUBSPOT_PRIVATE_APP_TOKEN", "ZOHO_ACCESS_TOKEN"]), "Routes leads into HubSpot or Zoho.", {
          warning: true
        }),
        item(
          "crm-field-mapping",
          "CRM field mapping JSON",
          hubspotMappingValid && zohoMappingValid,
          "Optional mappings must be valid JSON objects when configured.",
          { warning: true }
        ),
        item(
          "email-alerts",
          "Email alerts",
          hasAny(["EMAIL_WEBHOOK_URL"]) || (isConfigured("RESEND_API_KEY") && isConfigured("LEAD_ALERT_EMAIL_FROM") && isConfigured("LEAD_ALERT_EMAIL_TO")),
          "Sends lead alerts through webhook or Resend.",
          { warning: true }
        ),
        item(
          "whatsapp-alerts",
          "WhatsApp alerts",
          hasAny(["WHATSAPP_WEBHOOK_URL"]) ||
            (isConfigured("WHATSAPP_ACCESS_TOKEN") &&
              isConfigured("WHATSAPP_PHONE_NUMBER_ID") &&
              isConfigured("WHATSAPP_ALERT_TO") &&
              isConfigured("WHATSAPP_TEMPLATE_NAME")),
          "Sends hot-lead notifications through webhook or WhatsApp Cloud API.",
          { warning: true }
        )
      ]
    }
  ];
}

export function getDeploymentReadiness(): DeploymentReadiness {
  const groups = buildGroups();
  const items = groups.flatMap((group) => group.items);
  const ready = items.filter((entry) => entry.status === "ready").length;
  const blockers = items.filter((entry) => entry.required && entry.status !== "ready").length;

  return {
    score: Math.round((ready / items.length) * 100),
    ready,
    total: items.length,
    blockers,
    groups,
    updatedAt: new Date().toISOString()
  };
}
