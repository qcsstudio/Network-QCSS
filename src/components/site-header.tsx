"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const navItems = [
  { href: "/solutions", label: "Solutions" },
  { href: "/#services", label: "Services" },
  { href: "/diagnose", label: "Assessments" },
  { href: "/network-tools", label: "Tools" },
  { href: "/institute", label: "Institute" },
  { href: "/intelligence", label: "Intelligence" }
];

export function SiteHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const mobileMenu = useRef<HTMLElement>(null);

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

    const closeMenu = () => {
      setMenuOpen(false);
      menuToggle.current?.focus();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu();
      }
      if (event.key === "Tab") {
        const controls = [menuToggle.current, ...Array.from(mobileMenu.current?.querySelectorAll<HTMLAnchorElement>("a[href]") ?? [])].filter(Boolean) as HTMLElement[];
        const index = controls.indexOf(document.activeElement as HTMLElement);
        if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === controls.length - 1)) {
          event.preventDefault();
          controls[event.shiftKey ? controls.length - 1 : 0]?.focus();
        }
      }
    };
    const desktop = window.matchMedia("(min-width: 1081px)");
    const handleResize = () => {
      if (desktop.matches) setMenuOpen(false);
    };

    document.body.classList.add("mobile-menu-locked");
    const background = [document.getElementById("main-content"), document.querySelector<HTMLElement>(".site-footer")].filter(Boolean) as HTMLElement[];
    const previousInert = background.map((element) => element.inert);
    background.forEach((element) => { element.inert = true; });
    mobileMenu.current?.querySelector<HTMLAnchorElement>("a[href]")?.focus();
    desktop.addEventListener("change", handleResize);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("mobile-menu-locked");
      background.forEach((element, index) => { element.inert = previousInert[index]; });
      desktop.removeEventListener("change", handleResize);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const isActive = (href: string) => {
    if (href === "/#services") return pathname.startsWith("/services/");
    if (href === "/institute" && pathname.startsWith("/courses/")) return true;
    if (href === "/intelligence" && (pathname.startsWith("/resources") || pathname.startsWith("/security-advisories"))) return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <header
      className={`site-header command-header ${pathname === "/" ? "is-home-context" : "is-light-context"} ${scrolled ? "is-scrolled" : ""} ${menuOpen ? "is-menu-open" : ""}`}
    >
      <span className="header-scanline" aria-hidden="true" />
      <Link className="brand command-brand" href="/" onClick={() => setMenuOpen(false)}>
        <span className="brand-mark-shell">
          <Image
            className="brand-logo"
            src="/brand/quantumcrafters-logo.png"
            alt="QuantumCrafters Studio Pvt. Ltd."
            width={184}
            height={57}
            sizes="(max-width: 760px) 158px, 184px"
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
        ref={menuToggle}
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
        onClick={() => { setMenuOpen(false); menuToggle.current?.focus(); }}
        tabIndex={-1}
        aria-hidden="true"
      />

      <nav ref={mobileMenu} id="site-mobile-menu" className="mobile-command-nav" aria-label="Mobile navigation" inert={!menuOpen}>
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={isActive(item.href) ? "is-active" : undefined}
            aria-current={isActive(item.href) ? "page" : undefined}
            onClick={() => setMenuOpen(false)}
          >
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
