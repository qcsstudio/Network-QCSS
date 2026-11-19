import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FortigateCourseContent } from "@/components/fortigate-course-content";
import fragments from "@/content/fortigate-public/fragments.json";
import walks from "../../../../../public/fortigate-course/packet-walks.json";
import { createPageMetadata } from "@/lib/seo";
import { fortigateReaderHtml } from "@/lib/public-editorial-presentation";
import "../fortigate-course.css";

const pages: Record<string, { title: string; eyebrow: string; html: string }> = fragments;
const navigation = [
  ["", "Overview"],
  ["lab-setup", "GNS3 setup"],
  ["lessons/firewall-decisions", "01 · Firewall decisions"],
  ["lessons/ip-subnets-gateways", "02 · IP & gateways"],
  ["lessons/tcp-udp-ports-dns", "03 · Ports & DNS"],
  ["lab-reference", "Lab reference"],
  ["sources", "Sources"]
];
const summaries: Record<string, string> = {
  "": "Understand the decision. Follow the packet. Build your first isolated lab.",
  "lab-setup": "A guided path from an empty project to an isolated three-node learning workspace.",
  "lab-reference": "Keep your topology, addressing, checks and recovery steps close at hand.",
  "sources": "The references, boundaries and verification checks behind these foundations.",
  "lessons/firewall-decisions": "Trace a permitted request, its return traffic and a new connection that stops at the firewall.",
  "lessons/ip-subnets-gateways": "Follow subnet decisions, ARP, next-hop headers and the route a reply needs to get home.",
  "lessons/tcp-udp-ports-dns": "Read the headers behind a TCP exchange, a service port and a separate DNS lookup."
};
const lessonIds: Record<string, "1" | "2" | "3"> = {
  "lessons/firewall-decisions": "1",
  "lessons/ip-subnets-gateways": "2",
  "lessons/tcp-udp-ports-dns": "3"
};
type Props = { params: Promise<{ parts?: string[] }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(pages).map((key) => ({ parts: key ? key.split("/") : [] }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const key = ((await params).parts ?? []).join("/");
  if (!pages[key]) notFound();
  return createPageMetadata({
    title: pages[key].title,
    description: `${summaries[key]} Guided analysis with conditional practicals; appliance runtime validation is pending.`,
    path: `/courses/fortigate${key ? `/${key}` : ""}`,
    image: { url: `/fortigate-course/assets/lesson-${lessonIds[key] ?? "1"}-poster.png`, width: 1200, height: 1000, alt: "FortiGate foundations packet-flow lesson" }
  });
}

export default async function FortigatePage({ params }: Props) {
  const key = ((await params).parts ?? []).join("/");
  const page = pages[key];
  if (!page) notFound();
  const lesson = lessonIds[key];
  return (
    <main className="fg-course">
      <section className="page-hero fg-hero">
        <div className="fg-hero-copy">
          <Link className="fg-back" href="/institute">← QCS Institute</Link>
          <p className="eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p className="fg-intro">{summaries[key]}</p>
          <div className="fg-facts" aria-label="Course format">
            <span>3 foundation chapters</span><span>39 packet steps</span><span>Guided GNS3 setup</span>
          </div>
          <p className="fg-status">Guided analysis · conditional practicals · appliance runtime validation pending</p>
        </div>
      </section>
      <div className="fg-shell">
        <nav className="fg-navigation" aria-label="FortiGate course">
          {navigation.map(([slug, label]) => (
            <Link key={slug} href={`/courses/fortigate${slug ? `/${slug}` : ""}`}
              aria-current={slug === key ? "page" : undefined}>{label}</Link>
          ))}
        </nav>
        <noscript>
          <p className="fg-no-script">JavaScript is disabled. The packet player and scored quizzes require JavaScript.
            You can still read every step in the expandable packet reference, follow the lessons and lab guide,
            and use the video’s native playback controls.</p>
        </noscript>
        <FortigateCourseContent key={key} html={key === "sources" ? fortigateReaderHtml(page.html) : page.html} steps={lesson ? walks[lesson] : undefined} />
        <div className="fg-course-end">
          <p className="eyebrow">QCS Institute · FortiGate foundations</p>
          <p>Work through the explanation, inspect each header, then use the lab acceptance checks.</p>
          <div className="button-row">
            <Link className="button primary" href="/courses/fortigate/lab-setup">Open GNS3 setup guide</Link>
            <Link className="button secondary" href="/courses/fortigate">All three chapters</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
