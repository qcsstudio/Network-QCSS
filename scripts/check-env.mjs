const placeholderValues = [
  "change-this-password",
  "change-this-long-random-secret",
  "change-this-api-token",
  "network.qcss.example",
  "USER:PASSWORD",
  "your-automation-endpoint.example"
];

function envValue(name) {
  return process.env[name]?.trim() || "";
}

function isConfigured(name) {
  const value = envValue(name);
  if (!value) return false;
  return !placeholderValues.some((placeholder) => value.includes(placeholder));
}

function hasAny(names) {
  return names.some(isConfigured);
}

function jsonIsValid(name) {
  const value = envValue(name);
  if (!value) return true;
  try {
    const parsed = JSON.parse(value);
    return Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed));
  } catch {
    return false;
  }
}

function item(key, label, ready, detail, options = {}) {
  return {
    key,
    label,
    status: ready ? "ready" : options.warning ? "warning" : "missing",
    detail,
    required: options.required ?? false
  };
}

function groups() {
  const storeDriver = envValue("STORE_DRIVER") || "file";
  const postgresSelected = storeDriver === "postgres";
  const hubspotMappingValid = jsonIsValid("HUBSPOT_FIELD_MAPPING_JSON");
  const zohoMappingValid = jsonIsValid("ZOHO_FIELD_MAPPING_JSON");

  return [
    {
      label: "Core Deployment",
      items: [
        item("site-url", "Canonical site URL", isConfigured("NEXT_PUBLIC_SITE_URL"), "NEXT_PUBLIC_SITE_URL", { required: true }),
        item("admin-login", "Production admin login", isConfigured("ADMIN_EMAIL") && isConfigured("ADMIN_PASSWORD"), "ADMIN_EMAIL and ADMIN_PASSWORD", {
          required: true
        }),
        item("admin-session", "Stable session secret", isConfigured("ADMIN_SESSION_SECRET"), "ADMIN_SESSION_SECRET", { required: true }),
        item("admin-api-token", "Admin API token", isConfigured("ADMIN_API_TOKEN"), "ADMIN_API_TOKEN", { required: true }),
        item("cron-secret", "Content cron secret", isConfigured("CRON_SECRET"), "CRON_SECRET", { required: true })
      ]
    },
    {
      label: "Database",
      items: [
        item("store-driver", "PostgreSQL store selected", postgresSelected, "STORE_DRIVER=postgres", { required: true }),
        item("database-url", "Database URL", isConfigured("DATABASE_URL"), "DATABASE_URL", { required: true })
      ]
    },
    {
      label: "Growth Tracking",
      items: [
        item("gtm", "Google Tag Manager", isConfigured("NEXT_PUBLIC_GTM_ID"), "NEXT_PUBLIC_GTM_ID", { warning: true }),
        item("ga4", "GA4 measurement", isConfigured("NEXT_PUBLIC_GA_ID"), "NEXT_PUBLIC_GA_ID", { warning: true }),
        item("ads-conversion", "Google Ads conversion", isConfigured("NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO"), "NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO", {
          warning: true
        }),
        item("marketing-pixels", "Retargeting pixels", hasAny(["NEXT_PUBLIC_META_PIXEL_ID", "NEXT_PUBLIC_LINKEDIN_PARTNER_ID"]), "Meta or LinkedIn pixel ID", {
          warning: true
        })
      ]
    },
    {
      label: "Lead Routing",
      items: [
        item("generic-webhook", "Lead webhook", isConfigured("LEAD_WEBHOOK_URL"), "LEAD_WEBHOOK_URL", { warning: true }),
        item("crm", "CRM connector", hasAny(["HUBSPOT_PRIVATE_APP_TOKEN", "ZOHO_ACCESS_TOKEN"]), "HubSpot or Zoho credentials", { warning: true }),
        item("crm-field-mapping", "CRM field mapping JSON", hubspotMappingValid && zohoMappingValid, "HUBSPOT_FIELD_MAPPING_JSON and ZOHO_FIELD_MAPPING_JSON", {
          warning: true
        }),
        item(
          "email-alerts",
          "Email alerts",
          hasAny(["EMAIL_WEBHOOK_URL"]) || (isConfigured("RESEND_API_KEY") && isConfigured("LEAD_ALERT_EMAIL_FROM") && isConfigured("LEAD_ALERT_EMAIL_TO")),
          "EMAIL_WEBHOOK_URL or Resend settings",
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
          "WhatsApp webhook or Cloud API settings",
          { warning: true }
        )
      ]
    },
    {
      label: "Content Distribution",
      items: [
        item(
          "linkedin-publishing",
          "LinkedIn profile publishing",
          isConfigured("LINKEDIN_CLIENT_ID") &&
            isConfigured("LINKEDIN_CLIENT_SECRET") &&
            isConfigured("LINKEDIN_REDIRECT_URI") &&
            isConfigured("LINKEDIN_TOKEN_ENCRYPTION_KEY"),
          "LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI and LINKEDIN_TOKEN_ENCRYPTION_KEY",
          { warning: true }
        ),
        item(
          "whatsapp-editorial",
          "WhatsApp editorial approval",
          isConfigured("WHATSAPP_CONTENT_TEMPLATE_NAME") &&
            isConfigured("WHATSAPP_WEBHOOK_VERIFY_TOKEN") &&
            isConfigured("WHATSAPP_APP_SECRET") &&
            isConfigured("WHATSAPP_APPROVER_NUMBERS"),
          "WhatsApp content template, webhook verification, app secret and approver allowlist",
          { warning: true }
        )
      ]
    }
  ];
}

const allItems = groups().flatMap((group) => group.items.map((entry) => ({ group: group.label, ...entry })));
const ready = allItems.filter((entry) => entry.status === "ready").length;
const blockers = allItems.filter((entry) => entry.required && entry.status !== "ready");
const score = Math.round((ready / allItems.length) * 100);

console.log(`Deployment readiness: ${score}% (${ready}/${allItems.length})`);
for (const entry of allItems) {
  const prefix = entry.status === "ready" ? "OK" : entry.required ? "BLOCKER" : "WARN";
  console.log(`${prefix} ${entry.group}: ${entry.label} - ${entry.detail}`);
}

const strict = process.env.REQUIRE_PRODUCTION_ENV === "true" || process.env.NODE_ENV === "production";
if (strict && blockers.length) {
  console.error(`Missing ${blockers.length} required production setting(s).`);
  process.exit(1);
}
