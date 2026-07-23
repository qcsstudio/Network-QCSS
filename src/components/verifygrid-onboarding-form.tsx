"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";

type SubmissionResult = { ok?: boolean; error?: string | Record<string, unknown>; message?: string; reference?: string; verificationUrl?: string };

export function VerifyGridOnboardingForm() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SubmissionResult | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setResult(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const payload = Object.fromEntries(form.entries());
    try {
      const response = await fetch("/api/verifygrid/onboarding/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...payload,
          contactConsent: form.get("contactConsent") === "on",
          authorityAcknowledgement: form.get("authorityAcknowledgement") === "on",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
        })
      });
      const body = await response.json() as SubmissionResult;
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Please review the highlighted details and try again.");
      setResult(body);
      formElement.reset();
    } catch (error) {
      setResult({ error: error instanceof Error ? error.message : "Unable to submit this request." });
    } finally {
      setBusy(false);
    }
  }

  if (result?.ok) {
    return (
      <div className="verifygrid-onboarding-success" role="status">
        <CheckCircle2 aria-hidden="true" size={34} />
        <p className="eyebrow">Request received</p>
        <h2>Verify your work email.</h2>
        <p>{result.message}</p>
        {result.reference ? <p className="verifygrid-reference">Reference <strong>{result.reference}</strong></p> : null}
        {result.verificationUrl ? <a className="button secondary" href={result.verificationUrl}>Open development verification link</a> : null}
        <Link className="text-link" href="/portal/access">Already approved? Sign in to VerifyGrid <ArrowRight aria-hidden="true" size={16} /></Link>
      </div>
    );
  }

  return (
    <form className="verifygrid-onboarding-form" onSubmit={submit}>
      <fieldset>
        <legend>Primary contact</legend>
        <div className="verifygrid-form-grid">
          <label><span>Full name</span><input autoComplete="name" name="displayName" required /></label>
          <label><span>Work email</span><input autoComplete="email" name="email" required type="email" /></label>
          <label><span>Phone</span><input autoComplete="tel" name="phone" required type="tel" /></label>
          <label><span>Country code</span><input autoCapitalize="characters" maxLength={2} name="countryCode" pattern="[A-Za-z]{2}" placeholder="IN" /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Organization and assessment</legend>
        <div className="verifygrid-form-grid">
          <label><span>Organization</span><input autoComplete="organization" name="organizationName" required /></label>
          <label><span>Legal name (optional)</span><input name="legalName" /></label>
          <label><span>Assessment type</span><select defaultValue="external_network_vapt" name="serviceType"><option value="external_network_vapt">External network VAPT</option><option value="internal_network_vapt">Internal network VAPT</option><option value="web_and_api_vapt">Web and API VAPT</option><option value="cloud_network_assurance">Cloud network assurance</option><option value="firewall_assurance">Firewall assurance</option><option value="wireless_assessment">Wireless assessment</option><option value="configuration_assurance">Configuration assurance</option><option value="continuous_validation">Continuous validation</option></select></label>
          <label><span>Preferred start (optional)</span><input name="requestedStartAt" type="date" /></label>
          <label className="wide"><span>Environment and objective</span><textarea minLength={40} name="scopeSummary" placeholder="Describe the business objective, environment type, and approximate scope. Do not include passwords or secrets." required rows={4} /></label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Operational contact</legend>
        <div className="verifygrid-form-grid">
          <label><span>Emergency contact</span><input name="emergencyContactName" required /></label>
          <label><span>Emergency email</span><input name="emergencyContactEmail" required type="email" /></label>
        </div>
      </fieldset>

      <div className="verifygrid-form-confirmations">
        <label><input name="authorityAcknowledgement" required type="checkbox" /><span>I understand this request does not authorize testing. Scope, ownership, rules of engagement, and written authorization are completed separately.</span></label>
        <label><input name="contactConsent" required type="checkbox" /><span>I agree that QCS may contact me about this request under the <Link href="/privacy">Privacy Policy</Link>.</span></label>
      </div>
      <label className="verifygrid-honeypot" aria-hidden="true"><span>Website</span><input autoComplete="off" name="website" tabIndex={-1} /></label>
      {result?.error ? <p className="form-note error" role="alert">{String(result.error)}</p> : null}
      <button className="button primary" disabled={busy} type="submit">{busy ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : <ArrowRight aria-hidden="true" size={18} />} {busy ? "Submitting..." : "Verify work email"}</button>
    </form>
  );
}
