"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";

export function EmailTestControl() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  async function testDelivery() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/email/test", { method: "POST" });
      const result = await response.json().catch(() => ({})) as { message?: string; error?: string };
      setOk(response.ok);
      setMessage(result.message || result.error || (response.ok ? "Test email accepted." : "Email test failed."));
    } catch {
      setOk(false);
      setMessage("Unable to reach the email test endpoint.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="email-test-control">
      <button className="button secondary compact-button" disabled={busy} onClick={testDelivery} type="button">
        <MailCheck aria-hidden="true" size={17} /> {busy ? "Testing..." : "Send test email"}
      </button>
      {message ? <span aria-live="polite" className={ok ? "email-test-success" : "email-test-error"}>{message}</span> : null}
    </div>
  );
}
