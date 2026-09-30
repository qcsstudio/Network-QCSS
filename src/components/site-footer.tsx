import { ArrowRight, ArrowUp, Globe2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const footerGroups = [
  {
    title: "Expertise",
    links: [
      ["Managed networks", "/services/managed-network-services"],
      ["Network security", "/services/network-security-services"],
      ["Penetration testing", "/services/penetration-testing"],
      ["Cloud networking", "/services/cloud-network-services"],
      ["Explore solutions", "/solutions"],
    ],
  },
  {
    title: "Learn & explore",
    links: [
      ["Intelligence", "/intelligence"],
      ["Security advisories", "/security-advisories"],
      ["Blog & resources", "/resources"],
      ["Training institute", "/institute"],
      ["CCNA course", "/courses/ccna"],
      ["Free network tools", "/network-tools"],
    ],
  },
  {
    title: "Connect",
    links: [
      ["Discuss a project", "/#contact"],
      ["Assessments", "/diagnose"],
      ["Client sign in", "/portal/access"],
      ["Admin sign in", "/admin/login"],
      ["Privacy policy", "/privacy"],
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="site-footer qcs-footer" id="site-footer">
      <div className="qcs-footer-inner">
        <div className="qcs-footer-invitation">
          <div>
            <p className="qcs-footer-kicker">Your next step, made clear</p>
            <h2>Let&apos;s talk about what comes next.</h2>
            <p>Network, security or cloud. Bring us the challenge.</p>
          </div>
          <Link className="qcs-footer-cta" href="/#contact">
            Discuss your project <ArrowRight size={20} aria-hidden="true" />
          </Link>
        </div>

        <div className="qcs-footer-directory">
          <div className="qcs-footer-brand">
            <Link href="/" className="qcs-footer-logo-link" aria-label="QuantumCrafters Studio home">
              <Image className="qcs-footer-logo" src="/brand/quantumcrafters-logo.png" alt="QuantumCrafters Studio Pvt. Ltd." width={230} height={71} sizes="230px" />
            </Link>
            <p>Practical network, security and cloud consulting. Built around your team, your environment and your next decision.</p>
            <p className="qcs-footer-reach"><Globe2 size={18} aria-hidden="true" /> India and international clients</p>
          </div>
          <nav className="qcs-footer-links" aria-label="Footer links">
            {footerGroups.map((group) => (
              <div className="qcs-footer-group" key={group.title}>
                <h3>{group.title}</h3>
                <ul>
                  {group.links.map(([label, href]) => <li key={href}><Link href={href}>{label}</Link></li>)}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="qcs-footer-bottom">
          <p>&copy; {new Date().getFullYear()} QuantumCrafters Studio Pvt. Ltd.</p>
          <a href="#main-content">Back to top <ArrowUp size={18} aria-hidden="true" /></a>
        </div>
      </div>
    </footer>
  );
}
