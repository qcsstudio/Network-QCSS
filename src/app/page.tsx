import Link from "next/link";
import { Suspense } from "react";
import { HomeContent } from "@/components/consulting-home/home-content";
import { StructuredData } from "@/components/structured-data";
import { listSecurityAdvisories } from "@/lib/advisories";
import { createPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/lib/content";
import "@/components/consulting-home/home.css";
import "@/components/consulting-home/production.css";

export const revalidate = 300;

export const metadata = createPageMetadata({
  title: "Network, Security & Cloud Consulting",
  description:
    "QCS helps businesses in India and internationally troubleshoot networks, review security and connect cloud environments. Explore services and discuss your project.",
  path: "/",
  image: {
    url: "/brand/consulting/network-architecture-v2.webp",
    width: 1774,
    height: 887,
    alt: "QCS network, security and cloud consulting",
  },
});

async function LatestAdvisories() {
  const advisories = await listSecurityAdvisories(3).catch(() => []);
  if (!advisories.length) return null;
  return (
    <>
      <p className="eyebrow">From the security advisory desk</p>
      <div className="latest-advisory-links">
        {advisories.map((advisory) => (
          <Link
            key={advisory.id}
            href={`/security-advisories/${advisory.slug}`}
          >
            <span>{advisory.severity}</span>
            <strong>{advisory.title}</strong>
          </Link>
        ))}
      </div>
    </>
  );
}

export default function HomePage() {
  return (
    <>
      <StructuredData
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": `${siteConfig.url}/#consulting`,
          url: siteConfig.url,
          name: "QCS Network, Security & Cloud Consulting",
          description:
            "Network troubleshooting, security reviews, authorized penetration testing and cloud connectivity for businesses in India and internationally.",
          isPartOf: { "@id": `${siteConfig.url}/#website` },
          about: { "@id": `${siteConfig.url}/#organization` },
          mainEntity: {
            "@type": "ItemList",
            name: "QCS consulting services",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Managed network services",
                url: `${siteConfig.url}/services/managed-network-services`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Network security services",
                url: `${siteConfig.url}/services/network-security-services`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: "Cloud network services",
                url: `${siteConfig.url}/services/cloud-network-services`,
              },
              {
                "@type": "ListItem",
                position: 4,
                name: "Penetration testing",
                url: `${siteConfig.url}/services/penetration-testing`,
              },
            ],
          },
        }}
      />
      <HomeContent>
        <Suspense fallback={null}>
          <LatestAdvisories />
        </Suspense>
      </HomeContent>
    </>
  );
}
