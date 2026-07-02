import type { Metadata } from "next";
import { ConsentBanner } from "@/components/consent-banner";
import { MarketingScripts } from "@/components/marketing-scripts";
import { SiteHeader } from "@/components/site-header";
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
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <MarketingScripts />
        <SiteHeader />
        {children}
        <footer className="site-footer">
          <div>
            <strong>QuantumCrafters Studio Pvt. Ltd.</strong>
            <p>Network operations, security testing, cloud connectivity, troubleshooting, and practical network security training.</p>
          </div>
          <nav aria-label="Footer links">
            <a href="/privacy">Privacy</a>
            <a href="/admin">Admin</a>
            <a href="/api/health">Health</a>
          </nav>
        </footer>
        <ConsentBanner />
      </body>
    </html>
  );
}
