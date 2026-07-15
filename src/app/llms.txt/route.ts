import { networkUtilityTools } from "@/lib/network-tools";
import { services, siteConfig, tools } from "@/lib/content";

export const dynamic = "force-static";

export function GET() {
  const lines = [
    "# QuantumCrafters Studio Pvt. Ltd.",
    "",
    "> Network operations, network security, managed network services, cloud network services, penetration testing, troubleshooting, and network security training for India and global teams.",
    "",
    `Website: ${siteConfig.url}`,
    "",
    "## Core Service Pages",
    ...services.map((service) => `- ${service.title}: ${siteConfig.url}/services/${service.slug} - ${service.summary}`),
    "",
    "## Diagnostic Assessment Tools",
    ...tools.map((tool) => `- ${tool.title}: ${siteConfig.url}/tools/${tool.slug} - ${tool.description}`),
    "",
    "## Free Online Network Utility Tools",
    ...networkUtilityTools.map((tool) => `- ${tool.title}: ${siteConfig.url}/network-tools/${tool.slug} - ${tool.description}`),
    "",
    "## Positioning",
    "- Engineering-led studio model: operate, secure, monitor, test, and train.",
    "- Best fit: growing companies, multi-site teams, cloud-connected businesses, institutes, and organizations needing accountable network/security help.",
    "- Private operator layer: consent-aware tracking, lead funnel, service pipeline mix, tool usage, assessments, resources, and readiness data."
  ];

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600"
    }
  });
}
