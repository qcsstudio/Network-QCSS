import Link from "next/link";
import Image from "next/image";

const navItems = [
  { href: "/solutions", label: "Solutions" },
  { href: "/#services", label: "Services" },
  { href: "/diagnose", label: "Assessments" },
  { href: "/network-tools", label: "Tools" },
  { href: "/institute", label: "Institute" },
  { href: "/resources", label: "Resources" }
];

export function SiteHeader() {
  return (
    <header className="site-header command-header">
      <span className="header-scanline" aria-hidden="true" />
      <Link className="brand command-brand" href="/">
        <span className="brand-mark-shell">
          <Image
            className="brand-logo"
            src="/brand/quantumcrafters-logo.png"
            alt="QuantumCrafters Studio Pvt. Ltd."
            width={262}
            height={80}
            priority
            style={{ width: "100%", height: "auto" }}
          />
        </span>
        <span className="brand-status">
          <span>Network Command</span>
          <strong>Global + India</strong>
        </span>
      </Link>

      <div className="header-core">
        <nav className="main-nav command-nav-shell" aria-label="Main navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="header-status-grid" aria-hidden="true">
          <span>Operate</span>
          <span>Secure</span>
          <span>Test</span>
        </div>
      </div>

      <Link className="button primary header-cta" href="/diagnose">
        <span className="cta-pulse" aria-hidden="true" />
        Start Assessment
      </Link>
    </header>
  );
}
