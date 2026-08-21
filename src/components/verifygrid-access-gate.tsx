"use client";

import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { FileCheck2, Fingerprint, KeyRound, ShieldCheck, TimerReset, UserRoundCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { VerifyGridAccessState } from "@/lib/verifygrid-operator-auth";
import { VERIFYGRID_CRITICAL_REAUTH_MINUTES, VERIFYGRID_SESSION_IDLE_MINUTES, VERIFYGRID_SESSION_MAX_MINUTES, verifyGridRoleLabel } from "@/lib/verifygrid-operating-model";

async function ceremony(action: string, response?: unknown) {
  const result = await fetch("/api/admin/verifygrid/security", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, response }),
    cache: "no-store"
  });
  const body = await result.json().catch(() => ({ error: "VerifyGrid security did not return a valid response." }));
  if (!result.ok) throw new Error(body.error || "VerifyGrid security could not complete the request.");
  return body;
}

export function VerifyGridAccessGate({ access, email }: { access: VerifyGridAccessState; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    access.state === "enrollment_required"
      ? "Register a passkey to bind high-risk operations to your verified identity."
      : access.state === "authentication_required"
        ? "Verify your identity before viewing client scope, evidence, execution, or reports."
        : "A VerifyGrid owner must provision this administrator and assign a least-privilege role."
  );

  if (access.state === "unlocked") return null;

  async function unlock() {
    if (!browserSupportsWebAuthn()) {
      setMessage("This browser does not support passkeys. Use a current Chrome, Edge, Safari, or Firefox release.");
      return;
    }
    setBusy(true);
    try {
      if (access.state === "enrollment_required") {
        const options = await ceremony("registration_options");
        const credential = await startRegistration({ optionsJSON: options.options });
        await ceremony("registration_verify", credential);
      } else {
        const options = await ceremony("authentication_options");
        const credential = await startAuthentication({ optionsJSON: options.options });
        await ceremony("authentication_verify", credential);
      }
      setMessage("Identity verified. Opening the VerifyGrid command workspace.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Passkey verification failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel verifygrid-access-gate">
      <div className="verifygrid-access-intro">
        <div className="verifygrid-access-mark"><Fingerprint aria-hidden="true" size={30} /></div>
        <div className="verifygrid-access-copy">
          <p className="eyebrow">Phishing-resistant operator access</p>
          <h2>Enter the VerifyGrid control plane</h2>
          <p>{message}</p>
          <small>{access.operator?.email || email} {access.operator?.role ? `| ${verifyGridRoleLabel(access.operator.role)}` : "| bootstrap owner"}</small>
        </div>
      </div>
      <ol className="verifygrid-access-contract" aria-label="VerifyGrid access and authority boundaries">
        <li><Fingerprint aria-hidden="true" size={18} /><div><strong>Identity</strong><span>A user-verified WebAuthn passkey proves who is operating.</span></div></li>
        <li><UserRoundCog aria-hidden="true" size={18} /><div><strong>Least privilege</strong><span>The assigned role decides which records and actions are available.</span></div></li>
        <li><TimerReset aria-hidden="true" size={18} /><div><strong>Bounded session</strong><span>{VERIFYGRID_SESSION_IDLE_MINUTES}-minute inactivity, {VERIFYGRID_SESSION_MAX_MINUTES}-minute overall, and {VERIFYGRID_CRITICAL_REAUTH_MINUTES}-minute critical-action limits apply.</span></div></li>
        <li><FileCheck2 aria-hidden="true" size={18} /><div><strong>Separate authority</strong><span>Access never replaces client authorization, exact scope, or execution approval.</span></div></li>
      </ol>
      <div className="verifygrid-access-assurance">
        <span><ShieldCheck aria-hidden="true" size={16} /> AAL2-aligned phishing resistance</span>
        <span><KeyRound aria-hidden="true" size={16} /> {access.passkeyCount || "No"} registered passkey{access.passkeyCount === 1 ? "" : "s"}</span>
      </div>
      {access.state !== "not_provisioned" ? (
        <button className="button primary" disabled={busy} onClick={unlock} type="button">
          <Fingerprint aria-hidden="true" size={18} />
          {busy ? "Waiting for passkey" : access.state === "enrollment_required" ? "Register operator passkey" : "Verify operator identity"}
        </button>
      ) : null}
    </section>
  );
}
