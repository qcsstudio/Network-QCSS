import Link from "next/link";

const auditHref = "/linkedin-profile-audit";

const competitorPatterns = [
  {
    pattern: "Appointment setters",
    promise: "Booked calls and calendar volume",
    gap: "Often optimize for meetings before fixing positioning, qualification, or founder credibility.",
  },
  {
    pattern: "Ghostwriting shops",
    promise: "More posts, carousels, and visibility",
    gap: "Authority grows, but conversations stall when content is not connected to targeted outbound.",
  },
  {
    pattern: "Automation-led lead gen",
    promise: "High-volume connection requests and message sequences",
    gap: "Scale creates noise when lists, triggers, and personalization are weak.",
  },
  {
    pattern: "Generic demand gen agencies",
    promise: "Multi-channel pipeline without extra headcount",
    gap: "Useful for mature teams, but founder-led offers need sharper narrative and manual control first.",
  },
];

const enginePillars = [
  {
    title: "Positioning that makes buyers stop",
    copy: "We turn your profile from a resume into a buying argument: who you help, what pain you solve, why your approach is credible, and why prospects should talk now.",
  },
  {
    title: "ICP intelligence before outreach",
    copy: "We define buyer roles, company triggers, pains, objections, and account-fit rules so outreach starts with relevance instead of volume.",
  },
  {
    title: "Message architecture built for replies",
    copy: "Connection notes, first messages, follow-ups, warm engagement, objection handling, and reactivation flows are written as one conversation system.",
  },
  {
    title: "Manual outbound with quality control",
    copy: "No spray-and-pray. We run controlled daily activity, track every touchpoint, and protect your founder brand while creating sales conversations.",
  },
  {
    title: "Authority content that supports sales",
    copy: "Proof posts, problem framing, buyer education, case-study angles, and POV content warm the market before and after outreach.",
  },
  {
    title: "Weekly optimization loop",
    copy: "Acceptance rates, replies, objections, booked calls, and conversation quality tell us what to refine every week.",
  },
];

const processSteps = [
  {
    step: "01",
    title: "Audit & revenue diagnosis",
    copy: "We start with the profile audit, offer review, current LinkedIn activity, ICP assumptions, and conversion leaks.",
  },
  {
    step: "02",
    title: "Engine blueprint",
    copy: "You get the positioning map, ICP filters, prospecting logic, message strategy, and weekly operating cadence before execution begins.",
  },
  {
    step: "03",
    title: "Build & launch",
    copy: "We rewrite the profile, create outbound assets, prepare lead lists, set tracking, and begin controlled outreach from your LinkedIn presence.",
  },
  {
    step: "04",
    title: "Optimize to qualified conversations",
    copy: "Every week we review signal quality, message performance, objections, and booked-call quality to improve the engine.",
  },
];

const outcomes = [
  "A LinkedIn profile that explains your value in buyer language",
  "A defined prospect universe with qualification filters",
  "Founder-safe outbound messages that do not sound automated",
  "A repeatable follow-up system that prevents warm leads from slipping",
  "Content angles that make outreach feel warmer and more credible",
  "A weekly dashboard for acceptance, reply, conversation, and booking quality",
];

const fitCriteria = [
  "B2B founders, consultants, agencies, SaaS, or professional-service teams selling high-ticket offers",
  "You can handle more qualified sales conversations if the right buyers enter the pipeline",
  "Your current LinkedIn activity creates visibility but not enough meetings",
  "You want a controlled outbound engine, not a generic automation blast",
];

