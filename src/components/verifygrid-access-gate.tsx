"use client";

import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, KeyRound, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type AccessState = {
  state: "enrollment_required" | "authentication_required" | "not_provisioned";
  passkeyCount: number;
  operator: { email: string; displayName: string; role: string } | null;
};

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

export function VerifyGridAccessGate({ access, email }: { access: AccessState; email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    access.state === "enrollment_required"
      ? "Register a passkey to bind high-risk operations to your verified identity."
      : access.state === "authentication_required"
        ? "Use your registered passkey to open a two-hour operator session."
        : "This administrator has not been provisioned as a VerifyGrid operator."
  );

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
      <div className="verifygrid-access-mark"><Fingerprint aria-hidden="true" size={30} /></div>
      <div className="verifygrid-access-copy">
        <p className="eyebrow">Phishing-resistant operator access</p>
        <h2>Unlock VerifyGrid security operations</h2>
        <p>{message}</p>
        <div className="verifygrid-access-facts">
          <span><ShieldCheck aria-hidden="true" size={16} /> Role-bound actions</span>
          <span><KeyRound aria-hidden="true" size={16} /> Revocable two-hour session</span>
          <span><Fingerprint aria-hidden="true" size={16} /> {access.passkeyCount || "No"} registered passkey{access.passkeyCount === 1 ? "" : "s"}</span>
        </div>
        <small>{access.operator?.email || email} {access.operator?.role ? `| ${access.operator.role}` : "| bootstrap owner"}</small>
      </div>
      {access.state !== "not_provisioned" ? (
        <button className="button primary" disabled={busy} onClick={unlock} type="button">
          <Fingerprint aria-hidden="true" size={18} />
          {busy ? "Waiting for passkey" : access.state === "enrollment_required" ? "Register passkey" : "Verify identity"}
        </button>
      ) : null}
    </section>
  );
}
