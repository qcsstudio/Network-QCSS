"use client";

import { FormEvent, useState } from "react";
import { getStoredConsent } from "@/components/consent-banner";
import { trackBrowserEvent } from "@/lib/client-tracking";

type LeadFormProps = {
  interest?: string;
  pipeline?: string;
  compact?: boolean;
};

function sessionId() {
  const key = "network-qcss-session";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = `sess_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  window.localStorage.setItem(key, created);
  return created;
}

function attribution() {
  const params = new URLSearchParams(window.location.search);
  return {
    source: params.get("utm_source") || document.referrer || "direct",
    medium: params.get("utm_medium") || "none",
    campaign: params.get("utm_campaign") || "none",
    content: params.get("utm_content") || undefined,
    term: params.get("utm_term") || undefined,
    landing: window.location.pathname,
    referrer: document.referrer || undefined
  };
}

export function LeadForm({ interest = "", pipeline, compact = false }: LeadFormProps) {
  const [status, setStatus] = useState("Ready to create a lead profile.");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const score = compact ? 50 : 65;

    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        phone: formData.get("phone"),
        interest: formData.get("interest") || interest,
        challenge: formData.get("challenge"),
        pipeline: pipeline || formData.get("interest") || interest,
        score,
        sessionId: sessionId(),
        attribution: attribution(),
        consent: { ...getStoredConsent(), contact: formData.get("contactConsent") === "on" },
        sourceProfile: { form: compact ? "compact" : "full", score }
      })
    });

    setLoading(false);
    if (response.ok) {
      trackBrowserEvent("generate_lead", {
        pipeline: pipeline || formData.get("interest") || interest,
        interest: formData.get("interest") || interest,
        form_type: compact ? "compact" : "full"
      });
    }

    setStatus(response.ok ? "Lead profile saved. The right follow-up workflow can start now." : "Please check the form fields and consent.");
  }

  return (
    <form className={compact ? "lead-form compact" : "lead-form"} onSubmit={submit}>
      <div className="field-grid">
        <label>
          Name
          <input name="name" required placeholder="Your name" />
        </label>
        <label>
          Work email
          <input name="email" required type="email" placeholder="name@company.com" />
        </label>
        <label>
          WhatsApp / phone
          <input name="phone" required placeholder="+91..." />
        </label>
        <label>
          Interest
          <select name="interest" required defaultValue={interest}>
            <option value="">Select one</option>
            <option>Managed network services</option>
            <option>Network security services</option>
            <option>Cloud network services</option>
            <option>Penetration testing</option>
            <option>Emergency troubleshooting</option>
            <option>Network security training</option>
            <option>Corporate training</option>
          </select>
        </label>
      </div>

      {!compact && (
        <label>
          Current challenge
          <textarea name="challenge" rows={4} placeholder="Tell us what is happening in your network" />
        </label>
      )}

      <label className="consent-line">
        <input name="contactConsent" required type="checkbox" />
        <span>I agree to be contacted about this request and understand my data will be handled according to the privacy policy.</span>
      </label>

      <button className="button primary" disabled={loading} type="submit">
        {loading ? "Saving..." : "Create Lead Profile"}
      </button>
      <p className="form-note" aria-live="polite">
        {status}
      </p>
    </form>
  );
}
