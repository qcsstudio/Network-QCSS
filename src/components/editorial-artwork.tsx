import type { EditorialVisualMotif, EditorialVisualProfile } from "@/lib/editorial-visuals";

/* next/og requires a native image element while rendering server-side artwork. */
/* eslint-disable @next/next/no-img-element */

type EditorialArtworkProps = {
  format: "hero" | "social";
  logoUrl: string;
  profile: EditorialVisualProfile;
  statusLabel?: string;
  title: string;
};

type DiagramProps = {
  compact: boolean;
  profile: EditorialVisualProfile;
};

type Point = { x: number; y: number };

const nodeLayouts: Point[][] = [
  [
    { x: 17, y: 20 },
    { x: 82, y: 18 },
    { x: 84, y: 78 },
    { x: 16, y: 80 }
  ],
  [
    { x: 15, y: 44 },
    { x: 74, y: 16 },
    { x: 85, y: 68 },
    { x: 33, y: 84 }
  ],
  [
    { x: 24, y: 16 },
    { x: 85, y: 38 },
    { x: 71, y: 83 },
    { x: 14, y: 69 }
  ]
];

function Connector({ color, from, to, width }: { color: string; from: Point; to: Point; width: number }) {
  const horizontalLeft = Math.min(from.x, to.x);
  const horizontalWidth = Math.abs(to.x - from.x);
  const verticalTop = Math.min(from.y, to.y);
  const verticalHeight = Math.abs(to.y - from.y);
  return (
    <div style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", display: "flex" }}>
      <div style={{ position: "absolute", left: `${horizontalLeft}%`, top: `${from.y}%`, width: `${horizontalWidth}%`, height: width, display: "flex", background: color, borderRadius: 99, opacity: 0.72 }} />
      <div style={{ position: "absolute", left: `${to.x}%`, top: `${verticalTop}%`, width, height: `${verticalHeight}%`, display: "flex", background: color, borderRadius: 99, opacity: 0.72 }} />
    </div>
  );
}

