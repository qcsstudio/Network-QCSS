const isProduction = process.env.NODE_ENV === "production";

const legacyToolRedirects = [
  ["/network-tools/security-headers-analyzer", "/network-tools/http-header-check"],
  ["/network-tools/port-reachability-scanner", "/network-tools/port-check"],
  ["/network-tools/cloud-ip-range-finder", "/network-tools/cloud-ip-range-lookup"],
  ["/network-tools/dns-record-inspector", "/network-tools/dns-lookup"],
  ["/network-tools/public-ip-reputation-check", "/network-tools/ip-reputation-abuse-check"],
  ["/network-tools/bgp-route-anomaly-checker", "/network-tools/bgp-route-anomaly-check"],
  ["/network-tools/global-traceroute", "/network-tools/global-traceroute-planner"],
  ["/network-tools/vpn-configuration-analyzer", "/network-tools/vpn-ipsec-config-checker"],
  ["/network-tools/firewall-rule-analyzer", "/network-tools/firewall-rule-shadow-analyzer"],
  ["/tools/cloud-exposure", "/tools/cloud-readiness"]
];

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
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*"
    ]
  },
  images: {
    qualities: [65, 75]
  },
  turbopack: {
    root: process.cwd()
  },
  async redirects() {
    return legacyToolRedirects.map(([source, destination]) => ({ source, destination, permanent: true }));
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
