"use client";

import { useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { CcnaVisualDiagram } from "@/components/ccna-visual-diagram";
import type { CcnaVisualStory } from "@/lib/ccna-visual-story";

type Artwork = { src: string; width: number; height: number; alt: string };

export function CcnaVisualExplainer({ story, artwork }: { story: CcnaVisualStory; artwork: Artwork | null }) {
  const [stageIndex, setStageIndex] = useState(0);
  const stage = story.stages[stageIndex];
  return <section className="ccna-visual-explainer" id="visual-walkthrough" aria-labelledby="ccna-visual-title">
    <header><p className="eyebrow">See the idea</p><h2 id="ccna-visual-title">{story.title}</h2><p>{story.takeaway}</p></header>
    {artwork ? <figure className="ccna-visual-artwork">
      <Image src={artwork.src} width={artwork.width} height={artwork.height} alt={artwork.alt} sizes="(max-width: 767px) calc(100vw - 40px), 800px" />
      <Image className="ccna-visual-brand" src="/brand/quantumcrafters-logo.png" width={198} height={74} alt="QuantumCrafters Studio" />
      <figcaption>A physical model of the lab. The computers are represented by VPCS nodes in GNS3.</figcaption>
    </figure> : null}
    <div className="ccna-visual-stage-nav" role="group" aria-label="Visual explanation steps">
      {story.stages.map((step, index) => <button type="button" key={step.title} aria-pressed={stageIndex === index} aria-controls="ccna-visual-stage" onClick={() => setStageIndex(index)}><span>{index + 1}</span>{step.title}</button>)}
    </div>
    <div className="ccna-visual-stage" id="ccna-visual-stage">
      <div className="ccna-diagram-desktop" data-layout={story.layout}><CcnaVisualDiagram story={story} stageIndex={stageIndex} /></div>
      <div className="ccna-diagram-mobile"><CcnaVisualDiagram story={story} stageIndex={stageIndex} compact /></div>
      <div className="ccna-visual-stage-copy" aria-live="polite" aria-atomic="true"><span>Step {stageIndex + 1} of 3</span><h3>{stage.title}</h3><p>{stage.explanation}</p></div>
    </div>
    <div className="ccna-visual-controls">
      <button type="button" aria-label="Previous visual step" title="Previous step" disabled={stageIndex === 0} onClick={() => setStageIndex((index) => index - 1)}><ArrowLeft aria-hidden="true" /></button>
      <button type="button" aria-label="Restart visual explanation" title="Restart explanation" disabled={stageIndex === 0} onClick={() => setStageIndex(0)}><RotateCcw aria-hidden="true" /></button>
      <button type="button" aria-label="Next visual step" title="Next step" disabled={stageIndex === 2} onClick={() => setStageIndex((index) => index + 1)}><ArrowRight aria-hidden="true" /></button>
    </div>
    <p className="ccna-visual-boundary"><strong>What this model leaves out:</strong> {story.boundary}</p>
    <details className="ccna-visual-transcript"><summary>Full visual explanation and references</summary><p>{story.altText}</p><ol>{story.stages.map((step) => <li key={step.title}><strong>{step.title}</strong><p>{step.explanation}</p>{step.sourceUrls.map((url) => <a key={url} href={url} rel="noreferrer" target="_blank">{new URL(url).hostname}</a>)}</li>)}</ol></details>
  </section>;
}
