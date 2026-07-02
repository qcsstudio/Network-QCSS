import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/components/lead-form";

export const metadata: Metadata = {
  title: "Network and Network Security Institute",
  description: "Hands-on training for CCNA, CCNP, firewall administration, cloud networking, SOC, and penetration testing."
};

const tracks = ["CCNA foundation", "CCNP enterprise", "Firewall administration", "Cloud networking", "SOC analyst", "Ethical hacking labs"];

export default function InstitutePage() {
  return (
    <main>
      <section className="page-hero">
        <p className="eyebrow">Institute</p>
        <h1>Practical network and network security training built from real operations work.</h1>
        <p>
          Student, professional, and corporate training tracks backed by diagnostics, labs, and service delivery
          credibility.
        </p>
        <Link className="button primary" href="/tools/career-path-finder">
          Find My Career Path
        </Link>
      </section>

      <section className="section">
        <div className="service-grid">
          {tracks.map((track) => (
            <article className="service-card" key={track}>
              <p className="eyebrow">Training track</p>
              <h3>{track}</h3>
              <p>Built for hands-on learning, practical troubleshooting, and job-ready network security skills.</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section split">
        <div className="section-heading">
          <p className="eyebrow">Enrollment path</p>
          <h2>Route students, working professionals, and corporate teams separately.</h2>
        </div>
        <LeadForm interest="Network security training" pipeline="Training / Institute" />
      </section>
    </main>
  );
}
