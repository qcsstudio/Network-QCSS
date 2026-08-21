"use client";

import { browserSupportsWebAuthn, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { Fingerprint, KeyRound, LockKeyhole, ShieldCheck, TimerReset } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { VerifyGridAccessState } from "@/lib/verifygrid-operator-auth";
import { verifyGridRoleLabel } from "@/lib/verifygrid-operating-model";

async function registerPasskey(label: string) {
  const optionsResponse = await fetch("/api/admin/verifygrid/security", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "registration_options" }),
    cache: "no-store"
  });
  const optionsBody = await optionsResponse.json().catch(() => ({ error: "Passkey enrollment did not return a valid response." }));
  if (!optionsResponse.ok) throw new Error(optionsBody.error || "Passkey enrollment could not start.");
  const credential = await startRegistration({ optionsJSON: optionsBody.options });
  const verifyResponse = await fetch("/api/admin/verifygrid/security", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "registration_verify", response: credential, label }),
    cache: "no-store"
  });
  const verifyBody = await verifyResponse.json().catch(() => ({ error: "Passkey enrollment did not return a valid response." }));
  if (!verifyResponse.ok) throw new Error(verifyBody.error || "Passkey enrollment could not be verified.");
}

async function reverifyPasskey() {
  const optionsResponse = await fetch("/api/admin/verifygrid/security", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "authentication_options" }),
    cache: "no-store"
  });
  const optionsBody = await optionsResponse.json().catch(() => ({ error: "Passkey verification did not return a valid response." }));
  if (!optionsResponse.ok) throw new Error(optionsBody.error || "Passkey verification could not start.");
  const credential = await startAuthentication({ optionsJSON: optionsBody.options });
  const verifyResponse = await fetch("/api/admin/verifygrid/security", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "authentication_verify", response: credential }),
    cache: "no-store"
  });
  const verifyBody = await verifyResponse.json().catch(() => ({ error: "Passkey verification did not return a valid response." }));
  if (!verifyResponse.ok) throw new Error(verifyBody.error || "Passkey verification could not be completed.");
}

export function VerifyGridSecurityBar({ access }: { access: VerifyGridAccessState }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  if (access.state !== "unlocked") return null;

  const operator = access.operator;
  const needsRecoveryKey = access.passkeyCount < 2;

  async function addPasskey() {
    if (!browserSupportsWebAuthn()) {
      setMessage("This browser cannot enroll a WebAuthn passkey.");
      return;
    }
    setBusy("passkey");
    setMessage("");
    try {
      const label = window.prompt("Name this passkey, for example YubiKey 5 NFC or Windows Hello.", "Backup passkey");
      if (label === null) return;
      await registerPasskey(label.trim() || "Backup passkey");
      setMessage("Passkey enrolled. VerifyGrid now has another recovery-safe authentication route.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Passkey enrollment failed.");
    } finally {
      setBusy("");
    }
  }

  async function lock() {
    setBusy("lock");
    setMessage("");
    try {
      const response = await fetch("/api/admin/verifygrid/security", { method: "DELETE", cache: "no-store" });
      if (!response.ok) throw new Error("VerifyGrid could not revoke this operator session.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "VerifyGrid could not be locked.");
      setBusy("");
    }
  }

  async function reverify() {
    if (!browserSupportsWebAuthn()) {
      setMessage("This browser cannot verify a WebAuthn passkey.");
      return;
    }
    setBusy("reverify");
    setMessage("");
    try {
      await reverifyPasskey();
      setMessage("Operator identity refreshed. Critical actions are available for another 10 minutes.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Passkey verification failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="verifygrid-security-bar" aria-label="VerifyGrid operator assurance">
      <div className="verifygrid-security-identity">
        <span className="verifygrid-security-icon"><Fingerprint aria-hidden="true" size={22} /></span>
        <div>
          <p className="eyebrow">Verified operator</p>
          <strong>{operator.displayName}</strong>
          <span>{verifyGridRoleLabel(operator.role)} | {operator.email}</span>
        </div>
      </div>
      <div className="verifygrid-security-controls">
        <span><ShieldCheck aria-hidden="true" size={16} /><b>WebAuthn</b> user verified</span>
        <span><TimerReset aria-hidden="true" size={16} /><b>{access.assurance.idleMinutes} min</b> inactivity</span>
        <span><Fingerprint aria-hidden="true" size={16} /><b>{access.assurance.criticalActionMinutes} min</b> critical-action freshness</span>
        <span className={needsRecoveryKey ? "needs-attention" : ""}><KeyRound aria-hidden="true" size={16} /><b>{access.passkeyCount}</b> passkey{access.passkeyCount === 1 ? "" : "s"}</span>
      </div>
      <div className="verifygrid-security-actions">
        <button className="button primary compact-button" disabled={Boolean(busy)} onClick={reverify} type="button"><Fingerprint aria-hidden="true" size={15} /> {busy === "reverify" ? "Waiting..." : "Reverify"}</button>
        <button className="button secondary compact-button" disabled={Boolean(busy)} onClick={addPasskey} type="button"><KeyRound aria-hidden="true" size={15} /> {busy === "passkey" ? "Waiting..." : "Add passkey"}</button>
        <button aria-label="Lock VerifyGrid" className="icon-button" disabled={Boolean(busy)} onClick={lock} title="Lock VerifyGrid" type="button"><LockKeyhole aria-hidden="true" size={18} /></button>
      </div>
      {needsRecoveryKey ? <p className="verifygrid-security-warning">Enroll a second passkey before relying on this account for production recovery.</p> : null}
      {message ? <p aria-live="polite" className="verifygrid-security-message">{message}</p> : null}
    </section>
  );
}
