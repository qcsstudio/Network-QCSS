"use client";

import Link from "next/link";
import { useState } from "react";

const routes = [
  { label: "Fix an outage", href: "/solutions/network-outage-response", detail: "Emergency triage, RCA, vendor escalation, and stabilization path." },
  { label: "Clean firewall risk", href: "/solutions/firewall-rule-cleanup", detail: "Rule cleanup, VPN hardening, admin access, backups, and logs." },
  { label: "Modernize access", href: "/solutions/sase-zero-trust-readiness", detail: "SASE, Zero Trust, SD-WAN direction, cloud access, and remote workforce security." },
  { label: "Review cloud exposure", href: "/solutions/cloud-network-exposure-review", detail: "VPC/VNet routes, public IPs, security groups, hybrid VPN, and flow logs." },
  { label: "Test and retest", href: "/solutions/pentest-remediation-retesting", detail: "Pentest scoping, remediation support, retesting, and closure evidence." },
  { label: "Learn network security", href: "/solutions/network-security-career-labs", detail: "Practical career labs for networking, firewalls, cloud, SOC, and ethical hacking." }
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
