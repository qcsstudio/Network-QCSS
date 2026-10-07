export const siteNavigation = [
  {
    label: "Services", href: "/#services", description: "Specialist engineering. A clearly defined scope.",
    links: [
      { title: "Managed networks", href: "/services/managed-network-services", description: "Operations, ownership and ongoing support." },
      { title: "Network security", href: "/services/network-security-services", description: "Review exposure and strengthen controls." },
      { title: "Penetration testing", href: "/services/penetration-testing", description: "Authorized testing, findings and verification." },
      { title: "Cloud networking", href: "/services/cloud-network-services", description: "Plan and validate hybrid connectivity." },
      { title: "Troubleshooting", href: "/services/network-troubleshooting", description: "Trace faults across the affected path." },
      { title: "Guided assessments", href: "/diagnose", description: "Start with the issue you need to understand." },
    ],
  },
  { label: "Solutions", href: "/solutions", description: "", links: [] },
  {
    label: "Learning", href: "/institute", description: "Build understanding. Put it into practice.",
    links: [
      { title: "Training institute", href: "/institute", description: "Network and security skills for your team." },
      { title: "CCNA course", href: "/courses/ccna", description: "A structured syllabus, lessons and lab guides." },
      { title: "Start from the basics", href: "/courses/ccna/start-here", description: "Begin here, even without a technical background." },
    ],
  },
  {
    label: "Intelligence", href: "/intelligence", description: "Understand the source. Decide what applies.",
    links: [
      { title: "Intelligence overview", href: "/intelligence", description: "Find analysis, advisories and resources." },
      { title: "Security advisories", href: "/security-advisories", description: "Affected systems and vendor remediation guidance." },
      { title: "Articles and resources", href: "/resources", description: "Technical guides, checklists and engineering context." },
    ],
  },
  { label: "Tools", href: "/network-tools", description: "", links: [] },
];

export function navigationIsActive(href: string, pathname: string) {
  if (href === "/#services") return pathname.startsWith("/services/") || pathname === "/diagnose";
  if (href === "/institute" && pathname.startsWith("/courses/")) return true;
  if (href === "/intelligence" && (pathname.startsWith("/resources") || pathname.startsWith("/security-advisories"))) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isWorkspacePath(pathname: string) {
  return ["/admin", "/portal", "/verifygrid"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
