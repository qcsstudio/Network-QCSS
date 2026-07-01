"use client";

import Link from "next/link";
import { useState } from "react";

const routes = [
  { label: "Fix an outage", href: "/services/network-troubleshooting", detail: "Emergency troubleshooting and root-cause triage." },
  { label: "Secure my network", href: "/tools/firewall-hygiene", detail: "Firewall hygiene, segmentation, VPN, SASE, and ZTNA." },
  { label: "Monitor infrastructure", href: "/tools/network-risk-score", detail: "Managed network services and NOC workflow readiness." },
  { label: "Test vulnerabilities", href: "/tools/pentest-readiness", detail: "Penetration testing scope and readiness." },
  { label: "Learn network security", href: "/tools/career-path-finder", detail: "Training and institute path recommendation." }
];

export function IntentRouter() {
  const [active, setActive] = useState(routes[0]);

  return (
    <div className="intent-panel">
      <div>
        <p className="eyebrow">Problem router</p>
        <h2>What do you need help with today?</h2>
        <div className="intent-grid">
          {routes.map((route) => (
            <button className={active.label === route.label ? "active" : ""} key={route.label} onClick={() => setActive(route)} type="button">
              {route.label}
            </button>
          ))}
        </div>
      </div>
      <div className="intent-result">
        <p>{active.detail}</p>
        <Link className="button primary" href={active.href}>
          Continue
        </Link>
      </div>
    </div>
  );
}
