import type { Metadata } from "next";
import localFont from "next/font/local";
import { ConsentBanner } from "@/components/consent-banner";
import { ExperienceLayer } from "@/components/experience-layer";
import { MarketingScripts } from "@/components/marketing-scripts";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StructuredData } from "@/components/structured-data";
import { siteConfig } from "@/lib/content";
import { createPageMetadata, defaultKeywords } from "@/lib/seo";
import "./globals.css";
import "./visual-refresh.css";
import "./visual-evolution.css";
import "./experience-v2.css";
import "./qcs-theme.css";

const bodyFont = localFont({
  src: "../../public/brand/consulting/geist-latin.woff2",
  weight: "100 900",
  variable: "--font-qcs-sans",
  display: "swap"
});

const techFont = localFont({
  src: "../../public/brand/consulting/geist-mono-latin.woff2",
  weight: "100 900",
  variable: "--font-qcs-mono",
  display: "swap"
});

export const metadata: Metadata = {
  ...createPageMetadata({
    title: siteConfig.title,
    description: siteConfig.description,
    path: "/",
    keywords: defaultKeywords
  }),
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  authors: [{ name: "QuantumCrafters Studio Pvt. Ltd.", url: siteConfig.url }],
  creator: "QuantumCrafters Studio Pvt. Ltd.",
  publisher: "QuantumCrafters Studio Pvt. Ltd.",
  category: "Managed network services and network security",
  icons: {
    icon: [{ url: "/brand/quantumcrafters-logo.png", type: "image/png" }],
    shortcut: "/brand/quantumcrafters-logo.png",
    apple: "/brand/quantumcrafters-logo.png"
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false
  },
  title: {
    default: siteConfig.title,
    template: "%s | QCS"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`qcs-theme ${bodyFont.variable} ${techFont.variable}`}>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <StructuredData
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              "@id": `${siteConfig.url}/#organization`,
              name: siteConfig.name,
              legalName: "QuantumCrafters Studio Private Limited",
              url: siteConfig.url,
              logo: `${siteConfig.url}/brand/quantumcrafters-logo.png`,
              image: `${siteConfig.url}/brand/network-command-hero.png`,
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
              "@id": `${siteConfig.url}/#website`,
              name: siteConfig.name,
              url: siteConfig.url,
              description: siteConfig.description,
              publisher: {
                "@type": "Organization",
                "@id": `${siteConfig.url}/#organization`,
                name: siteConfig.name
              }
            }
          ]}
        />
        <MarketingScripts />
        <SiteHeader />
        <ExperienceLayer />
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
        <SiteFooter />
        <ConsentBanner />
      </body>
    </html>
  );
}
