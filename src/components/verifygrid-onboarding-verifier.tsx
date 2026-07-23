"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, ShieldX } from "lucide-react";

type State = "working" | "verified" | "invalid";

export function VerifyGridOnboardingVerifier() {
  const [state, setState] = useState<State>("working");
  const [reference, setReference] = useState("");

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token") || "";
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      const timer = window.setTimeout(() => setState("invalid"), 0);
      return () => window.clearTimeout(timer);
    }
    const controller = new AbortController();
    fetch("/api/verifygrid/onboarding/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      signal: controller.signal
    }).then(async (response) => {
      const result = await response.json() as { reference?: string };
      if (!response.ok) throw new Error("invalid");
      setReference(result.reference || "");
      setState("verified");
    }).catch((error) => {
      if ((error as Error).name !== "AbortError") setState("invalid");
    });
    return () => controller.abort();
  }, []);

  return (
    <section className="portal-access-panel verifygrid-verification-panel">
      {state === "working" ? <><LoaderCircle aria-hidden="true" className="spin" size={34} /><p className="eyebrow">QCS VerifyGrid</p><h1>Verifying your work email</h1><p>The request is being checked against the one-time verification record.</p></> : null}
      {state === "verified" ? <><CheckCircle2 aria-hidden="true" size={34} /><p className="eyebrow">Email verified</p><h1>Your request is ready for QCS review.</h1><p>No security testing is authorized at this stage. QCS will review the request and send a separate workspace link after approval.</p>{reference ? <p className="verifygrid-reference">Reference <strong>{reference}</strong></p> : null}<Link className="button primary" href="/services/penetration-testing">Return to penetration testing</Link></> : null}
      {state === "invalid" ? <><ShieldX aria-hidden="true" size={34} /><p className="eyebrow">Verification unavailable</p><h1>This link is invalid or expired.</h1><p>Start a new onboarding request to receive a fresh single-use link.</p><Link className="button primary" href="/verifygrid/onboard">Restart onboarding</Link></> : null}
    </section>
  );
}
