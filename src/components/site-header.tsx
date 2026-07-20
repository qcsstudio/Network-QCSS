"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/solutions", label: "Solutions" },
  { href: "/#services", label: "Services" },
  { href: "/diagnose", label: "Assessments", mobileLabel: "Assess" },
  { href: "/network-tools", label: "Tools" },
  { href: "/institute", label: "Institute" },
  { href: "/resources", label: "Resources", mobileLabel: "Learn" }
];

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 18);

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.body.classList.add("mobile-menu-locked");
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("mobile-menu-locked");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const isActive = (href: string) => href !== "/#services" && pathname === href;

  return (
    <header className={`site-header command-header ${scrolled ? "is-scrolled" : ""} ${menuOpen ? "is-menu-open" : ""}`}>
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
            loading="eager"
            style={{ width: "100%", height: "auto" }}
          />
        </span>
      </Link>

      <nav className="main-nav command-nav-shell" aria-label="Main navigation">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className={isActive(item.href) ? "is-active" : undefined} aria-current={isActive(item.href) ? "page" : undefined}>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <button
        className="mobile-menu-toggle"
        type="button"
        aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={menuOpen}
        aria-controls="site-mobile-menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        {menuOpen ? <X aria-hidden="true" size={20} strokeWidth={2.2} /> : <Menu aria-hidden="true" size={21} strokeWidth={2.2} />}
      </button>

      <button
        className="mobile-menu-backdrop"
        type="button"
        aria-label="Close navigation menu"
        onClick={() => setMenuOpen(false)}
        tabIndex={menuOpen ? 0 : -1}
      />

      <nav id="site-mobile-menu" className="mobile-command-nav" aria-label="Mobile navigation">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isActive(item.href) ? "is-active" : undefined}
            aria-current={isActive(item.href) ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <span>{item.mobileLabel ?? item.label}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
