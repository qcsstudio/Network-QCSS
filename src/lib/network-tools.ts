import {
  Activity,
  AtSign,
  Calculator,
  FileCheck2,
  FileCode2,
  Fingerprint,
  Gauge,
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
  type: "text" | "number" | "select" | "textarea";
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
    slug: "strong-password-generator",
    title: "Strong Password and Passphrase Generator",
    shortTitle: "Password Gen",
    category: "Cybersecurity tools",
    description:
      "Generate private random passwords, passphrases, Wi-Fi keys, recovery codes, PINs, and API tokens locally in your browser for real security workflows.",
    inputLabel: "Password generation options",
    placeholder: "20 characters",
    serviceIntent: "Network Security",
    searchIntent: [
      "strong password generator",
      "secure password generator",
      "random password generator",
      "passphrase generator",
      "Wi-Fi password generator",
      "API token generator"
    ],
    outputPromise: "Creates scenario-specific secrets locally with Web Crypto, practical strength guidance, and no server transmission or storage.",
    cta: "Improve password and access hygiene",
    icon: KeyRound
  },
  {
    slug: "rpki-roa-validator",
    title: "RPKI / ROA Validator",
    shortTitle: "RPKI Validator",
    category: "BGP security tools",
    description: "Validate whether an ASN is authorized to originate a public prefix and flag RPKI invalid or missing ROA signals.",
    inputLabel: "Prefix and ASN",
    placeholder: "203.0.113.0/24 AS64500",
    serviceIntent: "Network Security",
    searchIntent: ["rpki validator", "roa validator", "bgp route origin validation"],
    outputPromise: "Returns route-origin validation status, prefix/ASN normalization, and routing security next steps.",
    cta: "Review BGP route-origin security",
    icon: ShieldCheck,
    fields: [
      { name: "prefix", label: "Public prefix", type: "text", placeholder: "8.8.8.0/24", required: true },
      { name: "asn", label: "Origin ASN", type: "text", placeholder: "AS15169", required: true }
    ]
  },
  {
    slug: "asn-intelligence-tool",
    title: "ASN Intelligence Tool",
    shortTitle: "ASN Intel",
    category: "BGP intelligence tools",
    description: "Look up ASN or public IP routing context, announced prefix signals, and operator intelligence links.",
    inputLabel: "ASN or public IP",
    placeholder: "AS15169 or 8.8.8.8",
    serviceIntent: "Managed Network Services",
    searchIntent: ["asn lookup", "asn intelligence", "ip to asn lookup"],
    outputPromise: "Returns ASN-oriented routing context, RIPEstat evidence links, and review signals.",
    cta: "Map internet routing ownership",
    icon: Radar
  },
  {
    slug: "bgp-route-anomaly-check",
    title: "BGP Route Anomaly Checker",
    shortTitle: "BGP Anomaly",
    category: "BGP intelligence tools",
    description: "Build a routing anomaly review for an ASN or prefix using public route-visibility evidence and escalation logic.",
    inputLabel: "ASN or prefix",
    placeholder: "AS15169 or 8.8.8.0/24",
    serviceIntent: "Network Security",
    searchIntent: ["bgp anomaly checker", "route leak checker", "bgp hijack checker"],
    outputPromise: "Returns anomaly evidence points, public routing links, and route-leak/hijack review guidance.",
    cta: "Investigate route leaks or hijacks",
    icon: Activity
  },
  {
    slug: "global-traceroute-planner",
    title: "Global Traceroute Path Planner",
    shortTitle: "Global Trace",
    category: "Global network tools",
    description: "Create a global traceroute evidence plan for India, US, Europe, Middle East, and Singapore troubleshooting.",
    inputLabel: "Public hostname or IP",
    placeholder: "example.com",
    serviceIntent: "Network Troubleshooting",
    searchIntent: ["global traceroute", "network path checker", "ripe atlas traceroute plan"],
    outputPromise: "Returns regional probe targets, traceroute commands, evidence checklist, and escalation notes.",
    cta: "Diagnose global path issues",
    icon: Route
  },
  {
    slug: "global-latency-map-planner",
    title: "Global Ping and Latency Planner",
    shortTitle: "Latency Map",
    category: "Global network tools",
    description: "Plan multi-region latency, jitter, and packet-loss measurements for cloud, VPN, SaaS, and SASE paths.",
    inputLabel: "Public hostname or IP",
    placeholder: "example.com",
    serviceIntent: "Managed Network Services",
    searchIntent: ["global ping test", "latency map", "multi region ping tool"],
    outputPromise: "Returns a regional latency measurement plan with thresholds and interpretation guidance.",
    cta: "Measure global user experience",
    icon: Radar
  },
  {
    slug: "dns-propagation-checker",
    title: "DNS Propagation Checker",
    shortTitle: "DNS Propagation",
    category: "DNS tools",
    description: "Compare DNS answers from multiple public resolvers to validate propagation, resolver drift, and migration status.",
    inputLabel: "Domain and record type",
    placeholder: "example.com A",
    serviceIntent: "Managed Network Services",
    searchIntent: ["dns propagation checker", "global dns checker", "dns resolver comparison"],
    outputPromise: "Queries public resolvers and compares answers, TTLs, and status codes.",
    cta: "Validate DNS propagation",
    icon: Globe2,
    fields: [
      { name: "domain", label: "Domain", type: "text", placeholder: "example.com", required: true },
      {
        name: "recordType",
        label: "Record type",
        type: "select",
        defaultValue: "A",
        required: true,
        options: [
          { label: "A", value: "A" },
          { label: "AAAA", value: "AAAA" },
          { label: "CNAME", value: "CNAME" },
          { label: "MX", value: "MX" },
          { label: "NS", value: "NS" },
          { label: "TXT", value: "TXT" }
        ]
      }
    ]
  },
  {
    slug: "starttls-mail-checker",
    title: "STARTTLS Mail Checker",
    shortTitle: "STARTTLS",
    category: "Email security tools",
    description: "Check MX records and build a mail transport TLS review for domains that need secure SMTP delivery.",
    inputLabel: "Email domain",
    placeholder: "example.com",
    serviceIntent: "Network Security",
    searchIntent: ["starttls checker", "mail tls checker", "smtp tls checker"],
    outputPromise: "Returns MX records, port 25 reachability signals, STARTTLS test status, and mail TLS guidance.",
    cta: "Review mail transport security",
    icon: MailCheck
  },
  {
    slug: "dane-tlsa-checker",
    title: "DANE / TLSA Checker",
    shortTitle: "DANE TLSA",
    category: "Email security tools",
    description: "Check TLSA records for DANE-enabled SMTP, HTTPS, or custom TLS services and review DNSSEC-backed certificate binding signals.",
    inputLabel: "TLSA target",
    placeholder: "_25._tcp.mail.example.com",
    serviceIntent: "Network Security",
    searchIntent: ["dane checker", "tlsa record lookup", "dane smtp checker"],
    outputPromise: "Returns TLSA record presence, usage/selector/matching values, and DNSSEC/DANE review notes.",
    cta: "Validate DANE TLSA posture",
    icon: LockKeyhole,
    fields: [
      { name: "hostname", label: "Hostname", type: "text", placeholder: "mail.example.com", required: true },
      { name: "port", label: "TLS port", type: "number", defaultValue: 25, min: 1, max: 65535, required: true },
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
      }
    ]
  },
  {
    slug: "mta-sts-tls-rpt-checker",
    title: "MTA-STS and TLS-RPT Checker",
    shortTitle: "MTA-STS",
    category: "Email security tools",
    description: "Check MTA-STS policy and SMTP TLS reporting records for modern email transport protection.",
    inputLabel: "Email domain",
    placeholder: "example.com",
    serviceIntent: "Network Security",
    searchIntent: ["mta-sts checker", "tls-rpt checker", "smtp tls reporting checker"],
    outputPromise: "Returns MTA-STS TXT, policy file, TLS-RPT record, mode, MX rules, and readiness guidance.",
    cta: "Harden email transport policy",
    icon: ShieldCheck
  },
  {
    slug: "deep-mx-health-analyzer",
    title: "Deep MX Health Analyzer",
    shortTitle: "Deep MX",
    category: "Email network tools",
    description: "Combine MX, SPF, DMARC, MTA-STS, TLS-RPT, reverse DNS, and SMTP reachability signals in one email health view.",
    inputLabel: "Email domain",
    placeholder: "example.com",
    serviceIntent: "Network Security",
    searchIntent: ["mx health analyzer", "email domain health check", "mail server diagnostics"],
    outputPromise: "Returns a combined mail routing and authentication health summary with priority recommendations.",
    cta: "Fix mail delivery and security posture",
    icon: MailCheck
  },
  {
    slug: "ip-reputation-abuse-check",
    title: "IP Reputation and Abuse Checker",
    shortTitle: "IP Reputation",
    category: "Threat intelligence tools",
    description: "Check public IP reputation indicators, DNSBL-style listing signals, and abuse-review next steps.",
    inputLabel: "Public IP address",
    placeholder: "8.8.8.8",
    serviceIntent: "Network Security",
    searchIntent: ["ip reputation checker", "abuse ip checker", "dnsbl lookup"],
    outputPromise: "Returns DNSBL-style signals, public reputation links, and remediation guidance.",
    cta: "Investigate IP reputation issues",
    icon: Fingerprint
  },
  {
    slug: "cloud-ip-range-lookup",
    title: "Cloud IP Range Lookup",
    shortTitle: "Cloud IP",
    category: "Cloud network tools",
    description: "Check whether an IP belongs to AWS, Google Cloud, or Cloudflare public ranges and return provider metadata.",
    inputLabel: "Provider and IP",
    placeholder: "8.8.8.8",
    serviceIntent: "Cloud Network Services",
    searchIntent: ["cloud ip range lookup", "aws ip range lookup", "cloudflare ip checker"],
    outputPromise: "Returns provider range matches, region/service metadata where available, and firewall review notes.",
    cta: "Validate cloud source and allowlists",
    icon: ServerCog,
    fields: [
      {
        name: "provider",
        label: "Provider",
        type: "select",
        defaultValue: "aws",
        required: true,
        options: [
          { label: "AWS", value: "aws" },
          { label: "Google Cloud", value: "gcp" },
          { label: "Cloudflare", value: "cloudflare" }
        ]
      },
      { name: "ip", label: "Public IP", type: "text", placeholder: "8.8.8.8", required: true }
    ]
  },
  {
    slug: "cloud-allowlist-generator",
    title: "Cloud Allowlist Generator",
    shortTitle: "Cloud Allowlist",
    category: "Cloud network tools",
    description: "Generate firewall allowlist objects for cloud provider ranges by provider, region, service, and vendor format.",
    inputLabel: "Cloud allowlist context",
    placeholder: "AWS us-east-1 AMAZON",
    serviceIntent: "Cloud Network Services",
    searchIntent: ["cloud allowlist generator", "aws firewall object generator", "cloud ip allowlist"],
    outputPromise: "Returns matched ranges and vendor-ready object examples for Cisco, FortiGate, Palo Alto, and generic firewalls.",
    cta: "Build cloud firewall allowlists",
    icon: FileCode2,
    fields: [
      {
        name: "provider",
        label: "Provider",
        type: "select",
        defaultValue: "aws",
        required: true,
        options: [
          { label: "AWS", value: "aws" },
          { label: "Google Cloud", value: "gcp" },
          { label: "Cloudflare", value: "cloudflare" }
        ]
      },
      { name: "region", label: "Region filter", type: "text", placeholder: "us-east-1, asia-south1, GLOBAL" },
      { name: "service", label: "Service filter", type: "text", placeholder: "AMAZON, EC2, Cloudflare" },
      {
        name: "vendor",
        label: "Firewall format",
        type: "select",
        defaultValue: "generic",
        options: [
          { label: "Generic CIDR list", value: "generic" },
          { label: "Cisco object-group", value: "cisco" },
          { label: "FortiGate address objects", value: "fortigate" },
          { label: "Palo Alto XML-style names", value: "paloalto" }
        ]
      },
      { name: "limit", label: "Max ranges", type: "number", defaultValue: 12, min: 1, max: 50 }
    ]
  },
  {
    slug: "cidr-overlap-checker",
    title: "CIDR Overlap Checker",
    shortTitle: "CIDR Overlap",
    category: "Network planning tools",
    description: "Detect overlapping IPv4 CIDR ranges before VPN, cloud migration, merger, VPC, or firewall object work.",
    inputLabel: "CIDR list",
    placeholder: "10.0.0.0/16, 10.0.10.0/24",
    serviceIntent: "Cloud Network Services",
    searchIntent: ["cidr overlap checker", "subnet overlap checker", "vpc overlap checker"],
    outputPromise: "Returns overlapping CIDR pairs, normalized ranges, and migration-risk guidance.",
    cta: "Prevent VPN and cloud address conflicts",
    icon: Calculator,
    fields: [
      {
        name: "cidrs",
        label: "CIDR ranges",
        type: "textarea",
        placeholder: "10.0.0.0/16\n10.0.10.0/24\n172.16.0.0/20",
        required: true
      }
    ]
  },
  {
    slug: "cidr-summarizer",
    title: "CIDR Summarizer and Route Aggregator",
    shortTitle: "CIDR Summary",
    category: "Network planning tools",
    description: "Aggregate IPv4 CIDR ranges into cleaner route, firewall, and ACL summaries where safe.",
    inputLabel: "CIDR list",
    placeholder: "192.168.0.0/25, 192.168.0.128/25",
    serviceIntent: "Managed Network Services",
    searchIntent: ["cidr summarizer", "route summarization calculator", "cidr aggregator"],
    outputPromise: "Returns merged CIDR ranges, address counts, and route-aggregation review notes.",
    cta: "Clean up route and firewall objects",
    icon: Route,
    fields: [
      {
        name: "cidrs",
        label: "CIDR ranges",
        type: "textarea",
        placeholder: "192.168.0.0/25\n192.168.0.128/25\n192.168.1.0/24",
        required: true
      }
    ]
  },
  {
    slug: "ipv6-subnet-calculator",
    title: "IPv6 Subnet Calculator",
    shortTitle: "IPv6 Calc",
    category: "Network planning tools",
    description: "Calculate IPv6 network range, compressed/expanded form, prefix size, and subnet planning guidance.",
    inputLabel: "IPv6 CIDR",
    placeholder: "2001:db8:100::/48",
    serviceIntent: "Managed Network Services",
    searchIntent: ["ipv6 subnet calculator", "ipv6 cidr calculator", "ipv6 range calculator"],
    outputPromise: "Returns normalized IPv6 CIDR, first/last address, address count, and subnet planning notes.",
    cta: "Plan IPv6 addressing cleanly",
    icon: Network
  },
  {
    slug: "mtu-mss-vpn-calculator",
    title: "MTU / MSS / VPN Overhead Calculator",
    shortTitle: "MTU MSS",
    category: "Network troubleshooting tools",
    description: "Calculate practical MTU and TCP MSS values for IPsec, GRE, VXLAN, WireGuard, PPPoE, and SD-WAN paths.",
    inputLabel: "Path MTU context",
    placeholder: "1500 IPsec",
    serviceIntent: "Network Troubleshooting",
    searchIntent: ["mtu mss calculator", "vpn overhead calculator", "ipsec mss calculator"],
    outputPromise: "Returns estimated tunnel overhead, effective MTU, recommended TCP MSS, and troubleshooting notes.",
    cta: "Fix fragmentation and VPN performance",
    icon: Gauge,
    fields: [
      { name: "baseMtu", label: "Base MTU", type: "number", defaultValue: 1500, min: 576, max: 9216, required: true },
      {
        name: "encapsulation",
        label: "Encapsulation",
        type: "select",
        defaultValue: "ipsec-nat-t",
        required: true,
        options: [
          { label: "IPsec ESP + NAT-T", value: "ipsec-nat-t" },
          { label: "IPsec ESP", value: "ipsec" },
          { label: "GRE over IPsec", value: "gre-ipsec" },
          { label: "VXLAN", value: "vxlan" },
          { label: "WireGuard", value: "wireguard" },
          { label: "PPPoE", value: "pppoe" },
          { label: "Custom", value: "custom" }
        ]
      },
      { name: "extraOverhead", label: "Extra overhead bytes", type: "number", defaultValue: 0, min: 0, max: 400 }
    ]
  },
  {
    slug: "http3-quic-checker",
    title: "HTTP/3 and QUIC Readiness Checker",
    shortTitle: "HTTP/3 QUIC",
    category: "Website performance tools",
    description: "Check Alt-Svc and DNS HTTPS/SVCB signals that indicate HTTP/3 and QUIC readiness.",
    inputLabel: "Website URL or hostname",
    placeholder: "https://example.com",
    serviceIntent: "Cloud Network Services",
    searchIntent: ["http3 checker", "quic checker", "http/3 readiness"],
    outputPromise: "Returns Alt-Svc h3 signals, HTTPS/SVCB DNS hints, and edge-readiness guidance.",
    cta: "Validate modern web transport",
    icon: Activity
  },
  {
    slug: "csp-analyzer",
    title: "Content Security Policy Analyzer",
    shortTitle: "CSP Analyzer",
    category: "Website security tools",
    description: "Analyze Content-Security-Policy headers for unsafe inline script, wildcards, framing, and report coverage.",
    inputLabel: "Website URL or hostname",
    placeholder: "https://example.com",
    serviceIntent: "Penetration Testing",
    searchIntent: ["csp analyzer", "content security policy checker", "csp security scanner"],
    outputPromise: "Returns CSP directives, risky patterns, and hardening recommendations.",
    cta: "Harden browser-side exposure",
    icon: Fingerprint
  },
  {
    slug: "cors-misconfiguration-checker",
    title: "CORS Misconfiguration Checker",
    shortTitle: "CORS Check",
    category: "Website security tools",
    description: "Check CORS response headers for wildcard, reflected origin, and credential-risk patterns.",
    inputLabel: "API or website URL",
    placeholder: "https://api.example.com",
    serviceIntent: "Penetration Testing",
    searchIntent: ["cors checker", "cors misconfiguration scanner", "api cors security check"],
    outputPromise: "Returns CORS headers and flags common public API exposure mistakes.",
    cta: "Review API browser access policy",
    icon: ShieldCheck
  },
  {
    slug: "firewall-rule-shadow-analyzer",
    title: "Firewall Rule Shadow Analyzer",
    shortTitle: "Rule Shadow",
    category: "Firewall tools",
    description: "Paste sanitized firewall rules to detect duplicate, shadowed, broad, and risky rule patterns.",
    inputLabel: "Firewall rules",
    placeholder: "permit ip any any",
    serviceIntent: "Network Security",
    searchIntent: ["firewall rule shadow analyzer", "firewall policy cleanup tool", "rulebase analyzer"],
    outputPromise: "Returns duplicate/broad-rule signals, line findings, and cleanup priorities.",
    cta: "Clean up firewall policy safely",
    icon: ShieldCheck,
    fields: [
      {
        name: "vendor",
        label: "Rule style",
        type: "select",
        defaultValue: "generic",
        options: [
          { label: "Generic / Cisco-like", value: "generic" },
          { label: "FortiGate", value: "fortigate" },
          { label: "Palo Alto", value: "paloalto" }
        ]
      },
      {
        name: "rules",
        label: "Sanitized rules",
        type: "textarea",
        placeholder: "permit tcp any host 203.0.113.10 eq 443\npermit ip any any",
        required: true
      }
    ]
  },
  {
    slug: "vpn-ipsec-config-checker",
    title: "VPN / IPsec Config Sanity Checker",
    shortTitle: "IPsec Check",
    category: "VPN tools",
    description: "Review VPN/IPsec proposal settings for common interoperability, security, and troubleshooting risks.",
    inputLabel: "VPN proposal",
    placeholder: "IKEv2 AES-256 SHA256 DH14",
    serviceIntent: "Network Troubleshooting",
    searchIntent: ["ipsec config checker", "vpn proposal checker", "ike ipsec sanity checker"],
    outputPromise: "Returns proposal strength, compatibility notes, and next troubleshooting evidence.",
    cta: "Stabilize VPN negotiation",
    icon: LockKeyhole,
    fields: [
      {
        name: "vendor",
        label: "Vendor context",
        type: "select",
        defaultValue: "generic",
        options: [
          { label: "Generic", value: "generic" },
          { label: "Cisco", value: "cisco" },
          { label: "FortiGate", value: "fortigate" },
          { label: "Juniper", value: "juniper" },
          { label: "Cloud VPN", value: "cloud" }
        ]
      },
      {
        name: "ikeVersion",
        label: "IKE version",
        type: "select",
        defaultValue: "ikev2",
        options: [
          { label: "IKEv2", value: "ikev2" },
          { label: "IKEv1", value: "ikev1" }
        ]
      },
      { name: "encryption", label: "Encryption", type: "text", defaultValue: "aes-256", placeholder: "aes-256-gcm or aes-256" },
      { name: "integrity", label: "Integrity", type: "text", defaultValue: "sha256", placeholder: "sha256, sha384, null for GCM" },
      { name: "dhGroup", label: "DH group", type: "number", defaultValue: 14, min: 1, max: 31 },
      {
        name: "pfs",
        label: "PFS enabled",
        type: "select",
        defaultValue: "yes",
        options: [
          { label: "Yes", value: "yes" },
          { label: "No", value: "no" }
        ]
      },
      { name: "lifetimeSeconds", label: "Phase 2 lifetime seconds", type: "number", defaultValue: 3600, min: 300, max: 86400 }
    ]
  },
  {
    slug: "packet-capture-filter-generator",
    title: "Packet Capture Filter Generator",
    shortTitle: "Capture Filter",
    category: "Network automation tools",
    description: "Generate tcpdump, Wireshark, FortiGate sniffer, Cisco ACL, and ASA capture filters from one scenario.",
    inputLabel: "Capture filter context",
    placeholder: "10.0.0.10 to 172.16.1.20 tcp 443",
    serviceIntent: "Network Troubleshooting",
    searchIntent: ["packet capture filter generator", "tcpdump filter generator", "wireshark display filter generator"],
    outputPromise: "Returns BPF, Wireshark, FortiGate, Cisco, and ASA capture filter examples with safety notes.",
    cta: "Capture only the traffic that matters",
    icon: FileCode2,
    fields: [
      { name: "sourceIp", label: "Source IP", type: "text", placeholder: "10.0.0.10" },
      { name: "destinationIp", label: "Destination IP", type: "text", placeholder: "172.16.1.20" },
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
      { name: "port", label: "TCP/UDP port", type: "number", placeholder: "443", min: 1, max: 65535 },
      { name: "interfaceName", label: "Interface", type: "text", placeholder: "port1, inside, Gi1/0/1" }
    ]
  },
  {
    slug: "sdwan-sla-calculator",
    title: "SD-WAN SLA Path Calculator",
    shortTitle: "SD-WAN SLA",
    category: "SD-WAN tools",
    description: "Score latency, jitter, and packet loss against voice, video, SaaS, ERP, and bulk-transfer path needs.",
    inputLabel: "SLA metrics",
    placeholder: "latency 80 jitter 10 loss 0.5",
    serviceIntent: "Managed Network Services",
    searchIntent: ["sd-wan sla calculator", "latency jitter packet loss calculator", "wan path score"],
    outputPromise: "Returns app-fit score, SLA band, and SD-WAN routing recommendations.",
    cta: "Tune SD-WAN path policy",
    icon: Radar,
    fields: [
      {
        name: "appProfile",
        label: "Application profile",
        type: "select",
        defaultValue: "voice",
        options: [
          { label: "Voice / UC", value: "voice" },
          { label: "Video meetings", value: "video" },
          { label: "SaaS / Web", value: "saas" },
          { label: "ERP / Transactional", value: "erp" },
          { label: "Bulk transfer", value: "bulk" }
        ]
      },
      { name: "latencyMs", label: "Latency ms", type: "number", defaultValue: 80, min: 0, max: 1000 },
      { name: "jitterMs", label: "Jitter ms", type: "number", defaultValue: 10, min: 0, max: 500 },
      { name: "lossPercent", label: "Packet loss %", type: "number", defaultValue: 0.5, min: 0, max: 100 }
    ]
  },
  {
    slug: "dmarc-xml-report-analyzer",
    title: "DMARC XML Report Analyzer",
    shortTitle: "DMARC XML",
    category: "Email security tools",
    description: "Paste a DMARC aggregate XML report to summarize sources, alignment, pass/fail counts, and policy movement.",
    inputLabel: "DMARC XML",
    placeholder: "<feedback>...</feedback>",
    serviceIntent: "Network Security",
    searchIntent: ["dmarc xml analyzer", "dmarc aggregate report analyzer", "dmarc report parser"],
    outputPromise: "Returns source IP rows, pass/fail counts, alignment signals, and enforcement recommendations.",
    cta: "Turn DMARC reports into action",
    icon: FileCheck2,
    fields: [
      {
        name: "xml",
        label: "DMARC aggregate XML",
        type: "textarea",
        placeholder: "<feedback><report_metadata>...</report_metadata><record>...</record></feedback>",
        required: true
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
