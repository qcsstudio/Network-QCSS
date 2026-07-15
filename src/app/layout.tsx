import type { Metadata } from "next";
import Link from "next/link";
import { ConsentBanner } from "@/components/consent-banner";
import { MarketingScripts } from "@/components/marketing-scripts";
import { SiteHeader } from "@/components/site-header";
import { StructuredData } from "@/components/structured-data";
import { siteConfig } from "@/lib/content";
import "./globals.css";

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
      <body>
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
        <footer className="site-footer">
          <div>
            <strong>QuantumCrafters Studio Pvt. Ltd.</strong>
            <p>Network operations, security testing, cloud connectivity, troubleshooting, and practical network security training.</p>
          </div>
          <nav aria-label="Footer links">
            <Link href="/network-tools">Network Tools</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/admin">Admin</Link>
            <a href="/api/health">Health</a>
          </nav>
        </footer>
        <ConsentBanner />
      </body>
    </html>
  );
}
