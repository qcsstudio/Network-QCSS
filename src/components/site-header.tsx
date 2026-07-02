import Link from "next/link";
import Image from "next/image";

const navItems = [
  { href: "/#services", label: "Services" },
  { href: "/#tools", label: "Tools" },
  { href: "/institute", label: "Institute" },
  { href: "/resources", label: "Resources" },
  { href: "/admin", label: "Admin" }
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <Image
          className="brand-logo"
          src="/brand/quantumcrafters-logo.png"
          alt="QuantumCrafters Studio Pvt. Ltd."
          width={262}
          height={80}
          priority
        />
      </Link>

      <nav className="main-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>

      <Link className="button primary" href="/tools/network-risk-score">
        Get Risk Score
      </Link>
    </header>
  );
}
