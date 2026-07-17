import {
  Activity,
  AtSign,
  Calculator,
  FileCheck2,
  FileCode2,
  Fingerprint,
  GitBranch,
  Globe2,
  KeyRound,
  LockKeyhole,
  MailCheck,
  Network,
  PlugZap,
  Radar,
  Route,
  Router,
  ScanSearch,
  ServerCog,
  ShieldCheck,
  Wifi
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NetworkUtilityToolField = {
  name: string;
  label: string;
  type: "text" | "number" | "select";
  placeholder?: string;
  required?: boolean;
  defaultValue?: string | number;
  min?: number;
  max?: number;
  helper?: string;
  options?: { label: string; value: string }[];
};

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
  icon: LucideIcon;
  portRequired?: boolean;
  fields?: NetworkUtilityToolField[];
};

export const networkUtilityTools: NetworkUtilityTool[] = [
  {
    slug: "vendor-task-script-generator",
    title: "Vendor Task Script Generator",
    shortTitle: "Task Scripts",
    category: "Network automation tools",
    description:
      "Generate operator-ready command plans for common Cisco, FortiGate, and Juniper troubleshooting tasks such as packet capture, interface evidence, route checks, and VPN evidence.",
    inputLabel: "Task context",
    placeholder: "Packet capture context",
    serviceIntent: "Network Troubleshooting",
    searchIntent: [
      "packet capture command generator",
      "cisco packet capture commands",
      "fortigate packet capture commands",
      "juniper packet capture commands"
    ],
    outputPromise:
      "Creates a prepare, run, validate, stop, and cleanup command plan with vendor-specific syntax and safety notes.",
    cta: "Convert troubleshooting into a controlled runbook",
    icon: FileCode2,
    fields: [
      {
        name: "vendor",
        label: "Vendor / platform",
        type: "select",
        defaultValue: "cisco-ios-xe",
        required: true,
        options: [
          { label: "Cisco IOS XE router or switch", value: "cisco-ios-xe" },
          { label: "Cisco ASA firewall", value: "cisco-asa" },
          { label: "FortiGate FortiOS firewall", value: "fortigate" },
          { label: "Juniper Junos / SRX", value: "juniper-junos" }
        ]
      },
      {
        name: "task",
        label: "Common task",
        type: "select",
        defaultValue: "packet-capture",
        required: true,
        options: [
          { label: "Start a packet capture", value: "packet-capture" },
          { label: "Collect interface health evidence", value: "interface-health" },
          { label: "Collect route and neighbor evidence", value: "route-neighbor" },
          { label: "Collect VPN tunnel evidence", value: "vpn-evidence" }
        ]
      },
      {
        name: "interfaceName",
        label: "Interface",
        type: "text",
        placeholder: "Gi1/0/1, inside, port1, ge-0/0/0",
        helper: "Use the exact interface name from the device."
      },
      {
        name: "sourceIp",
        label: "Source IP",
        type: "text",
        placeholder: "10.10.10.25"
      },
      {
        name: "destinationIp",
        label: "Destination IP",
        type: "text",
        placeholder: "172.16.20.10"
      },
      {
        name: "protocol",
        label: "Protocol",
        type: "select",
        defaultValue: "tcp",
        options: [
          { label: "TCP", value: "tcp" },
          { label: "UDP", value: "udp" },
          { label: "ICMP", value: "icmp" },
          { label: "Any IP", value: "ip" }
        ]
      },
      {
        name: "port",
        label: "TCP/UDP port",
        type: "number",
        placeholder: "443",
        min: 1,
        max: 65535
      },
      {
        name: "packetCount",
        label: "Packet count",
        type: "number",
        defaultValue: 100,
        min: 1,
        max: 5000
      },
      {
        name: "durationSeconds",
        label: "Max duration seconds",
        type: "number",
        defaultValue: 120,
        min: 10,
        max: 3600
      },
      {
        name: "captureName",
        label: "Capture name",
        type: "text",
        defaultValue: "qcs_cap",
        placeholder: "qcs_cap",
        helper: "Letters, numbers, underscore, and dash only."
      }
    ]
  },
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
    slug: "a-record-lookup",
    title: "A Record Lookup Tool",
    shortTitle: "A Lookup",
    category: "DNS tools",
    description: "Check IPv4 A records for a public domain to confirm web, VPN, mail, or application reachability.",
    inputLabel: "Domain name",
    placeholder: "example.com",
    serviceIntent: "Managed Network Services",
    searchIntent: ["a record lookup", "ipv4 dns lookup", "check a records"],
    outputPromise: "Returns public IPv4 A records and highlights missing address records.",
    cta: "Validate IPv4 DNS reachability",
    icon: Globe2
  },
  {
    slug: "aaaa-record-lookup",
    title: "AAAA Record Lookup Tool",
    shortTitle: "AAAA Lookup",
    category: "DNS tools",
    description: "Check IPv6 AAAA records for a public domain to validate dual-stack network readiness.",
    inputLabel: "Domain name",
    placeholder: "example.com",
    serviceIntent: "Managed Network Services",
    searchIntent: ["aaaa record lookup", "ipv6 dns lookup", "check ipv6 dns records"],
    outputPromise: "Returns public IPv6 AAAA records and flags missing IPv6 DNS signals.",
    cta: "Validate IPv6 readiness",
    icon: Network
  },
  {
    slug: "cname-lookup",
    title: "CNAME Lookup Tool",
    shortTitle: "CNAME Lookup",
    category: "DNS tools",
    description: "Check canonical name records to validate SaaS, CDN, migration, and cloud hostname mappings.",
    inputLabel: "Hostname",
    placeholder: "www.example.com",
    serviceIntent: "Cloud Network Services",
    searchIntent: ["cname lookup", "check cname record", "canonical name checker"],
    outputPromise: "Returns CNAME targets and guidance for cloud or CDN hostname mapping.",
    cta: "Validate cloud hostname mapping",
    icon: Route
  },
  {
    slug: "ns-lookup",
    title: "NS Lookup Tool",
    shortTitle: "NS Lookup",
    category: "DNS tools",
    description: "Check authoritative name server records for a domain before migration, delegation, or outage review.",
    inputLabel: "Domain name",
    placeholder: "example.com",
    serviceIntent: "Managed Network Services",
    searchIntent: ["ns lookup", "nameserver lookup", "authoritative name server checker"],
    outputPromise: "Returns authoritative NS records and delegation review signals.",
    cta: "Review DNS delegation",
    icon: ServerCog
  },
  {
    slug: "txt-record-lookup",
    title: "TXT Record Lookup Tool",
    shortTitle: "TXT Lookup",
    category: "DNS tools",
    description: "Inspect public TXT records used by email security, domain verification, SaaS, and ownership workflows.",
    inputLabel: "Domain name",
    placeholder: "example.com",
    serviceIntent: "Network Security",
    searchIntent: ["txt record lookup", "dns txt lookup", "domain txt checker"],
    outputPromise: "Returns public TXT records and highlights verification or policy signals.",
    cta: "Review domain verification records",
    icon: FileCheck2
  },
  {
    slug: "soa-lookup",
    title: "SOA Lookup Tool",
    shortTitle: "SOA Lookup",
    category: "DNS tools",
    description: "Check the start-of-authority record to review DNS ownership, serial, refresh, retry, and expiry values.",
    inputLabel: "Domain name",
    placeholder: "example.com",
    serviceIntent: "Managed Network Services",
    searchIntent: ["soa lookup", "dns soa checker", "dns serial checker"],
    outputPromise: "Returns SOA authority details including primary server, admin mailbox, serial, refresh, retry, and expiry.",
    cta: "Review DNS authority and zone health",
    icon: ServerCog
  },
  {
    slug: "srv-record-lookup",
    title: "SRV Record Lookup Tool",
    shortTitle: "SRV Lookup",
    category: "DNS tools",
    description: "Check SRV records for services such as SIP, LDAP, Kerberos, XMPP, Microsoft 365, and identity platforms.",
    inputLabel: "Domain name",
    placeholder: "example.com",
    serviceIntent: "Managed Network Services",
    searchIntent: ["srv lookup", "dns srv checker", "service record lookup"],
    outputPromise: "Returns SRV priority, weight, port, and target values for the selected service.",
    cta: "Validate service discovery records",
    icon: Router,
    fields: [
      {
        name: "service",
        label: "Service",
        type: "text",
        defaultValue: "_sip",
        placeholder: "_sip",
        required: true,
        helper: "Include the leading underscore, for example _sip or _ldap."
      },
      {
        name: "protocol",
        label: "Protocol",
        type: "select",
        defaultValue: "_tcp",
        required: true,
        options: [
          { label: "TCP", value: "_tcp" },
          { label: "UDP", value: "_udp" }
        ]
      },
      {
        name: "domain",
        label: "Domain",
        type: "text",
        placeholder: "example.com",
        required: true
      }
    ]
  },
  {
    slug: "dnssec-ds-check",
    title: "DNSSEC DS Record Checker",
    shortTitle: "DNSSEC DS",
    category: "DNS security tools",
    description: "Check whether a domain publishes DS records that connect the parent zone to DNSSEC validation.",
    inputLabel: "Domain name",
    placeholder: "example.com",
    serviceIntent: "Network Security",
    searchIntent: ["dnssec checker", "ds record lookup", "dnssec ds check"],
    outputPromise: "Returns DS records when present and flags domains without parent-zone DNSSEC delegation.",
    cta: "Review DNSSEC readiness",
    icon: ShieldCheck
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
    slug: "dkim-record-check",
    title: "DKIM Record Checker",
    shortTitle: "DKIM Check",
    category: "Email security tools",
    description: "Check a DKIM selector record to validate email signing readiness and domain authentication evidence.",
    inputLabel: "Domain name",
    placeholder: "example.com",
    serviceIntent: "Network Security",
    searchIntent: ["dkim checker", "dkim record lookup", "email authentication checker"],
    outputPromise: "Returns the DKIM TXT record for the selected selector and highlights missing signing records.",
    cta: "Validate email signing records",
    icon: KeyRound,
    fields: [
      {
        name: "selector",
        label: "DKIM selector",
        type: "text",
        defaultValue: "default",
        placeholder: "default, selector1, google",
        required: true
      },
      {
        name: "domain",
        label: "Email domain",
        type: "text",
        placeholder: "example.com",
        required: true
      }
    ]
  },
  {
    slug: "dmarc-policy-analyzer",
    title: "DMARC Policy Analyzer",
    shortTitle: "DMARC Analyzer",
    category: "Email security tools",
    description: "Parse a DMARC record to review policy, alignment, reporting, sampling, and enforcement readiness.",
    inputLabel: "Email domain",
    placeholder: "example.com",
    serviceIntent: "Network Security",
    searchIntent: ["dmarc analyzer", "dmarc policy checker", "dmarc record parser"],
    outputPromise: "Parses DMARC tags and returns enforcement, reporting, alignment, and rollout guidance.",
    cta: "Move email policy toward enforcement",
    icon: MailCheck
  },
  {
    slug: "bimi-record-check",
    title: "BIMI Record Checker",
    shortTitle: "BIMI Check",
    category: "Email security tools",
    description: "Check BIMI DNS records used for verified brand indicators in supported mailbox providers.",
    inputLabel: "Email domain",
    placeholder: "example.com",
    serviceIntent: "Network Security",
    searchIntent: ["bimi checker", "bimi record lookup", "email brand indicator checker"],
    outputPromise: "Returns BIMI record presence, logo location, authority certificate hints, and readiness notes.",
    cta: "Validate email brand indicator readiness",
    icon: AtSign
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
    slug: "tls-version-check",
    title: "TLS Version Checker",
    shortTitle: "TLS Check",
    category: "Cybersecurity tools",
    description: "Check whether a public HTTPS endpoint supports modern TLS versions and reports negotiated protocol details.",
    inputLabel: "Hostname",
    placeholder: "example.com",
    serviceIntent: "Penetration Testing",
    searchIntent: ["tls version checker", "tls 1.3 checker", "ssl tls protocol check"],
    outputPromise: "Tests TLS 1.3 and TLS 1.2 support and returns negotiated protocol and cipher details.",
    cta: "Review TLS protocol exposure",
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
    slug: "hsts-readiness-check",
    title: "HSTS Readiness Checker",
    shortTitle: "HSTS Check",
    category: "Website security tools",
    description: "Check whether a website sends a practical Strict-Transport-Security policy for HTTPS enforcement.",
    inputLabel: "Website URL or hostname",
    placeholder: "https://example.com",
    serviceIntent: "Penetration Testing",
    searchIntent: ["hsts checker", "strict transport security checker", "hsts preload readiness"],
    outputPromise: "Returns HSTS max-age, includeSubDomains, preload signal, and readiness guidance.",
    cta: "Harden HTTPS transport policy",
    icon: ShieldCheck
  },
  {
    slug: "http-status-check",
    title: "HTTP Status Code Checker",
    shortTitle: "HTTP Status",
    category: "Website troubleshooting tools",
    description: "Check the HTTP response code, final URL, server header, and redirect location for a public URL.",
    inputLabel: "Website URL or hostname",
    placeholder: "https://example.com",
    serviceIntent: "Network Troubleshooting",
    searchIntent: ["http status checker", "url status checker", "website response checker"],
    outputPromise: "Returns HTTP status, redirect location, final URL, server header, and cache-control signal.",
    cta: "Troubleshoot website response issues",
    icon: Activity
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
  },
  {
    slug: "website-availability-check",
    title: "Website Availability Checker",
    shortTitle: "Availability",
    category: "Website troubleshooting tools",
    description: "Check whether a public website responds successfully and how long the request takes from the QCS edge.",
    inputLabel: "Website URL or hostname",
    placeholder: "https://example.com",
    serviceIntent: "Managed Network Services",
    searchIntent: ["website availability checker", "uptime checker", "website response time checker"],
    outputPromise: "Returns response status, elapsed time, final URL, and availability guidance.",
    cta: "Investigate website availability",
    icon: Radar
  },
  {
    slug: "robots-txt-check",
    title: "Robots.txt Checker",
    shortTitle: "Robots Check",
    category: "Website troubleshooting tools",
    description: "Check whether a public site exposes robots.txt and review crawl control signals for important paths.",
    inputLabel: "Website URL or hostname",
    placeholder: "https://example.com",
    serviceIntent: "Managed Network Services",
    searchIntent: ["robots txt checker", "robots.txt validator", "crawl rule checker"],
    outputPromise: "Returns robots.txt status, size, sitemap references, disallow count, and crawl-control guidance.",
    cta: "Review crawl and access controls",
    icon: ScanSearch
  },
  {
    slug: "security-txt-check",
    title: "Security.txt Checker",
    shortTitle: "Security.txt",
    category: "Website security tools",
    description: "Check whether a public site publishes security.txt contact and policy metadata for responsible disclosure.",
    inputLabel: "Website URL or hostname",
    placeholder: "https://example.com",
    serviceIntent: "Penetration Testing",
    searchIntent: ["security txt checker", "security.txt validator", "responsible disclosure checker"],
    outputPromise: "Checks /.well-known/security.txt and /security.txt for contact, expiry, policy, and encryption hints.",
    cta: "Improve security disclosure readiness",
    icon: ShieldCheck
  },
  {
    slug: "common-port-exposure-check",
    title: "Common Port Exposure Check",
    shortTitle: "Common Ports",
    category: "Network troubleshooting tools",
    description: "Check a small set of common public TCP ports to identify basic exposure and firewall review signals.",
    inputLabel: "Public hostname or IP",
    placeholder: "example.com",
    serviceIntent: "Network Security",
    searchIntent: ["common port checker", "public port exposure check", "tcp service exposure checker"],
    outputPromise: "Checks common TCP ports such as 21, 22, 25, 53, 80, 443, 445, 3389, 8080, and 8443.",
    cta: "Review public service exposure",
    icon: PlugZap
  },
  {
    slug: "reverse-dns-lookup",
    title: "Reverse DNS Lookup Tool",
    shortTitle: "Reverse DNS",
    category: "IP and DNS tools",
    description:
      "Check public PTR records for an IP address to validate reverse DNS, mail infrastructure identity, and provider ownership clues.",
    inputLabel: "Public IP address",
    placeholder: "8.8.8.8",
    serviceIntent: "Managed Network Services",
    searchIntent: ["reverse dns lookup", "ptr record lookup", "ip reverse lookup"],
    outputPromise: "Returns PTR hostnames for a public IP address and flags missing reverse DNS.",
    cta: "Validate IP ownership and mail identity",
    icon: Route
  },
  {
    slug: "caa-record-check",
    title: "CAA Record Checker",
    shortTitle: "CAA Check",
    category: "DNS security tools",
    description:
      "Check DNS Certification Authority Authorization records to see which certificate authorities are allowed to issue certificates.",
    inputLabel: "Domain name",
    placeholder: "example.com",
    serviceIntent: "Network Security",
    searchIntent: ["caa record checker", "dns caa lookup", "certificate authority authorization check"],
    outputPromise: "Shows CAA issue, issuewild, iodef, and related certificate issuance policy signals.",
    cta: "Review certificate issuance governance",
    icon: ShieldCheck
  },
  {
    slug: "http-redirect-chain",
    title: "HTTP Redirect Chain Checker",
    shortTitle: "Redirect Chain",
    category: "Website security tools",
    description:
      "Trace public HTTP and HTTPS redirects to find long chains, protocol downgrades, unexpected hosts, and final landing URLs.",
    inputLabel: "Website URL or hostname",
    placeholder: "https://example.com",
    serviceIntent: "Penetration Testing",
    searchIntent: ["redirect checker", "http redirect chain checker", "url redirect test"],
    outputPromise: "Returns each redirect hop, HTTP status, next location, and final URL decision signal.",
    cta: "Fix redirect, TLS, and exposure issues",
    icon: GitBranch
  },
  {
    slug: "ipv4-subnet-calculator",
    title: "IPv4 Subnet Calculator",
    shortTitle: "Subnet Calc",
    category: "Network planning tools",
    description:
      "Calculate IPv4 network address, broadcast address, usable host range, wildcard mask, and host capacity from CIDR notation.",
    inputLabel: "IPv4 CIDR",
    placeholder: "192.168.10.0/24",
    serviceIntent: "Managed Network Services",
    searchIntent: ["subnet calculator", "cidr calculator", "wildcard mask calculator"],
    outputPromise: "Returns network, broadcast, usable range, subnet mask, wildcard mask, and host count.",
    cta: "Plan routing, VLANs, ACLs, and firewall objects",
    icon: Calculator
  },
  {
    slug: "ipv4-wildcard-mask-calculator",
    title: "IPv4 Wildcard Mask Calculator",
    shortTitle: "Wildcard Calc",
    category: "Network planning tools",
    description:
      "Convert IPv4 CIDR notation into subnet mask and wildcard mask values used in Cisco ACLs, route filters, and firewall objects.",
    inputLabel: "IPv4 CIDR",
    placeholder: "192.168.10.0/24",
    serviceIntent: "Managed Network Services",
    searchIntent: ["wildcard mask calculator", "cisco wildcard mask", "acl wildcard calculator"],
    outputPromise: "Returns subnet mask, wildcard mask, network address, host range, and ACL planning guidance.",
    cta: "Build routing and ACL objects cleanly",
    icon: Wifi
  }
];

export function getNetworkUtilityTool(slug: string) {
  return networkUtilityTools.find((tool) => tool.slug === slug);
}
