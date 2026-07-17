import {
  Calculator,
  FileCode2,
  Fingerprint,
  GitBranch,
  Globe2,
  LockKeyhole,
  MailCheck,
  PlugZap,
  Route,
  ShieldCheck
} from "lucide-react";

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
  icon: typeof Globe2;
  portRequired?: boolean;
  fields?: NetworkUtilityToolField[];
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
  }
];

export function getNetworkUtilityTool(slug: string) {
  return networkUtilityTools.find((tool) => tool.slug === slug);
}
