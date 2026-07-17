import Link from "next/link";
import Image from "next/image";

const navItems = [
  { href: "/solutions", label: "Solutions" },
  { href: "/#services", label: "Services" },
  { href: "/diagnose", label: "Assessments", mobileLabel: "Assess" },
  { href: "/network-tools", label: "Tools" },
  { href: "/institute", label: "Institute" },
  { href: "/resources", label: "Resources", mobileLabel: "Learn" }
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
      </Link>

      <nav className="main-nav command-nav-shell" aria-label="Main navigation">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <nav className="mobile-command-nav" aria-label="Compact navigation">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <span>{item.mobileLabel ?? item.label}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