function NetworkNode({ color, compact, label, point, reverse }: { color: string; compact: boolean; label: string; point: Point; reverse: boolean }) {
  const nodeSize = compact ? 39 : 48;
  return (
    <div
      style={{
        position: "absolute",
        left: `${point.x}%`,
        top: `${point.y}%`,
        width: compact ? 126 : 150,
        display: "flex",
        flexDirection: reverse ? "column-reverse" : "column",
        alignItems: "center",
        gap: compact ? 7 : 9,
        transform: "translate(-50%, -50%)"
      }}
    >
      <div style={{ width: nodeSize, height: nodeSize, display: "flex", alignItems: "center", justifyContent: "center", border: `${compact ? 6 : 7}px solid ${color}`, borderRadius: 99, background: "#ffffff", boxShadow: "0 8px 22px rgba(22, 36, 58, 0.16)" }}>
        <div style={{ width: compact ? 10 : 12, height: compact ? 10 : 12, display: "flex", borderRadius: 99, background: color }} />
      </div>
      <div style={{ width: "100%", minHeight: compact ? 28 : 34, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #c5d2e2", borderRadius: 6, background: "#ffffff", color: "#172238", fontSize: compact ? 12 : 14, fontWeight: 750, lineHeight: 1.05, padding: compact ? "5px 7px" : "7px 9px", textAlign: "center" }}>
        {label}
      </div>
    </div>
  );
}

function RoutingMotif({ accent, compact, secondary, signal }: { accent: string; compact: boolean; secondary: string; signal: string }) {
  const size = compact ? 132 : 164;
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", border: `${compact ? 7 : 9}px solid ${accent}`, borderRadius: 999, background: "#ffffff", boxShadow: "0 18px 40px rgba(23, 34, 56, 0.2)" }}>
      <div style={{ width: compact ? 86 : 106, height: compact ? 86 : 106, display: "flex", alignItems: "center", justifyContent: "center", border: `${compact ? 5 : 7}px dashed ${secondary}`, borderRadius: 999, color: "#152137", fontSize: compact ? 18 : 23, fontWeight: 900 }}>{signal}</div>
    </div>
  );
}

function CloudMotif({ accent, compact, secondary, signal }: { accent: string; compact: boolean; secondary: string; signal: string }) {
  return (
    <div style={{ width: compact ? 164 : 204, height: compact ? 102 : 128, display: "flex", alignItems: "center", justifyContent: "center", border: `${compact ? 7 : 9}px solid ${accent}`, borderRadius: 60, background: "#ffffff", color: "#152137", fontSize: compact ? 18 : 23, fontWeight: 900, position: "relative", boxShadow: "0 18px 40px rgba(23, 34, 56, 0.2)" }}>
      <div style={{ position: "absolute", left: compact ? 22 : 28, top: compact ? -27 : -34, width: compact ? 62 : 78, height: compact ? 62 : 78, display: "flex", border: `${compact ? 7 : 9}px solid ${secondary}`, borderRadius: 99, background: "#ffffff" }} />
      <div style={{ position: "absolute", right: compact ? 19 : 24, top: compact ? -17 : -22, width: compact ? 49 : 62, height: compact ? 49 : 62, display: "flex", border: `${compact ? 7 : 9}px solid ${accent}`, borderRadius: 99, background: "#ffffff" }} />
      <span style={{ marginTop: compact ? 18 : 22 }}>{signal}</span>
    </div>
  );
}

function IdentityMotif({ accent, compact, secondary, signal }: { accent: string; compact: boolean; secondary: string; signal: string }) {
  return (
    <div style={{ width: compact ? 130 : 158, height: compact ? 112 : 136, display: "flex", alignItems: "center", justifyContent: "center", border: `${compact ? 7 : 9}px solid ${accent}`, borderRadius: 18, background: "#ffffff", color: "#152137", fontSize: compact ? 17 : 22, fontWeight: 900, position: "relative", boxShadow: "0 18px 40px rgba(23, 34, 56, 0.2)" }}>
      <div style={{ position: "absolute", left: compact ? 29 : 35, top: compact ? -51 : -62, width: compact ? 58 : 70, height: compact ? 58 : 70, display: "flex", border: `${compact ? 9 : 11}px solid ${secondary}`, borderBottom: "none", borderRadius: "34px 34px 0 0" }} />
      <div style={{ width: compact ? 23 : 29, height: compact ? 31 : 39, display: "flex", borderRadius: "12px 12px 5px 5px", background: secondary, marginRight: compact ? 8 : 11 }} />
      {signal}
    </div>
  );
}

function CaptureMotif({ accent, compact, secondary, signal }: { accent: string; compact: boolean; secondary: string; signal: string }) {
  const size = compact ? 136 : 170;
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", border: `${compact ? 7 : 9}px solid ${accent}`, borderRadius: 999, background: "#ffffff", color: "#152137", fontSize: compact ? 18 : 23, fontWeight: 900, position: "relative", boxShadow: "0 18px 40px rgba(23, 34, 56, 0.2)" }}>
      <div style={{ position: "absolute", left: "50%", top: 13, width: compact ? 5 : 7, height: compact ? 96 : 122, display: "flex", background: "#1b2a40", transform: "translateX(-50%)" }} />
      <div style={{ position: "absolute", left: 13, top: "50%", width: compact ? 96 : 122, height: compact ? 5 : 7, display: "flex", background: "#1b2a40", transform: "translateY(-50%)" }} />
      <div style={{ zIndex: 2, display: "flex", border: `${compact ? 5 : 6}px solid ${secondary}`, borderRadius: 99, background: "#ffffff", padding: compact ? "12px 10px" : "16px 13px" }}>{signal}</div>
    </div>
  );
}

function RemoteAccessMotif({ accent, compact, secondary, signal }: { accent: string; compact: boolean; secondary: string; signal: string }) {
  return (
    <div style={{ width: compact ? 176 : 216, height: compact ? 98 : 120, display: "flex", alignItems: "center", justifyContent: "space-between", border: `${compact ? 7 : 9}px solid ${accent}`, borderRadius: 48, background: "#ffffff", padding: compact ? "0 19px" : "0 24px", position: "relative", boxShadow: "0 18px 40px rgba(23, 34, 56, 0.2)" }}>
      <div style={{ width: compact ? 36 : 44, height: compact ? 36 : 44, display: "flex", borderRadius: 99, background: accent }} />
      <div style={{ display: "flex", color: "#152137", background: "#ffffff", fontSize: compact ? 17 : 21, fontWeight: 900, padding: "4px 7px", zIndex: 2 }}>{signal}</div>
      <div style={{ width: compact ? 36 : 44, height: compact ? 36 : 44, display: "flex", borderRadius: 99, background: secondary }} />
    </div>
  );
}

