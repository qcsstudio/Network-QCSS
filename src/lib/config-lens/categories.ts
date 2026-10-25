export const categoryCatalog = {
  Interfaces: { label: "Interfaces & addressing", purpose: "Physical ports and logical connections. Their configured addresses and settings do not prove a cable is connected or a link is working." },
  Switching: { label: "Switching & VLANs", purpose: "How local networks are separated and how switch ports, VLANs and link bundles are configured." },
  Routing: { label: "Routing & VRFs", purpose: "Instructions for choosing a destination's next hop, and separate routing contexts. Configured routes are not the live routing table." },
  "SD-WAN": { label: "SD-WAN", purpose: "Configured WAN members, health checks and path-selection rules. Live link measurements are not available in this export." },
  Firewall: { label: "Firewall policies & ACLs", purpose: "Conditions and actions for traffic rules. Order, attachment and other settings must be checked before predicting whether traffic will pass." },
  Objects: { label: "Addresses & services", purpose: "Reusable names for networks, groups, services and schedules. A definition does not itself permit traffic." },
  NAT: { label: "NAT & virtual IPs", purpose: "Address-translation objects and rules. Translation and permission to access a service are different decisions." },
  VPN: { label: "VPN & tunnels", purpose: "Configured peers, tunnels and negotiation settings. This export cannot show whether a tunnel is currently connected." },
  "Security profiles": { label: "Security inspection", purpose: "Inspection profiles such as intrusion prevention and web filtering. A configured profile is not proof that threats are being blocked." },
  "Application firewall": { label: "Web application firewall", purpose: "Web policies, virtual endpoints and backend pools. Protection and forwarding depend on the application's operating mode." },
  Wireless: { label: "Wireless", purpose: "Wireless controller and access-point configuration. Radio coverage, interference and client connectivity require live observation." },
  "Network services": { label: "DHCP, DNS & time", purpose: "Address allocation, name lookup and time services. A configured server may still be unreachable." },
  Management: { label: "Administration & access", purpose: "Who can manage the device and which management services are configured. Sensitive values remain masked." },
  Logging: { label: "Logging & monitoring", purpose: "Where events and monitoring data are configured to go. This is not evidence that a collector is receiving them." },
  "High availability": { label: "High availability", purpose: "Settings for device redundancy and state sharing. Peer health and failover are not tested here." },
  System: { label: "System & automation", purpose: "Device-wide identity, features and automation settings. Not every field in these sections has a supported explanation." },
  Structure: { label: "Export structure", purpose: "Global boundaries and masked export headers. These organize the file rather than describe a traffic operation." },
  Other: { label: "Other / unclassified", purpose: "Statements whose function cannot be classified reliably. They remain visible for review against the selected product's documentation." }
} as const;
export type Category = keyof typeof categoryCatalog;
export const categoryOrder = Object.keys(categoryCatalog) as Category[];

// Classification uses syntax/context only. It never upgrades an unknown statement's status.
export function classifyCategory(vendor: string, text: string, section: string, fallback: Category): Category {
  if (vendor === "fortinet") {
    if (section === "system interface" && /^(?:set|unset|append|unselect)\s+(?:lacp-mode|lacp-speed|min-links|min-links-down)\b/.test(text.trim())) return "Switching";
    if (/^system (?:sdwan|virtual-wan-link)\b/.test(section)) return "SD-WAN";
    if (/^system (?:switch-interface|virtual-switch)\b|^(?:switch|switch-controller)\b/.test(section)) return "Switching";
    if (/^system interface\b/.test(section)) return "Interfaces";
    if (/^router\b/.test(section)) return "Routing";
    if (/^firewall (?:vip\S*|ippool\S*|central-snat-map|central-dnat-map)\b/.test(section)) return "NAT";
    if (/^firewall (?:address\S*|addrgrp\S*|service|schedule|internet-service-custom\S*)\b/.test(section)) return "Objects";
    if (/^(?:antivirus|ips|webfilter|dnsfilter|emailfilter|dlp|application|voip|ssh-filter)\b|^firewall ssl-ssh-profile\b/.test(section)) return "Security profiles";
    if (/^firewall\b/.test(section)) return "Firewall";
    if (/^vpn\b/.test(section)) return "VPN";
    if (/^server-policy\b|^waf\b/.test(section)) return "Application firewall";
    if (/^wireless-controller\b/.test(section)) return "Wireless";
    if (/^(?:log|report)\b/.test(section)) return "Logging";
    if (/^system (?:ha|cluster-sync|standalone-cluster)\b/.test(section)) return "High availability";
    if (/^system (?:dns\S*|dhcp\S*|ntp|ipam)\b/.test(section)) return "Network services";
    if (/^user\b|^system (?:admin|accprofile|password-policy\S*|snmp|central-management|api-user|sso\S*)\b/.test(section)) return "Management";
    if (/^system\b/.test(section)) return "System";
    return section === "Global" ? "Structure" : "Other";
  }
  const t = text.trim().replace(/^no\s+/, "");
  if (/^(?:ip nat|nat|global)\b/.test(t)) return "NAT";
  if (/^(?:logging|snmp-server|monitor session|flow exporter|flow monitor)\b/.test(t)) return "Logging";
  if (/^(?:ip (?:dhcp|dns|name-server|domain|helper-address)|dns-server|default-router|ntp)\b/.test(t)) return "Network services";
  if (/^(?:standby|vrrp|hsrp|failover|redundancy)\b/.test(t)) return "High availability";
  if (/^(?:hostname|version|boot|feature|service)\b/.test(t)) return "System";
  if (/^object(?:-group)?\b/.test(section)) return "Objects";
  if (/^ip dhcp pool\b/.test(section)) return "Network services";
  if (/^crypto\b/.test(section) || /^crypto\b/.test(t)) return "VPN";
  if (/^aaa\b|^line\b/.test(section)) return "Management";
  if (/^route-map\b/.test(section)) return "Routing";
  if (fallback !== "Structure") return fallback;
  if (/^interface\b/.test(section)) return "Interfaces";
  if (/^vlan\b/.test(section)) return "Switching";
  if (/^(?:router|ip vrf|vrf)\b/.test(section)) return "Routing";
  if (/^(?:ip|ipv6) access-list\b/.test(section) || /^access-list\b/.test(t)) return "Firewall";
  if (/^line\b/.test(section)) return "Management";
  return /^\[MASKED:|^(?:end|exit|exit-address-family)$/.test(t) ? "Structure" : "Other";
}
