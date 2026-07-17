import type { Metadata } from "next";
import { siteConfig } from "@/lib/content";

const defaultImage = {
  url: "/brand/network-command-hero.png",
  width: 1807,
  height: 870,
  alt: "QuantumCrafters Studio network command center"
};

export const defaultKeywords = [
  "network administration",
  "network security",
  "managed network services",
  "cloud network services",
  "network troubleshooting",
  "penetration testing",
  "network security institute",
  "India network services",
  "global network security services"
];

type PageMetadataInput = {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
  noIndex?: boolean;
};

export function createPageMetadata({ title, description, path, keywords = [], noIndex = false }: PageMetadataInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    keywords: [...new Set([...keywords, ...defaultKeywords])],
    robots: noIndex
      ? { index: false, follow: false }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1
          }
        },
    openGraph: {
      title,
      description,
      url: path,
      siteName: siteConfig.name,
      type: "website",
      images: [defaultImage]
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [defaultImage.url]
    }
  };
}