function InfrastructureMotif({ accent, compact, secondary, signal }: { accent: string; compact: boolean; secondary: string; signal: string }) {
  return (
    <div style={{ width: compact ? 132 : 162, height: compact ? 162 : 198, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: compact ? 8 : 10, border: `${compact ? 7 : 9}px solid ${accent}`, borderRadius: 17, background: "#ffffff", position: "relative", boxShadow: "0 18px 40px rgba(23, 34, 56, 0.2)" }}>
      {[0, 1, 2].map((index) => (
        <div key={index} style={{ width: compact ? 92 : 112, height: compact ? 25 : 31, display: "flex", alignItems: "center", borderRadius: 5, background: "#e8eef6", padding: "0 9px" }}>
          <div style={{ width: compact ? 8 : 10, height: compact ? 8 : 10, display: "flex", borderRadius: 99, background: index % 2 ? accent : secondary, marginRight: 8 }} />
          <div style={{ flex: 1, height: 5, display: "flex", borderRadius: 99, background: "#7c8ca2" }} />
        </div>
      ))}
      <div style={{ display: "flex", color: "#152137", fontSize: compact ? 15 : 18, fontWeight: 900 }}>{signal}</div>
    </div>
  );
}

function SecurityMotif({ accent, compact, secondary, signal }: { accent: string; compact: boolean; secondary: string; signal: string }) {
  return (
    <div style={{ width: compact ? 144 : 176, height: compact ? 154 : 188, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", border: `${compact ? 7 : 9}px solid ${accent}`, borderRadius: "48px 48px 70px 70px", background: "#ffffff", color: "#152137", fontSize: compact ? 17 : 21, fontWeight: 900, position: "relative", boxShadow: "0 18px 40px rgba(23, 34, 56, 0.2)" }}>
      <div style={{ width: compact ? 52 : 64, height: compact ? 52 : 64, display: "flex", alignItems: "center", justifyContent: "center", border: `${compact ? 6 : 8}px solid ${secondary}`, borderRadius: 99, color: secondary, fontSize: compact ? 17 : 21, marginBottom: 10 }}>OK</div>
      {signal}
    </div>
  );
}

function CentralMotif({ compact, profile }: DiagramProps) {
  const props = { accent: profile.accent, compact, secondary: profile.secondary, signal: profile.signal };
  const motif: Record<EditorialVisualMotif, React.ReactNode> = {
    capture: <CaptureMotif {...props} />,
    cloud: <CloudMotif {...props} />,
    identity: <IdentityMotif {...props} />,
    infrastructure: <InfrastructureMotif {...props} />,
    "remote-access": <RemoteAccessMotif {...props} />,
    routing: <RoutingMotif {...props} />,
    security: <SecurityMotif {...props} />
  };
  return (
    <div style={{ position: "absolute", left: "50%", top: "49%", display: "flex", alignItems: "center", justifyContent: "center", transform: "translate(-50%, -50%)", zIndex: 3 }}>
      {motif[profile.motif]}
    </div>
  );
}

function NetworkDiagram({ compact, profile }: DiagramProps) {
  const nodes = nodeLayouts[profile.variant];
  const labels = [...profile.tags, "Validation"];
  const center = { x: 50, y: 49 };
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "#eaf0f7" }}>
      {[10, 22, 34, 46, 58, 70, 82, 94].map((left) => <div key={`v-${left}`} style={{ position: "absolute", left: `${left}%`, top: 0, width: 2, height: "100%", display: "flex", background: "#d6e0ec" }} />)}
      {[12, 28, 44, 60, 76, 92].map((top) => <div key={`h-${top}`} style={{ position: "absolute", left: 0, top: `${top}%`, width: "100%", height: 2, display: "flex", background: "#d6e0ec" }} />)}
      <Connector color={profile.accent} from={nodes[0]} to={center} width={compact ? 5 : 7} />
      <Connector color={profile.accent} from={center} to={nodes[2]} width={compact ? 5 : 7} />
      <Connector color={profile.secondary} from={nodes[1]} to={center} width={compact ? 5 : 7} />
      <Connector color={profile.secondary} from={center} to={nodes[3]} width={compact ? 5 : 7} />
      {nodes.map((node, index) => (
        <NetworkNode color={index % 2 ? profile.secondary : profile.accent} compact={compact} key={`${node.x}-${node.y}`} label={labels[index]} point={node} reverse={node.y > 55} />
      ))}
      <CentralMotif compact={compact} profile={profile} />
    </div>
  );
}

