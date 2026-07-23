"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { KeyRound, LoaderCircle, Mail } from "lucide-react";

export function PortalAccessForm() {
  const tokenInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const supplied = fragment.get("token") || "";
    if (supplied && tokenInput.current) {
      tokenInput.current.value = supplied;
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  async function requestLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/portal/request-link", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: form.get("email") }) });
      const result = await response.json() as { message?: string };
      setMessage(result.message || "If an eligible workspace membership exists, a one-time sign-in link will be sent.");
      formElement.reset();
    } catch {
      setMessage("If an eligible workspace membership exists, a one-time sign-in link will be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="portal-access-methods">
      <form onSubmit={requestLink}>
        <label><span>Approved work email</span><input autoComplete="email" name="email" required type="email" /></label>
        <button className="button primary" disabled={busy} type="submit">{busy ? <LoaderCircle aria-hidden="true" className="spin" size={17} /> : <Mail aria-hidden="true" size={17} />} Email sign-in link</button>
        {message ? <p aria-live="polite" className="form-note">{message}</p> : null}
      </form>
      <div className="portal-access-divider"><span>or use a supplied link</span></div>
      <form action="/api/portal/access" method="post">
        <label><span>One-time access token</span><input autoComplete="off" name="token" ref={tokenInput} required type="password" /></label>
        <button className="button secondary" type="submit"><KeyRound aria-hidden="true" size={17} /> Open workspace</button>
      </form>
      <p className="portal-onboarding-link">New client? <Link href="/verifygrid/onboard">Begin onboarding</Link></p>
    </div>
  );
}
