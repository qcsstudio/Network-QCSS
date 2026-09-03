import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { CcnaVisualDiagram, ccnaDiagramGeometry, wrapVisualLabel } from "@/components/ccna-visual-diagram";
import type { CcnaLessonRecord } from "@/lib/ccna-learning";
import { firstNetworkArtwork, visualStoryForLesson, type CcnaVisualStory } from "@/lib/ccna-visual-story";

function SocialDiagram({ story, width, height }: { story: CcnaVisualStory; width: number; height: number }) {
  // Unfold vertical layers horizontally for a wide social export, preserving order and links.
  const exportStory = story.layout === "layers" ? { ...story, layout: "sequence" as const } : story;
  const geometry = ccnaDiagramGeometry(exportStory);
  const scale = Math.min(width / geometry.width, height / geometry.height);
  const comparison = exportStory.layout === "comparison";
  const labelWidth = comparison ? 400 : 270;
  return <div style={{ display: "flex", position: "relative", width: geometry.width * scale, height: geometry.height * scale }}>
    {CcnaVisualDiagram({ story: exportStory, stageIndex: 1, width: geometry.width * scale, height: geometry.height * scale, includeLabels: false })}
    {geometry.nodes.map((node) => <div key={node.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "absolute", left: (node.x - labelWidth / 2) * scale, top: (node.y + 67) * scale, width: labelWidth * scale, textAlign: "center" }}>
      {wrapVisualLabel(node.label, 17).map((line, index) => <span key={index} style={{ display: "flex", fontSize: (comparison ? 36 : 28) * scale, lineHeight: `${(comparison ? 40 : 33) * scale}px`, fontWeight: 700 }}>{line}</span>)}
      {wrapVisualLabel(node.detail, 20).map((line, index) => <span key={index} style={{ display: "flex", fontSize: (comparison ? 28 : 21) * scale, lineHeight: `${(comparison ? 32 : 26) * scale}px`, color: "#425564" }}>{line}</span>)}
    </div>)}
  </div>;
}

export async function ccnaSocialVisual(lesson: CcnaLessonRecord, width: number, height: number) {
  const scale = Math.min(width / 1920, height / 1080);
  const px = (value: number) => Math.round(value * scale);
  const story = visualStoryForLesson(lesson);
  const artwork = firstNetworkArtwork(lesson);
  const logo = await readFile(path.join(process.cwd(), "public/brand/quantumcrafters-logo.png"));
  const font = await readFile(path.join(process.cwd(), "public/fonts/qcs-editorial-geist.ttf"));
  const photo = artwork ? await readFile(path.join(process.cwd(), "public/brand/ccna/first-network-tabletop-v1.jpg")) : null;
  const title = story?.title || lesson.title;
  const stages = story?.stages || [];

  return new ImageResponse(
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#fafbfc", color: "#182332", fontFamily: "QCS", padding: `${px(52)}px ${px(70)}px`, position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: px(90), flexShrink: 0 }}>
        <span style={{ color: "#08777b", fontSize: px(30), fontWeight: 700 }}>CCNA / DAY {String(lesson.sequence).padStart(2, "0")}</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:image/png;base64,${logo.toString("base64")}`} alt="QuantumCrafters Studio" width={px(280)} height={px(104)} style={{ objectFit: "contain" }} />
      </div>
      <div style={{ display: "flex", fontSize: px(title.length > 65 ? 60 : 82), lineHeight: 1.08, fontWeight: 700, marginTop: px(22), flexShrink: 0 }}>{title}</div>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, minHeight: 0 }}>
        {photo ?
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`data:image/jpeg;base64,${photo.toString("base64")}`} alt={artwork!.alt} width={px(1180)} height={px(665)} style={{ objectFit: "contain", maxHeight: "100%" }} />
          : story ? <SocialDiagram story={story} width={px(1660)} height={px(560)} />
            : <div style={{ display: "flex", padding: px(50), fontSize: px(42), lineHeight: 1.4 }}>{lesson.content?.learnerOutcome || lesson.moduleTitle}</div>}
      </div>
      {stages.length ? <div style={{ display: "flex", borderTop: `${px(3)}px solid #d1dcdf`, paddingTop: px(24), gap: px(35), flexShrink: 0 }}>
        {stages.map((stage, index) => <div key={stage.title} style={{ display: "flex", flex: 1, minWidth: 0, alignItems: "flex-start", gap: px(14) }}>
          <span style={{ display: "flex", color: index === 2 ? "#b03363" : "#08777b", fontSize: px(43), fontWeight: 700 }}>{index + 1}</span>
          <span style={{ display: "flex", fontSize: px(37), lineHeight: 1.15, fontWeight: 700 }}>{stage.title}</span>
        </div>)}
      </div> : null}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: px(26), fontSize: px(24), color: "#425564", flexShrink: 0 }}><span>{artwork ? "Illustrated lab model" : "Conceptual teaching model"}</span><span>QCSSTUDIO.COM / CCNA</span></div>
    </div>,
    { width, height, fonts: [{ name: "QCS", data: font, weight: 400, style: "normal" }, { name: "QCS", data: font, weight: 700, style: "normal" }] }
  );
}
