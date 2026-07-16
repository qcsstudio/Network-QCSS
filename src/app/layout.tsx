import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Orbitron, Rajdhani, Space_Grotesk } from "next/font/google";
import { ConsentBanner } from "@/components/consent-banner";
import { MarketingScripts } from "@/components/marketing-scripts";
import { SiteHeader } from "@/components/site-header";
import { StructuredData } from "@/components/structured-data";
import { siteConfig } from "@/lib/content";
import "./globals.css";

const displayFont = Orbitron({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap"
});

const bodyFont = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap"
});

const techFont = Rajdhani({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-tech",
  display: "swap"
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`
  },
  description: siteConfig.description,
  openGraph: {
    title: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    siteName: siteConfig.name,
    type: "website",
    images: [
      {
        url: "/brand/network-command-hero.png",
        width: 1807,
        height: 870,
        alt: "QuantumCrafters Studio network command center"
      }
    ]
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable} ${techFont.variable}`}>
        <StructuredData
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              name: siteConfig.name,
              legalName: "QuantumCrafters Studio Private Limited",
              url: siteConfig.url,
              logo: `${siteConfig.url}/brand/quantumcrafters-logo.png`,
              description: siteConfig.description,
              areaServed: ["India", "Global"],
              knowsAbout: [
                "Managed Network Services",
                "Network Security",
                "SASE Readiness",
                "Zero Trust Network Access",
                "SD-WAN",
                "Network as a Service",
                "Cloud Networking",
                "Penetration Testing",
                "Network Troubleshooting",
                "Network Security Training"
              ]
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: siteConfig.name,
              url: siteConfig.url,
              description: siteConfig.description,
              publisher: {
                "@type": "Organization",
                name: siteConfig.name
              }
            }
          ]}
        />
        <MarketingScripts />
        <SiteHeader />
        {children}
        <footer className="site-footer command-footer">
          <div className="footer-command-panel">
            <div className="footer-brand-stack">
              <Image
                className="footer-logo"
                src="/brand/quantumcrafters-logo.png"
                alt="QuantumCrafters Studio Pvt. Ltd."
                width={328}
                height={100}
              />
              <strong>QuantumCrafters Studio Pvt. Ltd.</strong>
              <p>Evidence-first network command, security, cloud, troubleshooting, tools, and practical network security training.</p>
              <div className="footer-signal-row" aria-label="QuantumCrafters operating signals">
                <span>Managed Network</span>
                <span>Network Security</span>
                <span>Cloud Network</span>
                <span>Institute</span>
              </div>
            </div>

            <nav className="footer-link-grid" aria-label="Footer links">
              <div>
                <span>Explore</span>
                <Link href="/solutions">Solutions</Link>
                <Link href="/#services">Services</Link>
                <Link href="/network-tools">Network Tools</Link>
              </div>
              <div>
                <span>Decide</span>
                <Link href="/diagnose">Assessments</Link>
                <Link href="/resources">Resources</Link>
                <Link href="/institute">Institute</Link>
              </div>
              <div>
                <span>System</span>
                <Link href="/privacy">Privacy</Link>
                <Link href="/admin">Admin</Link>
                <a href="/api/health">Health</a>
              </div>
            </nav>

            <div className="footer-action-panel">
              <p className="eyebrow">Command handoff</p>
              <h2>Start with a readiness snapshot.</h2>
              <p>Share the symptom, exposure, project, or training goal and move toward a clearer next step.</p>
              <div className="button-row">
                <Link className="button primary" href="/diagnose">
                  Run Assessment
                </Link>
                <Link className="button secondary dark" href="/network-tools">
                  Open Tools
                </Link>
              </div>
            </div>
          </div>
          <div className="footer-bottom-bar">
            <span>QCS Network Command</span>
            <span>Operate + Secure + Modernize + Train</span>
          </div>
        </footer>
        <ConsentBanner />
      </body>
    </html>
  );
}
