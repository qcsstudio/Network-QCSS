import Image from "next/image";
import { Activity, CheckCircle2, CloudCog, Network, ShieldCheck } from "lucide-react";

const consoleSignals = [
  { label: "Sites", detail: "Path visible", Icon: Network },
  { label: "Cloud", detail: "Routes mapped", Icon: CloudCog },
  { label: "Controls", detail: "Review queued", Icon: ShieldCheck }
];

export function CommandConsole() {
  return (
    <aside className="command-console" aria-label="Example QCS network command assessment workspace">
      <div className="command-console-bar">
        <span className="command-console-brand">
          <i aria-hidden="true" /> QCS Network Command
        </span>
        <span className="command-console-state"><Activity aria-hidden="true" size={16} /> Assessment preview</span>
      </div>

      <div className="command-console-stage">
        <Image
          className="command-console-image"
          src="/brand/envato/illustrations/isometric-data-center-network.svg"
          alt="Secure data center topology connecting network, cloud, and security systems"
          fill
          priority
          sizes="(max-width: 900px) 92vw, 46vw"
        />
        <span className="command-console-scan" aria-hidden="true" />
        <div className="command-console-signals">
          {consoleSignals.map(({ label, detail, Icon }) => (
            <span key={label}>
              <Icon aria-hidden="true" size={19} />
              <b>{label}</b>
              <small>{detail}</small>
            </span>
          ))}
        </div>
        <div className="command-console-score">
          <span>Readiness</span>
          <strong>82</strong>
          <small>Prioritized review</small>
        </div>
      </div>

      <div className="command-console-handoff">
        <span><i>01</i><b>Observe</b><small>Symptom + topology</small></span>
        <span><i>02</i><b>Decide</b><small>Risk + owner</small></span>
        <span><i>03</i><b>Verify</b><small>Evidence + retest</small></span>
        <CheckCircle2 className="command-console-check" aria-label="Assessment workflow ready" size={24} />
      </div>
    </aside>
  );
}
