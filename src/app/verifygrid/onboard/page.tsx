import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { VerifyGridOnboardingForm } from "@/components/verifygrid-onboarding-form";

export const metadata: Metadata = {
  title: "VerifyGrid Client Onboarding",
  description: "Begin an approval-gated QCS penetration testing or security assurance workspace request.",
  robots: { index: false, follow: false }
};

export default function VerifyGridOnboardingPage() {
  return (
    <main className="verifygrid-onboard-page">
      <section className="verifygrid-onboard-intro">
        <div>
          <p className="eyebrow">QCS VerifyGrid client onboarding</p>
          <h1>Open a controlled security assurance workspace.</h1>
          <p>Start with verified ownership and operational context. QCS reviews every request before workspace access is issued.</p>
          <div className="verifygrid-onboard-steps" aria-label="Onboarding controls">
            <div><KeyRound aria-hidden="true" size={20} /><span><strong>1. Verify</strong>Work email</span></div>
            <div><ShieldCheck aria-hidden="true" size={20} /><span><strong>2. Review</strong>QCS approval</span></div>
            <div><LockKeyhole aria-hidden="true" size={20} /><span><strong>3. Authorize</strong>Scope and rules</span></div>
          </div>
          <p className="verifygrid-assurance-note"><CheckCircle2 aria-hidden="true" size={18} /> No targets are tested from this form. Execution remains blocked until scope ownership and written authorization are current.</p>
          <Link className="text-link" href="/portal/access">Already have workspace access? Sign in</Link>
        </div>
        <VerifyGridOnboardingForm />
      </section>
    </main>
  );
}

