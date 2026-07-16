const isProduction = process.env.NODE_ENV === "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  [
    "script-src",
    "'self'",
    "'unsafe-inline'",
    isProduction ? "" : "'unsafe-eval'",
    "https://www.googletagmanager.com",
    "https://www.google-analytics.com",
    "https://connect.facebook.net",
    "https://snap.licdn.com"
  ]
    .filter(Boolean)
    .join(" "),
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  [
    "img-src",
    "'self'",
    "data:",
    "blob:",
    "https://www.google-analytics.com",
    "https://www.googletagmanager.com",
    "https://www.facebook.com",
    "https://px.ads.linkedin.com"
  ].join(" "),
  [
    "connect-src",
    "'self'",
    isProduction ? "" : "ws: http://localhost:* http://127.0.0.1:*",
    "https://www.google-analytics.com",
    "https://analytics.google.com",
    "https://stats.g.doubleclick.net",
    "https://www.googletagmanager.com",
    "https://connect.facebook.net",
    "https://www.facebook.com",
    "https://px.ads.linkedin.com"
  ]
    .filter(Boolean)
    .join(" "),
  "frame-src 'self' https://www.googletagmanager.com",
  isProduction ? "upgrade-insecure-requests" : ""
]
  .filter(Boolean)
  .join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: process.cwd()
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()"
          },
          ...(isProduction
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload"
                }
              ]
            : [])
        ]
      }
    ];
  }
};

export default nextConfig;
