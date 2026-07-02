// Next.js ke built-in type import (JS me bhi kaam karta hai)
import { MetadataRoute } from "next";

/**
 * Ye function automatically /sitemap.xml generate karta hai
 * Ye SERVER par run hota hai (client par nahi)
 */
export default function sitemap() {
  // 🔹 Apni website ka base URL
  const baseUrl = "https://www.qcsstudio.com"; 

  /**
   * Yahan hum public pages define karte hain
   * Sirf wahi pages jo Google ko dikhane hain
   */
  return [
    {
      url: baseUrl,               // Home page
      lastModified: new Date(),   // Last update date
      changeFrequency: "daily",   // Google ko hint
      priority: 1,                // Most important
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/linkedIn-Profile-Makeover`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/linkedin-profile-audit`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/network-support-services`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.6,
    },
  ];
}
