import { Fingerprint, Globe2, LockKeyhole, MailCheck, PlugZap, ShieldCheck } from "lucide-react";

export type NetworkUtilityTool = {
  slug: string;
  title: string;
  shortTitle: string;
  category: string;
  description: string;
  inputLabel: string;
  placeholder: string;
  serviceIntent: string;
  searchIntent: string[];
  outputPromise: string;
  cta: string;
  icon: typeof Globe2;
  portRequired?: boolean;
};

export const networkUtilityTools: NetworkUtilityTool[] = [
  {
    slug: "dns-lookup",
    title: "DNS Lookup Tool",
    shortTitle: "DNS Lookup",
    category: "DNS tools",
    description:
      "Check public A, AAAA, MX, NS, and TXT records for a domain from the QuantumCrafters network diagnostics layer.",
    inputLabel: "Domain name",
    placeholder: "example.com",
    serviceIntent: "Managed Network Services",
    searchIntent: ["dns lookup tool", "check dns records online", "domain dns checker"],
    outputPromise: "Returns public DNS records, missing-record warnings, and service routing signals.",
    cta: "Fix DNS or network reachability",
    icon: Globe2
  },
  {
    slug: "mx-lookup",
    title: "MX Lookup Tool",
    shortTitle: "MX Lookup",
    category: "Email network tools",
    description:
      "Inspect mail exchanger records, priority order, and mail routing signals for business email delivery troubleshooting.",
    inputLabel: "Email domain",
    placeholder: "company.com",
    serviceIntent: "Network Security",
    searchIntent: ["mx lookup", "check mx records", "email dns checker"],
    outputPromise: "Shows MX hosts, priorities, and next-step guidance for email/network security review.",
    cta: "Review email security posture",
    icon: MailCheck
  },
  {
    slug: "spf-dmarc-check",
    title: "SPF and DMARC Checker",
    shortTitle: "SPF/DMARC",
    category: "Email security tools",
    description:
      "Check whether a domain publishes SPF and DMARC records before email spoofing, phishing, and deliverability problems become visible.",
    inputLabel: "Email domain",
    placeholder: "company.com",
    serviceIntent: "Network Security",
    searchIntent: ["spf checker", "dmarc checker", "email security records"],
    outputPromise: "Highlights SPF and DMARC presence, policy strength, and missing-record risk.",
    cta: "Harden email and domain security",
    icon: ShieldCheck
  },
  {
    slug: "ssl-certificate-check",
    title: "SSL Certificate Checker",
    shortTitle: "SSL Checker",
    category: "Cybersecurity tools",
    description:
      "Inspect a public website certificate, issuer, validity window, expiry risk, and TLS connection details.",
    inputLabel: "Hostname",
    placeholder: "example.com",
    serviceIntent: "Penetration Testing",
    searchIntent: ["ssl checker", "certificate expiry checker", "tls certificate check"],
    outputPromise: "Shows certificate issuer, validity dates, days remaining, SANs, and TLS details.",
    cta: "Review exposed services",
    icon: LockKeyhole
  },
  {
    slug: "http-header-check",
    title: "HTTP Security Header Checker",
    shortTitle: "Header Check",
    category: "Website security tools",
    description:
      "Check a public URL for security headers such as HSTS, CSP, X-Frame-Options, Referrer-Policy, and Permissions-Policy.",
    inputLabel: "Website URL or hostname",
    placeholder: "https://example.com",
    serviceIntent: "Penetration Testing",
    searchIntent: ["http header checker", "security header checker", "website security headers"],
    outputPromise: "Returns observed headers, missing-header warnings, HTTP status, and redirect target.",
    cta: "Fix web exposure and security headers",
    icon: Fingerprint
  },
  {
    slug: "port-check",
    title: "Port Reachability Checker",
    shortTitle: "Port Check",
    category: "Network troubleshooting tools",
    description:
      "Test whether one public TCP port is reachable from the QuantumCrafters diagnostic edge for quick firewall and service triage.",
    inputLabel: "Public hostname or IP",
    placeholder: "example.com",
    serviceIntent: "Network Troubleshooting",
    searchIntent: ["port checker", "open port checker", "tcp port test online"],
    outputPromise: "Checks one TCP port at a time and blocks private/internal targets for safety.",
    cta: "Troubleshoot firewall or VPN access",
    icon: PlugZap,
    portRequired: true
  }
];

export function getNetworkUtilityTool(slug: string) {
  return networkUtilityTools.find((tool) => tool.slug === slug);
}
