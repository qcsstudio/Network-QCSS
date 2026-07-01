import Link from "next/link";
import { ShieldCheck } from "lucide-react";

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
        <span className="brand-mark">
          <ShieldCheck size={20} />
        </span>
        <span>
          <strong>Network QCSS</strong>
          <small>Command Growth OS</small>
        </span>
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
