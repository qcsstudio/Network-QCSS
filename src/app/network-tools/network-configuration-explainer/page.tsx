import Link from "next/link";
import { ConfigLens } from "@/components/config-lens";
import { StructuredData } from "@/components/structured-data";
import { createPageMetadata } from "@/lib/seo";
import { LENS_PATH } from "@/lib/config-lens/catalog";
import styles from "@/components/config-lens.module.css";

export const metadata = createPageMetadata({ title: "Network Configuration Explainer | Cisco and Fortinet", description: "Understand Cisco and Fortinet text configurations with free browser-local explanations, configured relationships and secret masking. No configuration upload or paid AI API.", path: LENS_PATH, keywords: ["network configuration explainer", "Cisco configuration explained", "FortiGate configuration analyzer", "FortiWeb configuration", "local configuration analysis"] });

export default function ConfigLensPage() {
  return <main className={styles.page}>
    <StructuredData data={{ "@context": "https://schema.org", "@type": "WebApplication", name: "QCS Config Lens", applicationCategory: "NetworkApplication", operatingSystem: "Web", url: `https://www.qcsstudio.com${LENS_PATH}`, offers: { "@type": "Offer", price: "0", priceCurrency: "INR" }, description: "Browser-local explanation of supported Cisco and Fortinet text configurations. Read-only; no runtime or vulnerability verification." }} />
    <header className={styles.heading}><Link href="/network-tools">Network tools</Link><h1>QCS Config Lens</h1><p>Understand what your network configuration says. Explore ports, networks, policies and their relationships in plain English, with the original statements beside each explanation.</p></header>
    <ConfigLens />
    <section className={styles.faq} aria-label="Configuration analysis questions">
      <details><summary>Which devices and commands are supported?</summary><p>Version 1 covers selected common statements for Cisco routers and Catalyst switches using IOS/IOS XE, Nexus using NX-OS, ASA and partial FTD diagnostic output, plus FortiGate, FortiWeb and standalone FortiSwitch. The selected profile describes its scope. Every unrecognized statement is marked for review. This is not universal support for every device, OS release or feature.</p></details>
      <details><summary>Does my configuration leave the browser?</summary><p>The analysis worker runs on this device and makes no API calls. Configuration text is not submitted, stored in a database or saved to browser storage. The website and its assets still load normally. Clear the workspace when finished and review downloaded files before sharing. Browser extensions and your device remain outside QCS control.</p></details>
      <details><summary>Can I use the results to make changes?</summary><p>Use them to understand and review settings, not as automatic change instructions. The diagram shows parsed configuration references, not physical cabling or tested traffic. A qualified operator must verify vendor documentation, runtime evidence, authorization, backups and rollback before changing a device. Masked text is not a restorable backup.</p></details>
      <details><summary>Does this find every vulnerability?</summary><p>No. The tool flags selected configuration-review points, not a complete vulnerability or compliance assessment. Firmware advisories need exact product, version and feature applicability checks. The admin update desk checks official sources separately and never receives visitor configurations.</p></details>
    </section>
  </main>;
}
