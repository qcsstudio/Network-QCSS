import { ImageResponse } from "next/og";
import type { CcnaLessonRecord } from "@/lib/ccna-learning";
import { siteConfig } from "@/lib/content";
import { ccnaTopicBySlug } from "@/lib/ccna-curriculum";

function shortTitle(value: string, limit = 86) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).replace(/\s+\S*$/, "").replace(/[,:;\s]+$/, "")}.`;
}

export function ccnaSocialVisual(lesson: CcnaLessonRecord, width: number, height: number) {
  const scale = Math.min(width / 1920, height / 1080);
  const px = (value: number) => Math.round(value * scale);
  const devices = lesson.content?.lab.devices.slice(0, 3) || [];
  const objective = ccnaTopicBySlug(lesson.slug)?.objective || "Build the concept, observe the evidence, and explain the result.";
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "#071425", color: "#f7fbff", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", opacity: 0.22, backgroundImage: "linear-gradient(rgba(79,201,224,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(79,201,224,.22) 1px, transparent 1px)", backgroundSize: `${px(72)}px ${px(72)}px` }} />
      <div style={{ position: "absolute", left: px(72), right: px(72), top: px(58), height: px(4), display: "flex", background: "linear-gradient(90deg,#ff8738,#ee3d7b,#4d78df,#48c7d9)" }} />
      <div style={{ display: "flex", flexDirection: "column", width: "56%", padding: `${px(92)}px ${px(38)}px ${px(72)}px ${px(82)}px`, zIndex: 1 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="QuantumCrafters Studio Pvt. Ltd." src={`${siteConfig.url}/brand/quantumcrafters-logo.png`} width={px(330)} height={px(123)} style={{ width: px(330), height: px(123), flexShrink: 0, padding: px(15), background: "rgba(255,255,255,.96)", borderRadius: px(8), objectFit: "contain" }} />
        <div style={{ marginTop: px(58), display: "flex", color: "#5ad1dd", fontSize: px(25), fontWeight: 700, textTransform: "uppercase", letterSpacing: 0 }}>CCNA DAILY / DAY {String(lesson.sequence).padStart(2, "0")}</div>
        <div style={{ marginTop: px(18), display: "flex", fontSize: px(62), lineHeight: 1.06, fontWeight: 800, maxWidth: px(940) }}>{shortTitle(lesson.title)}</div>
        <div style={{ marginTop: px(28), display: "flex", color: "#bfcbda", fontSize: px(28), lineHeight: 1.35 }}>{lesson.moduleTitle}</div>
        <div style={{ marginTop: "auto", display: "flex", gap: px(18), fontSize: px(22), color: "#f7fbff" }}>
          <span style={{ display: "flex", padding: `${px(14)}px ${px(20)}px`, border: "1px solid #315171", borderRadius: px(6) }}>LEARN</span>
          <span style={{ display: "flex", padding: `${px(14)}px ${px(20)}px`, border: "1px solid #315171", borderRadius: px(6) }}>LAB</span>
          <span style={{ display: "flex", padding: `${px(14)}px ${px(20)}px`, border: "1px solid #315171", borderRadius: px(6) }}>VERIFY</span>
          <span style={{ display: "flex", padding: `${px(14)}px ${px(20)}px`, border: "1px solid #315171", borderRadius: px(6) }}>QUIZ</span>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "44%", padding: px(76), zIndex: 1 }}>
        <div style={{ width: "100%", height: "82%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: px(46), border: "1px solid #294965", borderRadius: px(12), background: "rgba(7,20,37,.86)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#ff9c54", fontSize: px(22), fontWeight: 700 }}><span>LAB COMPONENTS</span><span>WEEK {lesson.week}</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: px(16), marginTop: px(20), marginBottom: px(20) }}>
            {devices.map((device, index) => <div key={`${index}-${device}`} style={{ display: "flex", alignItems: "center", minHeight: px(90), padding: `${px(16)}px ${px(20)}px`, border: `2px solid ${index === 1 ? "#ee3d7b" : "#4fc9e0"}`, borderRadius: px(6), background: "#0d223b", fontSize: px(device.length > 80 ? 21 : 25), lineHeight: 1.2 }}><span style={{ display: "flex", flexShrink: 0, marginRight: px(18), color: "#72d6e2", fontWeight: 700 }}>{String(index + 1).padStart(2, "0")}</span><span>{device}</span></div>)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: px(14), padding: px(24), background: "#0b1b30", borderLeft: `${px(5)}px solid #35c897` }}><span style={{ color: "#35c897", fontSize: px(20), fontWeight: 700 }}>TODAY&apos;S OUTCOME</span><span style={{ fontSize: px(25), lineHeight: 1.35 }}>{objective}</span></div>
          <div style={{ display: "flex", marginTop: px(20), color: "#aebed0", fontSize: px(18) }}>CCNA 200-301 / QCSSTUDIO.COM</div>
        </div>
      </div>
    </div>,
    { width, height }
  );
}
