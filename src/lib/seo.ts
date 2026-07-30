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
  image?: {
    url: string;
    width: number;
    height: number;
    alt: string;
  };
  article?: {
    publishedTime: string;
    modifiedTime: string;
  };
};

export function createPageMetadata({
  title,
  description,
  path,
  keywords = [],
  noIndex = false,
  image = defaultImage,
  article
}: PageMetadataInput): Metadata {
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
    openGraph: article
      ? {
          title,
          description,
          url: path,
          siteName: siteConfig.name,
          type: "article",
          publishedTime: article.publishedTime,
          modifiedTime: article.modifiedTime,
          authors: [siteConfig.url],
          images: [image]
        }
      : {
          title,
          description,
          url: path,
          siteName: siteConfig.name,
          type: "website",
          images: [image]
        },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url]
    }
  };
}
