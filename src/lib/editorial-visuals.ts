import type { SecurityAdvisory } from "@prisma/client";
import type { BlogPost } from "@/lib/blog";

export type EditorialVisualMotif =
  | "capture"
  | "cloud"
  | "identity"
  | "infrastructure"
  | "remote-access"
  | "routing"
  | "security";

export type EditorialVisualProfile = {
  motif: EditorialVisualMotif;
  eyebrow: string;
  focus: string;
  tags: string[];
  accent: string;
  secondary: string;
  signal: string;
  signature: string;
  variant: number;
};

type VisualTheme = {
  focus: string;
  signal: string;
  palettes: [string, string, string][];
};

const visualThemes: Record<EditorialVisualMotif, VisualTheme> = {
  capture: {
    focus: "Packet flow evidence",
    signal: "PCAP",
    palettes: [["#e72d68", "#ff8a3d", "#46bfd9"], ["#426bcc", "#f04b69", "#f29a42"]]
  },
  cloud: {
    focus: "Cloud path and exposure",
    signal: "CLOUD",
    palettes: [["#426bcc", "#32a8ce", "#e62e68"], ["#315fc4", "#f0803d", "#4cbac8"]]
  },
  identity: {
    focus: "Identity and access gate",
    signal: "ACCESS",
    palettes: [["#d62c67", "#6b61c9", "#f18a3d"], ["#4169c9", "#e42e68", "#42b7c7"]]
  },
  infrastructure: {
    focus: "Infrastructure health map",
    signal: "UPTIME",
    palettes: [["#4169c9", "#30a9c7", "#f0803c"], ["#d62c67", "#4c70c9", "#46b89a"]]
  },
  "remote-access": {
    focus: "Trusted access path",
    signal: "ZTNA",
    palettes: [["#e42f68", "#426bcc", "#46b9c9"], ["#3a67ca", "#f1813d", "#d62c67"]]
  },
  routing: {
    focus: "Route origin and path",
    signal: "ROUTE",
    palettes: [["#426bcc", "#2facc4", "#f07c38"], ["#d62c67", "#426bcc", "#46b98f"]]
  },
  security: {
    focus: "Exposure and control path",
    signal: "SECURE",
    palettes: [["#d62c67", "#f0803c", "#426bcc"], ["#bf294f", "#426bcc", "#36afbd"]]
  }
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function compactTag(value: string) {
  const normalized = value.replace(/\s+/g, " ").replace(/^[-|,.:;\s]+|[-|,.:;\s]+$/g, "").trim();
  if (normalized.length <= 24) return normalized;
  return `${normalized.slice(0, 21).trim()}...`;
}

function uniqueTags(values: string[], fallbacks: string[]) {
  const tags: string[] = [];
  for (const value of [...values, ...fallbacks]) {
    const tag = compactTag(value);
    if (!tag || tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) continue;
    tags.push(tag);
    if (tags.length === 3) break;
  }
  return tags;
}

function motifForContext(context: string): EditorialVisualMotif {
  if (/packet capture|pcap|wireshark|troubleshoot|incident|forensic|diagnostic/.test(context)) return "capture";
  if (/password|identity|credential|authentication|privilege|login/.test(context)) return "identity";
  if (/bgp|rpki|roa|routing|router|route origin|switch|\bios\b|junos|nx-os/.test(context)) return "routing";
  if (/cloud|vpc|vnet|azure|aws|gcp|multicloud|workload/.test(context)) return "cloud";
  if (/vpn|remote access|zero trust|sase|ztna/.test(context)) return "remote-access";
  if (/server|data center|infrastructure|availability|capacity|load balancer/.test(context)) return "infrastructure";
  return "security";
}

function createProfile(input: {
  title: string;
  context: string;
  eyebrow: string;
  tags: string[];
  fallbackTags: string[];
}): EditorialVisualProfile {
  const motif = motifForContext(input.context);
  const hash = stableHash(`${input.title}|${input.context}`);
  const theme = visualThemes[motif];
  const palette = theme.palettes[hash % theme.palettes.length];
  return {
    motif,
    eyebrow: input.eyebrow,
    focus: theme.focus,
    tags: uniqueTags(input.tags, input.fallbackTags),
    accent: palette[0],
    secondary: palette[1],
    signal: theme.signal,
    signature: `QCS-${hash.toString(16).toUpperCase().padStart(8, "0").slice(0, 8)}`,
    variant: hash % 3
  };
}

export function resourceVisualProfile(post: BlogPost): EditorialVisualProfile {
  const context = `${post.title} ${post.category} ${post.primaryKeyword} ${post.keywords.join(" ")}`.toLowerCase();
  return createProfile({
    title: post.title,
    context,
    eyebrow: post.contentType === "resource" ? "QCS operational resource" : "QCS network intelligence",
    tags: [post.primaryKeyword, ...post.keywords, post.category],
    fallbackTags: ["Evidence", "Ownership", "Next action"]
  });
}

export function advisoryVisualProfile(
  advisory: Pick<SecurityAdvisory, "title" | "vendor" | "summary" | "products" | "cves" | "severity">
): EditorialVisualProfile {
  const products = Array.isArray(advisory.products) ? advisory.products.filter((item): item is string => typeof item === "string") : [];
  const cves = Array.isArray(advisory.cves) ? advisory.cves.filter((item): item is string => typeof item === "string") : [];
  const context = `${advisory.title} ${advisory.vendor} ${advisory.summary} ${products.join(" ")} ${cves.join(" ")}`.toLowerCase();
  return createProfile({
    title: advisory.title,
    context,
    eyebrow: "QCS security advisory desk",
    tags: [advisory.vendor, ...products, ...cves],
    fallbackTags: [String(advisory.severity), "Source verified", "Action required"]
  });
}

export function fallbackVisualProfile(title = "QCS Network Intelligence"): EditorialVisualProfile {
  return createProfile({
    title,
    context: "network security operations evidence",
    eyebrow: "QCS network intelligence",
    tags: ["Network", "Security", "Cloud"],
    fallbackTags: ["Evidence", "Ownership", "Next action"]
  });
}
