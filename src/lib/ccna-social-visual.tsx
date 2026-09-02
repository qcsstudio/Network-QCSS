import { ImageResponse } from "next/og";
import type { CcnaLessonRecord } from "@/lib/ccna-learning";
import { siteConfig } from "@/lib/content";

function shortTitle(value: string, limit = 86) {
  if (value.length <= limit) return value;
  return `${value.slice(0, limit).replace(/\s+\S*$/, "").replace(/[,:;\s]+$/, "")}.`;
}

export function ccnaSocialVisual(lesson: CcnaLessonRecord, width: number, height: number) {
  const scale = Math.min(width / 1920, height / 1080);
  const px = (value: number) => Math.round(value * scale);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", overflow: "hidden", background: "#071425", color: "#f7fbff", fontFamily: "Arial, sans-serif" }}>
      <div style={{ position: "absolute", inset: 0, display: "flex", opacity: 0.22, backgroundImage: "linear-gradient(rgba(79,201,224,.22) 1px, transparent 1px), linear-gradient(90deg, rgba(79,201,224,.22) 1px, transparent 1px)", backgroundSize: `${px(72)}px ${px(72)}px` }} />
      <div style={{ position: "absolute", left: px(72), right: px(72), top: px(58), height: px(4), display: "flex", background: "linear-gradient(90deg,#ff8738,#ee3d7b,#4d78df,#48c7d9)" }} />
      <div style={{ display: "flex", flexDirection: "column", width: "56%", padding: `${px(92)}px ${px(38)}px ${px(72)}px ${px(82)}px`, zIndex: 1 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="QuantumCrafters Studio Pvt. Ltd." src={`${siteConfig.url}/brand/quantumcrafters-logo.png`} style={{ width: px(300), height: "auto", padding: px(15), background: "rgba(255,255,255,.96)", borderRadius: px(8), objectFit: "contain" }} />
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
          <div style={{ display: "flex", justifyContent: "space-between", color: "#ff9c54", fontSize: px(22), fontWeight: 700 }}><span>PACKET PATH LAB</span><span>WEEK {lesson.week}</span></div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {["CLIENT", "SWITCH", "ROUTER"].map((node, index) => <div key={node} style={{ display: "flex", alignItems: "center" }}><div style={{ width: px(132), height: px(132), display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", border: `3px solid ${index === 1 ? "#ee3d7b" : "#4fc9e0"}`, background: "#0d223b", fontSize: px(18), fontWeight: 700 }}>{node}</div>{index < 2 ? <div style={{ width: px(70), height: px(3), display: "flex", background: "#577190" }} /> : null}</div>)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: px(14), padding: px(24), background: "#0b1b30", borderLeft: `${px(5)}px solid #35c897` }}><span style={{ color: "#35c897", fontSize: px(20), fontWeight: 700 }}>TODAY&apos;S OUTCOME</span><span style={{ fontSize: px(25), lineHeight: 1.35 }}>{lesson.content?.learnerOutcome || "Build the concept, observe the evidence, and explain the result."}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#aebed0", fontSize: px(18) }}><span>v1.1 {lesson.v11Blueprint}</span><span>v2.0 {lesson.v20Blueprint}</span><span>QCSSTUDIO.COM</span></div>
        </div>
      </div>
    </div>,
    { width, height }
  );
}