export default function LinkedInSalesEngineLanding() {
  return (
    <>
      <section className="py-5" style={{ background: "#f7f8fb" }}>
        <div className="container">
          <div className="row align-items-center g-4">
            <div className="col-lg-7">
              <p className="text-uppercase fw-semibold mb-2" style={{ color: "#0A66C2", letterSpacing: 1.5 }}>
                Done-for-you LinkedIn outbound engine
              </p>
              <h2 className="fw-bold text-black mb-3">
                We do not sell “LinkedIn activity.” We build the operating system that turns your founder profile into pipeline.
              </h2>
              <p className="text-muted mb-4" style={{ fontSize: 18 }}>
                The market is crowded with agencies promising more posts, more DMs, or more booked calls. QCS combines positioning, profile conversion, prospect intelligence, sales messaging, manual execution, and weekly optimization so LinkedIn becomes a controlled revenue channel.
              </p>
              <div className="d-flex flex-column flex-sm-row gap-3">
                <Link href={auditHref} className="cs_btn cs_style_1 cs_color_1">
                  <span>Start With Profile Audit →</span>
                </Link>
                <Link href="/contact" className="cs_btn cs_style_1">
                  <span>Discuss the Sales Engine</span>
                </Link>
              </div>
            </div>
            <div className="col-lg-5">
              <div className="p-4 rounded-4 shadow-sm bg-white">
                <h5 className="fw-bold mb-3 text-black">What gets engineered</h5>
                <ul className="list-unstyled mb-0">
                  {outcomes.slice(0, 5).map((item) => (
                    <li key={item} className="d-flex gap-2 mb-3 text-black">
                      <span style={{ color: "#0A66C2" }}>◆</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-5 bg-white">
        <div className="container">
          <div className="text-center mx-auto mb-5" style={{ maxWidth: 820 }}>
            <p className="text-uppercase fw-semibold mb-2" style={{ color: "#0A66C2", letterSpacing: 1.5 }}>
              Competitor analysis distilled into positioning
            </p>
            <h2 className="fw-bold text-black">Most LinkedIn services solve one part of the problem. Pipeline needs the whole chain.</h2>
          </div>
          <div className="row g-4">
            {competitorPatterns.map((item) => (
              <div className="col-md-6" key={item.pattern}>
                <div className="h-100 p-4 rounded-4 border bg-white shadow-sm">
                  <h5 className="fw-bold text-black">{item.pattern}</h5>
                  <p className="mb-2 text-muted"><strong>They usually promise:</strong> {item.promise}</p>
                  <p className="mb-0 text-muted"><strong>The gap:</strong> {item.gap}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-4">
            <Link href={auditHref} className="cs_btn cs_style_1 cs_color_1">
              <span>Find My First Conversion Leak →</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-5" style={{ background: "#101010" }}>
        <div className="container">
          <div className="row align-items-end mb-4 g-3">
            <div className="col-lg-8">
              <p className="text-uppercase fw-semibold mb-2" style={{ color: "#7db7ff", letterSpacing: 1.5 }}>
                The QCS LinkedIn Sales Engine
              </p>
              <h2 className="fw-bold text-white mb-0">Six pillars that convert attention into qualified conversations.</h2>
            </div>
            <div className="col-lg-4 text-lg-end">
              <Link href={auditHref} className="cs_btn cs_style_1 cs_color_1">
                <span>Audit Your Profile</span>
              </Link>
            </div>
          </div>
          <div className="row g-4">
            {enginePillars.map((pillar, index) => (
              <div className="col-md-6 col-lg-4" key={pillar.title}>
                <div className="h-100 p-4 rounded-4" style={{ background: "#181818", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <span className="d-inline-block mb-3 fw-bold" style={{ color: "#7db7ff" }}>0{index + 1}</span>
                  <h5 className="fw-bold text-white">{pillar.title}</h5>
                  <p className="mb-0" style={{ color: "rgba(255,255,255,0.72)" }}>{pillar.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-5 bg-white">
        <div className="container">
          <div className="row g-5 align-items-start">
            <div className="col-lg-5">
              <p className="text-uppercase fw-semibold mb-2" style={{ color: "#0A66C2", letterSpacing: 1.5 }}>
                Who this is for
              </p>
              <h2 className="fw-bold text-black mb-3">Built for high-ticket B2B teams where founder credibility matters.</h2>
              <p className="text-muted mb-4">
                If every new call can be worth thousands in pipeline, your LinkedIn presence cannot look generic and your outreach cannot feel automated. This is for teams that need fewer random leads and more qualified conversations.
              </p>
              <Link href={auditHref} className="cs_btn cs_style_1 cs_color_1">
                <span>Check If My Profile Is Ready →</span>
              </Link>
            </div>
            <div className="col-lg-7">
              <div className="row g-3">
                {fitCriteria.map((item) => (
                  <div className="col-md-6" key={item}>
                    <div className="h-100 p-4 rounded-4" style={{ background: "#f7f8fb" }}>
                      <p className="mb-0 text-black">{item}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-5" style={{ background: "#f7f8fb" }}>
        <div className="container">
          <div className="text-center mx-auto mb-5" style={{ maxWidth: 760 }}>
            <p className="text-uppercase fw-semibold mb-2" style={{ color: "#0A66C2", letterSpacing: 1.5 }}>
              Delivery process
            </p>
            <h2 className="fw-bold text-black">From profile audit to managed outbound execution.</h2>
          </div>
          <div className="row g-4">
            {processSteps.map((item) => (
              <div className="col-md-6 col-lg-3" key={item.step}>
                <div className="h-100 p-4 rounded-4 bg-white shadow-sm">
                  <span className="fw-bold" style={{ color: "#0A66C2" }}>{item.step}</span>
                  <h5 className="fw-bold text-black mt-3">{item.title}</h5>
                  <p className="text-muted mb-0">{item.copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-5 bg-white">
        <div className="container">
          <div className="p-4 p-lg-5 rounded-4 text-center" style={{ background: "#0A66C2" }}>
            <h2 className="fw-bold text-white mb-3">Before we build your outbound engine, know whether your profile can convert the traffic.</h2>
            <p className="text-white mb-4 mx-auto" style={{ maxWidth: 760 }}>
              Run the LinkedIn profile audit first. You will see a role-based score, color-coded conversion risk, and the option to unlock a paid rewrite designed around your profile type.
            </p>
            <Link href={auditHref} className="cs_btn cs_style_1 bg-white text-black">
              <span>Run the LinkedIn Profile Audit →</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
