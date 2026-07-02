import type { StoredLead } from "@/lib/types";

type IntegrationResult = {
  name: string;
  skipped: boolean;
  ok: boolean;
  status?: number;
  error?: string;
};

const timeoutMs = 8000;

async function postJson(name: string, url: string, headers: HeadersInit, body: unknown): Promise<IntegrationResult> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs)
    });

    return {
      name,
      skipped: false,
      ok: response.ok,
      status: response.status,
      error: response.ok ? undefined : await response.text()
    };
  } catch (error) {
    return {
      name,
      skipped: false,
      ok: false,
      error: error instanceof Error ? error.message : "Unknown integration error"
    };
  }
}

function skipped(name: string): IntegrationResult {
  return { name, skipped: true, ok: true };
}

function leadPayload(lead: StoredLead) {
  return {
    id: lead.id,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    interest: lead.interest,
    challenge: lead.challenge,
    pipeline: lead.pipeline,
    score: lead.score,
    priority: lead.priority,
    country: lead.country,
    attribution: lead.attribution,
    createdAt: lead.createdAt
  };
}

const leadFieldReaders: Record<string, (lead: StoredLead) => unknown> = {
  id: (lead) => lead.id,
  name: (lead) => lead.name,
  email: (lead) => lead.email,
  phone: (lead) => lead.phone,
  interest: (lead) => lead.interest,
  challenge: (lead) => lead.challenge,
  pipeline: (lead) => lead.pipeline,
  score: (lead) => lead.score,
  priority: (lead) => lead.priority,
  stage: (lead) => lead.stage,
  country: (lead) => lead.country,
  source: (lead) => lead.attribution.source || "direct",
  medium: (lead) => lead.attribution.medium || "",
  campaign: (lead) => lead.attribution.campaign || "",
  landing: (lead) => lead.attribution.landing || "",
  referrer: (lead) => lead.attribution.referrer || "",
  createdAt: (lead) => lead.createdAt
};

function parseFieldMapping(envName: string) {
  const value = process.env[envName];
  if (!value) return {};

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([, crmField]) => typeof crmField === "string" && crmField.trim())
    ) as Record<string, string>;
  } catch (error) {
    console.error(`Invalid ${envName}. Expected a JSON object that maps lead fields to CRM fields.`, error);
    return {};
  }
}

function mappedLeadFields(lead: StoredLead, envName: string) {
  const mapping = parseFieldMapping(envName);
  const fields: Record<string, string | number | boolean> = {};

  for (const [leadField, crmField] of Object.entries(mapping)) {
    const reader = leadFieldReaders[leadField];
    if (!reader) continue;
    const value = reader(lead);
    if (value === undefined || value === null || value === "") continue;
    fields[crmField] = typeof value === "object" ? JSON.stringify(value) : (value as string | number | boolean);
  }

  return fields;
}

async function sendGenericWebhook(lead: StoredLead) {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return skipped("lead-webhook");
  return postJson("lead-webhook", url, {}, { event: "lead.created", lead: leadPayload(lead) });
}

async function sendHubSpot(lead: StoredLead) {
  const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
  if (!token) return skipped("hubspot");

  const [firstName, ...lastNameParts] = lead.name.split(" ");
  return postJson(
    "hubspot",
    "https://api.hubapi.com/crm/v3/objects/contacts",
    { Authorization: `Bearer ${token}` },
    {
      properties: {
        email: lead.email,
        firstname: firstName,
        lastname: lastNameParts.join(" "),
        phone: lead.phone,
        lifecyclestage: "lead",
        ...mappedLeadFields(lead, "HUBSPOT_FIELD_MAPPING_JSON")
      }
    }
  );
}

async function sendZoho(lead: StoredLead) {
  const token = process.env.ZOHO_ACCESS_TOKEN;
  const endpoint = process.env.ZOHO_CRM_LEADS_URL;
  if (!token || !endpoint) return skipped("zoho");

  return postJson(
    "zoho",
    endpoint,
    { Authorization: `Zoho-oauthtoken ${token}` },
    {
      data: [
        {
          Last_Name: lead.name,
          Email: lead.email,
          Phone: lead.phone,
          Lead_Source: lead.attribution.source || "Website",
          Description: `${lead.interest} | ${lead.challenge}`.slice(0, 32000),
          ...mappedLeadFields(lead, "ZOHO_FIELD_MAPPING_JSON")
        }
      ]
    }
  );
}

async function sendWhatsAppWebhook(lead: StoredLead) {
  const url = process.env.WHATSAPP_WEBHOOK_URL;
  if (!url) return skipped("whatsapp-webhook");

  return postJson("whatsapp-webhook", url, {}, {
    event: "hot_lead",
    message: `New ${lead.priority} lead: ${lead.name} (${lead.phone}) for ${lead.pipeline}. Score: ${lead.score}`,
    lead: leadPayload(lead)
  });
}

async function sendWhatsAppCloudApi(lead: StoredLead) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const alertTo = process.env.WHATSAPP_ALERT_TO;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  if (!token || !phoneNumberId || !alertTo || !templateName) return skipped("whatsapp-cloud-api");

  const version = process.env.WHATSAPP_API_VERSION || "v23.0";
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US";
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  return postJson(
    "whatsapp-cloud-api",
    url,
    { Authorization: `Bearer ${token}` },
    {
      messaging_product: "whatsapp",
      to: alertTo,
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: lead.name },
              { type: "text", text: lead.phone },
              { type: "text", text: lead.pipeline },
              { type: "text", text: String(lead.score) }
            ]
          }
        ]
      }
    }
  );
}

async function sendEmailWebhook(lead: StoredLead) {
  const url = process.env.EMAIL_WEBHOOK_URL;
  if (!url) return skipped("email-webhook");
  return postJson("email-webhook", url, {}, {
    event: "lead.created",
    subject: `New ${lead.priority} lead: ${lead.pipeline}`,
    lead: leadPayload(lead)
  });
}

async function sendResendEmail(lead: StoredLead) {
  const token = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_ALERT_EMAIL_FROM;
  const to = process.env.LEAD_ALERT_EMAIL_TO;
  if (!token || !from || !to) return skipped("resend-email");

  return postJson(
    "resend-email",
    "https://api.resend.com/emails",
    { Authorization: `Bearer ${token}` },
    {
      from,
      to: to.split(",").map((email) => email.trim()),
      subject: `New ${lead.priority} lead: ${lead.pipeline}`,
      text: [
        `Name: ${lead.name}`,
        `Email: ${lead.email}`,
        `Phone: ${lead.phone}`,
        `Interest: ${lead.interest}`,
        `Pipeline: ${lead.pipeline}`,
        `Score: ${lead.score}`,
        `Priority: ${lead.priority}`,
        `Country: ${lead.country}`,
        `Challenge: ${lead.challenge || "None provided"}`
      ].join("\n")
    }
  );
}

export async function dispatchLeadIntegrations(lead: StoredLead) {
  const jobs = [
    sendGenericWebhook(lead),
    sendHubSpot(lead),
    sendZoho(lead),
    sendEmailWebhook(lead),
    lead.priority === "hot" ? sendResendEmail(lead) : Promise.resolve(skipped("resend-email")),
    sendWhatsAppWebhook(lead),
    lead.priority === "hot" ? sendWhatsAppCloudApi(lead) : Promise.resolve(skipped("whatsapp-cloud-api"))
  ];

  const results = await Promise.all(jobs);
  const failures = results.filter((result) => !result.ok);
  if (failures.length) {
    console.error("Lead integration failures", failures);
  }

  return results;
}
