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
        lifecyclestage: "lead"
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
          Description: `${lead.interest} | ${lead.challenge}`.slice(0, 32000)
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

export async function dispatchLeadIntegrations(lead: StoredLead) {
  const jobs = [
    sendGenericWebhook(lead),
    sendHubSpot(lead),
    sendZoho(lead),
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
