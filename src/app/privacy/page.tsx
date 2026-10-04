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
        <h2>Microsoft Clarity</h2>
        <p>
          With your Analytics and Session recordings choices enabled, we use Microsoft Clarity to understand how visitors
          use our public business pages through heatmaps and interaction recordings. Clarity processes page views,
          clicks, scrolling, browser and device information, and cookie identifiers. We use these insights to improve
          navigation and enquiry forms, not to identify you personally. QCS sends only a successful-enquiry event name
          to Clarity, not your name, email, phone number, or enquiry text. Lead forms are explicitly masked.
        </p>
        <p>
          We exclude admin and client areas, VerifyGrid, tools, assessments, training and course pages, and visits with
          URL query parameters or sensitive referrers. Recording stops before navigation into an excluded area and stays
          off for the remainder of that page session. QCS keeps Clarity advertising consent denied and does not enable
          its server-log integration. Microsoft processes Clarity data under its own policies; read the{" "}
          <a href="https://privacy.microsoft.com/privacystatement" rel="noopener noreferrer" target="_blank">Microsoft Privacy Statement</a>
          {" "}and{" "}
          <a href="https://learn.microsoft.com/en-us/clarity/setup-and-installation/data-retention" rel="noopener noreferrer" target="_blank">Clarity retention information</a>.
        </p>
        <h2>Admin Audit Logs</h2>
        <p>
          Admin logins, exports, dashboard views, and lead creation events can be recorded for security, troubleshooting,
          and business follow-up accountability.
        </p>
        <h2>Your Choices</h2>
        <p>
          You can decline optional cookies, unsubscribe from marketing messages, and request correction or deletion of
          your contact information. Use Cookie settings in the footer at any time to change or withdraw optional consent.
          Turning off Analytics or Session recordings stops Clarity and removes its first-party cookies. If you enable
          recordings again, they resume on your next full visit to an eligible public page.
        </p>
      </section>
    </main>
  );
}
