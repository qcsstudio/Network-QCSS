"use client";

import { ArrowRight, ArrowUpRight, ChevronDown, Globe2, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isWorkspacePath, navigationIsActive, siteNavigation } from "@/lib/site-navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const menuToggle = useRef<HTMLButtonElement>(null);
  const mobileMenu = useRef<HTMLElement>(null);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setExpanded(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      header.current?.querySelector<HTMLButtonElement>(`[data-nav="${expanded}"]`)?.focus();
      setExpanded(null);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [expanded]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => { setMenuOpen(false); menuToggle.current?.focus(); };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
      if (event.key !== "Tab") return;
      const controls = [menuToggle.current, ...Array.from(mobileMenu.current?.querySelectorAll<HTMLElement>("a[href], summary") ?? [])]
        .filter((element): element is HTMLElement => Boolean(element?.getClientRects().length));
      const index = controls.indexOf(document.activeElement as HTMLElement);
      if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === controls.length - 1)) {
        event.preventDefault();
        controls[event.shiftKey ? controls.length - 1 : 0]?.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 1081px)");
    const resize = () => { if (desktop.matches) setMenuOpen(false); };
    const background = [document.getElementById("main-content"), document.querySelector<HTMLElement>(".site-footer")].filter(Boolean) as HTMLElement[];
    const previous = background.map((element) => element.inert);
    background.forEach((element) => { element.inert = true; });
    document.body.classList.add("mobile-menu-locked");
    mobileMenu.current?.querySelector<HTMLElement>("summary, a[href]")?.focus();
    document.addEventListener("keydown", keydown);
    desktop.addEventListener("change", resize);
    return () => {
      background.forEach((element, index) => { element.inert = previous[index]; });
      document.body.classList.remove("mobile-menu-locked");
      document.removeEventListener("keydown", keydown);
      desktop.removeEventListener("change", resize);
    };
  }, [menuOpen]);

  if (isWorkspacePath(pathname)) return null;
  const closeMenus = () => { setExpanded(null); setMenuOpen(false); };

  return (
    <header ref={header} className={`site-header enterprise-header ${menuOpen ? "is-menu-open" : ""}`}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(null); }}>
      <div className="header-utility">
        <span><Globe2 size={13} aria-hidden="true" /> India &amp; international</span>
        <div><Link href="/diagnose" onClick={closeMenus}>Start an assessment</Link><Link href="/portal/access" onClick={closeMenus}>Client sign in <ArrowUpRight size={13} aria-hidden="true" /></Link></div>
      </div>
      <div className="header-main">
        <Link className="brand" href="/" onClick={closeMenus}>
          <Image className="brand-logo" src="/brand/quantumcrafters-logo.png" alt="QuantumCrafters Studio home" width={184} height={57} sizes="(max-width: 760px) 158px, 184px" priority />
        </Link>
        <nav className="main-nav enterprise-navigation" aria-label="Main navigation">
          {siteNavigation.map((item) => (
            <div className="navigation-group" key={item.label}>
              {item.links.length ? (
                <button type="button" data-nav={item.label} aria-expanded={expanded === item.label} aria-controls={`nav-${item.label.toLowerCase()}`}
                  className={navigationIsActive(item.href, pathname) ? "is-active" : undefined}
                  onClick={() => setExpanded(expanded === item.label ? null : item.label)}>
                  {item.label}<ChevronDown size={15} aria-hidden="true" />
                </button>
              ) : <Link href={item.href} onClick={closeMenus} aria-current={navigationIsActive(item.href, pathname) ? "page" : undefined}>{item.label}</Link>}
              {item.links.length > 0 && (
                <div id={`nav-${item.label.toLowerCase()}`} className="navigation-dropdown" hidden={expanded !== item.label}>
                  <div className="navigation-context"><p>{item.label}</p><strong>{item.description}</strong><Link href={item.href} onClick={closeMenus}>Explore {item.label.toLowerCase()} <ArrowRight size={17} aria-hidden="true" /></Link></div>
                  <div className="navigation-destinations">{item.links.map((link) => (
                    <Link key={link.href} href={link.href} onClick={closeMenus} aria-current={pathname === link.href ? "page" : undefined}>
                      <span><strong>{link.title}</strong><small>{link.description}</small></span><ArrowUpRight size={17} aria-hidden="true" />
                    </Link>
                  ))}</div>
                </div>
              )}
            </div>
          ))}
        </nav>
        <Link className="header-contact" href="/#contact" onClick={closeMenus}>Talk to QCS <ArrowUpRight size={17} aria-hidden="true" /></Link>
        <button ref={menuToggle} className="mobile-menu-toggle" type="button" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen} aria-controls="site-mobile-menu" onClick={() => { setMenuOpen(!menuOpen); setExpanded(null); }}>
          {menuOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
        </button>
      </div>
      <button className="mobile-menu-backdrop" type="button" aria-label="Close navigation menu" onClick={() => { setMenuOpen(false); menuToggle.current?.focus(); }} tabIndex={-1} aria-hidden="true" />
      <nav ref={mobileMenu} id="site-mobile-menu" className="mobile-command-nav enterprise-mobile-nav" aria-label="Mobile navigation" inert={!menuOpen}>
        {siteNavigation.map((item) => item.links.length ? (
          <details key={item.label}>
            <summary>{item.label}<ChevronDown size={18} aria-hidden="true" /></summary>
            {item.links.map((link) => <Link key={link.href} href={link.href} onClick={closeMenus} aria-current={pathname === link.href ? "page" : undefined}>{link.title}<ArrowUpRight size={16} aria-hidden="true" /></Link>)}
          </details>
        ) : <Link key={item.href} href={item.href} onClick={closeMenus} aria-current={navigationIsActive(item.href, pathname) ? "page" : undefined}>{item.label}<ArrowUpRight size={18} aria-hidden="true" /></Link>)}
        <div className="mobile-nav-contact"><Link href="/#contact" onClick={closeMenus}>Discuss your project <ArrowRight size={18} aria-hidden="true" /></Link><Link href="/portal/access" onClick={closeMenus}>Client sign in</Link></div>
      </nav>
    </header>
  );
}
