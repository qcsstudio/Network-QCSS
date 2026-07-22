import type { SecurityAdvisory } from "@prisma/client";
import type { BlogPost } from "@/lib/blog";

export function resourceVisualPath(post: BlogPost) {
  const context = `${post.title} ${post.category} ${post.primaryKeyword} ${post.keywords.join(" ")}`.toLowerCase();
  if (/packet capture|pcap|wireshark|troubleshoot|incident|operations/.test(context)) return "/brand/envato/cyber/network-service-operator.jpg";
  if (/password|identity|access|credential|authentication/.test(context)) return "/brand/envato/objects/locked-data-folder.png";
  if (/vpn|remote access|zero trust|sase/.test(context)) return "/brand/envato/objects/vpn-symbol.png";
  if (/bgp|rpki|roa|routing|router|switch/.test(context)) return "/brand/envato/illustrations/isometric-data-center-network.svg";
  if (/cloud|vpc|vnet|azure|aws|multicloud/.test(context)) return "/brand/envato/cyber/data-access-cloud.png";
  if (/server|data center|infrastructure|availability|capacity/.test(context)) return "/brand/envato/library/server-cluster-engineer.webp";
  if (/firewall|vulnerability|patch|cve|kev|security|exposure/.test(context)) return "/brand/envato/cyber/security-shield-network.png";
  return post.image?.startsWith("/") ? post.image : "/brand/envato/library/security-network-shield.webp";
}

export function advisoryVisualPath(advisory: Pick<SecurityAdvisory, "title" | "vendor" | "summary" | "products">) {
  const products = Array.isArray(advisory.products) ? advisory.products.filter((item): item is string => typeof item === "string").join(" ") : "";
  const context = `${advisory.title} ${advisory.vendor} ${advisory.summary} ${products}`.toLowerCase();
  if (/vpn|globalprotect|remote access|zero trust|sase/.test(context)) return "/brand/envato/objects/vpn-symbol.png";
  if (/cloud|vpc|vnet|azure|aws|multicloud/.test(context)) return "/brand/envato/cyber/data-access-cloud.png";
  if (/router|routing|bgp|ios|junos|nx-os|switch/.test(context)) return "/brand/envato/illustrations/isometric-data-center-network.svg";
  if (/identity|access|credential|authentication/.test(context)) return "/brand/envato/objects/locked-data-folder.png";
  if (/server|data center|load balancer|f5|netscaler/.test(context)) return "/brand/envato/objects/server-tower.png";
  if (/firewall|fortigate|pan-os|vulnerability|patch|cve|exploit|security/.test(context)) return "/brand/envato/cyber/security-shield-network.png";
  return "/brand/envato/library/padlock-security.webp";
}
