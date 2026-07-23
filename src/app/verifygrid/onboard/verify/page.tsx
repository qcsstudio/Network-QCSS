import type { Metadata } from "next";
import { VerifyGridOnboardingVerifier } from "@/components/verifygrid-onboarding-verifier";

export const metadata: Metadata = { title: "VerifyGrid Email Verification", robots: { index: false, follow: false } };

export default function VerifyGridOnboardingVerificationPage() {
  return <main className="portal-access-page"><VerifyGridOnboardingVerifier /></main>;
}

