/* eslint-disable @next/next/no-html-link-for-pages -- Exit the private analysis document with a full navigation. */
import { NetworkToolkit } from "@/components/network-toolkit";
import { StructuredData } from "@/components/structured-data";
import { createPageMetadata } from "@/lib/seo";
import styles from "@/components/network-toolkit.module.css";

export const metadata = createPageMetadata({ title: "QCS Network & Security Toolkit", description: "Understand network parameters, compare settings and investigate connections with clear explanations, diagrams and diagnostics from your computer. Your inputs stay on your device.", path: "/network-tools/toolkit", keywords: ["local network toolkit", "network parameter explanations", "VPN evidence analysis", "browser local network tools"] });

export default function ToolkitPage() {
  return <main className={styles.page}>
    <StructuredData data={{ "@context": "https://schema.org", "@type": "WebApplication", name: "QCS Network & Security Toolkit", applicationCategory: "NetworkApplication", operatingSystem: "Web", url: "https://www.qcsstudio.com/network-tools/toolkit", offers: { "@type": "Offer", price: "0", priceCurrency: "INR" }, description: "Browser-local parameter calculations and optional evidence analysis. Live probes require a separate, manually executed Node.js runner." }} />
    <header className={styles.pageHeading}><a href="/network-tools">Network tools</a><h1>QCS Network &amp; Security Toolkit</h1></header>
    <NetworkToolkit />
    <section className={styles.footnote}><h2>Privacy and responsible use</h2><p>Your inputs and imported files are analyzed on this device. They are not uploaded or saved by the toolkit. The website still loads its pages and assets normally. Clear the workspace when finished and review reports before sharing. Browser extensions and your device remain outside QCS control.</p><p>Live diagnostics send the test traffic you approve from your computer. You must run each request yourself and confirm its target. The runner saves results locally; it does not upload reports, scan address ranges or change device settings. Verify product-specific behavior and supporting evidence before making operational changes.</p></section>
  </main>;
}
