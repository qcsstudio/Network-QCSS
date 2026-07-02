import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy and consent approach for QuantumCrafters Studio Pvt. Ltd."
};

export default function PrivacyPage() {
  return (
    <main>
      <section className="page-hero">
        <p className="eyebrow">Privacy</p>
        <h1>Consent-aware tracking and lead capture policy.</h1>
        <p>This production draft explains how the website should collect, store, and use visitor and lead data.</p>
      </section>
      <section className="section prose">
        <h2>What We Collect</h2>
        <p>
          We may collect contact details you submit, assessment answers, service interest, page interactions, campaign
          attribution, approximate country, browser details, and server request metadata. IP addresses are converted into
          a one-way hash for operational records.
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
