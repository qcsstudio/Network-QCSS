"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { FileText, LayoutDashboard, ScanSearch, Share2, ShieldAlert, type LucideIcon } from "lucide-react";

const tabIds = ["overview", "content", "advisories", "distribution", "verifygrid"] as const;
type AdminTabId = (typeof tabIds)[number];

type AdminDashboardTabsProps = {
  advisories: ReactNode;
  badges: Record<AdminTabId, number | string>;
  content: ReactNode;
  distribution: ReactNode;
  overview: ReactNode;
  verifygrid: ReactNode;
};

const tabDefinitions: Array<{ id: AdminTabId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "content", label: "Content", icon: FileText },
  { id: "advisories", label: "Advisories", icon: ShieldAlert },
  { id: "distribution", label: "Distribution", icon: Share2 },
  { id: "verifygrid", label: "VerifyGrid", icon: ScanSearch }
];

const badgeDescriptions: Record<AdminTabId, string> = {
  advisories: "managed advisories",
  content: "managed content items",
  distribution: "distribution status",
  overview: "captured leads",
  verifygrid: "VerifyGrid access status"
};

function tabFromHash() {
  if (typeof window === "undefined") return "overview" as AdminTabId;
  const value = window.location.hash.replace(/^#/, "").toLowerCase();
  return tabIds.includes(value as AdminTabId) ? (value as AdminTabId) : "overview";
}

export function AdminDashboardTabs({ advisories, badges, content, distribution, overview, verifygrid }: AdminDashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<AdminTabId>("overview");
  const tabRefs = useRef<Record<AdminTabId, HTMLButtonElement | null>>({
    advisories: null,
    content: null,
    distribution: null,
    overview: null,
    verifygrid: null
  });
  const panels: Record<AdminTabId, ReactNode> = { advisories, content, distribution, overview, verifygrid };

  useEffect(() => {
    const syncFromHash = () => setActiveTab(tabFromHash());
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  function selectTab(id: AdminTabId, focus = false) {
    setActiveTab(id);
    const nextUrl = `${window.location.pathname}${window.location.search}#${id}`;
    window.history.replaceState(null, "", nextUrl);
    if (focus) tabRefs.current[id]?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: AdminTabId) {
    const currentIndex = tabIds.indexOf(current);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabIds.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabIds.length - 1;
    else return;
    event.preventDefault();
    selectTab(tabIds[nextIndex], true);
  }

  return (
    <div className="admin-tab-workspace">
      <div className="admin-tab-bar">
        <div aria-label="Administration sections" className="admin-primary-tabs" role="tablist">
          {tabDefinitions.map(({ id, label, icon: Icon }) => (
            <button
              aria-controls={`admin-panel-${id}`}
              aria-selected={activeTab === id}
              id={`admin-tab-${id}`}
              key={id}
              onClick={() => selectTab(id)}
              onKeyDown={(event) => handleTabKeyDown(event, id)}
              ref={(node) => { tabRefs.current[id] = node; }}
              role="tab"
              tabIndex={activeTab === id ? 0 : -1}
              type="button"
            >
              <Icon aria-hidden="true" size={18} />
              <span>{label}</span>
              <strong aria-label={`${badges[id]} ${badgeDescriptions[id]}`} title={badgeDescriptions[id]}>{badges[id]}</strong>
            </button>
          ))}
        </div>
      </div>

      {tabDefinitions.map(({ id }) => (
        <section
          aria-labelledby={`admin-tab-${id}`}
          className="admin-tab-panel"
          hidden={activeTab !== id}
          id={`admin-panel-${id}`}
          key={id}
          role="tabpanel"
          tabIndex={0}
        >
          {panels[id]}
        </section>
      ))}
    </div>
  );
}
