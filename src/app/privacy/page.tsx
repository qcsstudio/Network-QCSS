import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  title: "Privacy Policy",
  description:
    "Privacy, cookie consent, analytics, lead capture, and visitor tracking policy for QuantumCrafters Studio Pvt. Ltd.",
  path: "/privacy",
  keywords: ["privacy policy", "cookie consent", "website tracking consent"]
});

export default function PrivacyPage() {
  return (
    <main>
      <section className="page-hero">
        <p className="eyebrow">Privacy</p>
        <h1>Consent-aware tracking and lead capture policy.</h1>
        <p>This page explains how QuantumCrafters Studio Pvt. Ltd. collects, stores, and uses website, tool, and lead data.</p>
      </section>
      <section className="section prose">
        <h2>What We Collect</h2>
        <p>
          We may collect contact details you submit, assessment answers, service interest, page interactions, campaign
          attribution, approximate country, browser details, and server request metadata. IP addresses are converted into
          a one-way hash for operational records. Generated passwords and passphrases are returned in the tool response
          and are not used for marketing personalization.
        </p>
        <h2>How Consent Works</h2>
        <p>
          Necessary storage supports basic operation and security. Google consent defaults start denied. Analytics,
          marketing, and personalization tracking run only after you choose those options.
        </p>
        <h2>Marketing Pixels</h2>
        <p>
          Meta Pixel and LinkedIn Insight are loaded only after marketing consent. Google Analytics and Google Tag
          Manager run in consent mode and update storage choices when you save your preferences.
        </p>
        <h2>Email and Identity</h2>
        <p>
          The website cannot read your email from your browser. We receive email or phone information only when you submit
          a form, book a call, download a gated resource, or contact us directly.
        </p>
        <h2>Admin Audit Logs</h2>
        <p>
          Admin logins, exports, dashboard views, and lead creation events can be recorded for security, troubleshooting,
          and business follow-up accountability.
        </p>
        <h2>Your Choices</h2>
        <p>
          You can decline optional cookies, unsubscribe from marketing messages, and request correction or deletion of
          your contact information.
        </p>
      </section>
    </main>
  );
}
