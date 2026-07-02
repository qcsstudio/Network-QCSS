// Next.js ka Metadata API import
import { MetadataRoute } from "next";

/**
 * Ye function /robots.txt generate karta hai
 * Ye SERVER par run hota hai (client side nahi)
 */
export default function robots() {
  return {
    // 🔹 Search engines ke liye rules
    rules: [
      {
        // "*" = sab search engines (Google, Bing, etc.)
        userAgent: "*",

        // Public website ko crawl karne do
        allow: "/",

        // Private / sensitive pages ko crawl se roko
        // disallow: [
        //   "/dashboard",
        //   "/login",
        //   "/register",
        //   "/settings",
        //   "/admin",
        //   "/api",       
        // ],
      },
    ],

    // 🔹 Sitemap ka exact location
    sitemap: "https://www.qcsstudio.com/sitemap.xml", // 
  };
}
