"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpenCheck, CloudCog, RadioTower, ShieldCheck, Siren, Target } from "lucide-react";

const routes = [
  { label: "Fix an outage", href: "/solutions/network-outage-response", detail: "Stabilize service, isolate the fault domain, preserve evidence, and coordinate the next engineering move.", outcome: "Restore + explain", Icon: Siren },
  { label: "Clean firewall risk", href: "/solutions/firewall-rule-cleanup", detail: "Find stale access, risky administration paths, weak evidence, and the rules that need an accountable owner.", outcome: "Reduce exposure", Icon: ShieldCheck },
  { label: "Modernize access", href: "/solutions/sase-zero-trust-readiness", detail: "Map users, branches, applications, and policy before choosing a SASE, Zero Trust, or SD-WAN direction.", outcome: "Design the path", Icon: RadioTower },
  { label: "Review cloud exposure", href: "/solutions/cloud-network-exposure-review", detail: "Inspect VPC and VNet routes, public IPs, security groups, hybrid VPN, DNS, and flow evidence together.", outcome: "Make paths visible", Icon: CloudCog },
  { label: "Test and retest", href: "/solutions/pentest-remediation-retesting", detail: "Move from an authorized scope to findings, remediation ownership, retest evidence, and defensible closure.", outcome: "Prove the fix", Icon: Target },
  { label: "Build practical skill", href: "/solutions/network-security-career-labs", detail: "Choose labs that connect network foundations, security controls, cloud, SOC work, and troubleshooting decisions.", outcome: "Demonstrate skill", Icon: BookOpenCheck }
];

export function IntentRouter() {
  const [active, setActive] = useState(routes[0]);
  const ActiveIcon = active.Icon;

  return (
    <div className="intent-panel">
      <div className="intent-selector">
        <p className="eyebrow">Choose the pressure in front of you</p>
        <h2>Start with what is happening now.</h2>
        <p className="intent-intro">Select one signal. QCS will show the evidence and action path built for that situation.</p>
        <div className="intent-grid">
          {routes.map((route) => {
            const Icon = route.Icon;
            return (
              <button
                aria-pressed={active.label === route.label}
                className={active.label === route.label ? "active" : ""}
                key={route.label}
                onClick={() => setActive(route)}
                type="button"
              >
                <Icon aria-hidden="true" size={19} />
                <span>{route.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="intent-result">
        <div className="intent-result-status">
          <span>Selected signal</span>
          <strong>{active.outcome}</strong>
        </div>
        <div className="intent-route-map" aria-hidden="true">
          <span>Signal</span><i /><span>Evidence</span><i /><span>Action</span>
        </div>
        <ActiveIcon className="intent-result-icon" aria-hidden="true" size={42} />
        <h3>{active.label}</h3>
        <p>{active.detail}</p>
        <Link className="button primary" href={active.href}>
          Open this path <ArrowRight aria-hidden="true" size={17} />
        </Link>
      </div>
    </div>
  );
}