function TopicTag({ children }: { children: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", border: "1px solid #40516b", borderRadius: 6, color: "#dce7f5", fontSize: 17, fontWeight: 700, padding: "8px 11px" }}>
      {children}
    </div>
  );
}

export function EditorialArtwork({ format, logoUrl, profile, statusLabel = "Evidence led", title }: EditorialArtworkProps) {
  const social = format === "social";
  const titleSize = social
    ? title.length > 105
      ? 34
      : title.length > 72
        ? 39
        : 45
    : title.length > 105
      ? 34
      : title.length > 72
        ? 39
        : 44;

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", background: "#dfe7f1", color: "#f8fbff", padding: social ? 28 : 0, fontFamily: "Arial" }}>
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", border: social ? "2px solid #bdcadb" : "none", background: "#0b1728" }}>
        <div style={{ height: social ? 98 : 116, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", borderBottom: `8px solid ${profile.accent}`, padding: social ? "15px 28px" : "18px 42px" }}>
          <img alt="QuantumCrafters Studio Pvt. Ltd." height={social ? 64 : 78} src={logoUrl} style={{ objectFit: "contain", objectPosition: "left center" }} width={social ? 278 : 338} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", color: "#172238" }}>
            <div style={{ display: "flex", color: profile.accent, fontSize: social ? 16 : 19, fontWeight: 900, textTransform: "uppercase" }}>{profile.eyebrow}</div>
            <div style={{ display: "flex", color: "#68758a", fontSize: social ? 14 : 17, fontWeight: 700, marginTop: 4 }}>{profile.signature}</div>
          </div>
        </div>

        <div style={{ flex: 1, display: "flex" }}>
          <div style={{ width: social ? "48%" : "39%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#0b1728", padding: social ? "30px 34px" : "42px" }}>
            <div style={{ display: "flex", alignSelf: "flex-start", alignItems: "center", border: `1px solid ${profile.secondary}`, borderRadius: 6, color: "#ffffff", fontSize: social ? 16 : 19, fontWeight: 900, padding: "9px 13px", textTransform: "uppercase" }}>
              <div style={{ width: 9, height: 9, display: "flex", borderRadius: 99, background: profile.secondary, marginRight: 9 }} />
              {statusLabel}
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", color: profile.secondary, fontSize: social ? 23 : 27, fontWeight: 900, marginBottom: 15, textTransform: "uppercase" }}>{profile.focus}</div>
              <div style={{ display: "flex", color: "#ffffff", fontSize: titleSize, fontWeight: 850, lineHeight: 1.08 }}>{title}</div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {profile.tags.map((tag) => <TopicTag key={tag}>{tag}</TopicTag>)}
            </div>
          </div>

          <div style={{ width: social ? "52%" : "61%", display: "flex", flexDirection: "column", position: "relative", background: "#eaf0f7", borderLeft: `8px solid ${profile.accent}` }}>
            <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
              <NetworkDiagram compact={social} profile={profile} />
            </div>
            <div style={{ minHeight: social ? 52 : 62, display: "flex", alignItems: "center", justifyContent: "space-between", background: "#ffffff", borderTop: "2px solid #cad6e4", color: "#172238", fontSize: social ? 15 : 18, fontWeight: 850, padding: social ? "0 22px" : "0 30px", textTransform: "uppercase" }}>
              <span>Observe</span>
              <span style={{ color: profile.accent }}>Prioritize</span>
              <span style={{ color: profile.secondary }}>Validate</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
