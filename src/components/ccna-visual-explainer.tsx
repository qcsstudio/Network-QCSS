"use client";

import { useId, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, RotateCcw } from "lucide-react";
import { CcnaWebsiteVisualDiagram } from "@/components/ccna-website-visual-diagram";
import { CcnaLabBoundary } from "@/components/ccna-lab-boundary";
import type { CcnaVisualStory } from "@/lib/ccna-visual-story";
import styles from "./ccna-visual-explainer.module.css";

type Artwork = { src: string; width: number; height: number; alt: string };

function selectWithKeyboard(event: KeyboardEvent<HTMLDivElement>, select: (index: number) => void) {
  const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
  const current = buttons.indexOf(event.target as HTMLButtonElement);
  if (current < 0) return;
  let next: number;
  switch (event.key) {
    case "ArrowRight": case "ArrowDown": next = (current + 1) % buttons.length; break;
    case "ArrowLeft": case "ArrowUp": next = (current + buttons.length - 1) % buttons.length; break;
    case "Home": next = 0; break;
    case "End": next = buttons.length - 1; break;
    default: return;
  }
  event.preventDefault();
  select(next);
  buttons[next].focus();
}

export function CcnaVisualExplainer({ story: initialStory, artwork }: { story: CcnaVisualStory; artwork: Artwork | null }) {
  const [comparisonIndex, setComparisonIndex] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const id = useId();
  const stories = [initialStory, ...(initialStory.comparisons || [])];
  const story = stories[comparisonIndex] || initialStory;
  const selectedStage = Math.min(stageIndex, story.stages.length - 1);
  const stage = story.stages[selectedStage];
  const selectComparison = (index: number) => { setComparisonIndex(index); setStageIndex(0); };
  return <section className={`ccna-visual-explainer ${styles.explainer}`} id="visual-walkthrough" aria-labelledby={`${id}-title`}>
    <header><p className="eyebrow">See the idea</p><h2 id={`${id}-title`}>{story.title}</h2></header>
    {stories.length > 1 ? <div className={styles.comparisons} role="group" aria-label="Visual comparisons" onKeyDown={event => selectWithKeyboard(event, selectComparison)}>
      {stories.map((item, index) => <button type="button" key={item.title} aria-pressed={story === item} aria-controls={`${id}-stage`} onClick={() => selectComparison(index)}>{item.title}</button>)}
    </div> : null}
    <p className={styles.takeaway}>{story.takeaway}</p>
    {artwork ? <figure className="ccna-visual-artwork">
      <Image src={artwork.src} width={artwork.width} height={artwork.height} alt={artwork.alt} sizes="(max-width: 767px) calc(100vw - 40px), 800px" />
      <Image className="ccna-visual-brand" src="/brand/quantumcrafters-logo.png" width={198} height={74} alt="QuantumCrafters Studio" />
      <figcaption>A physical model of the lab. The computers are represented by VPCS nodes in GNS3.</figcaption>
    </figure> : null}
    <div className={styles.stages} role="group" aria-label="Visual explanation steps" onKeyDown={event => selectWithKeyboard(event, setStageIndex)}>
      {story.stages.map((step, index) => <button type="button" key={step.title} aria-pressed={selectedStage === index} aria-controls={`${id}-stage`} onClick={() => setStageIndex(index)}><span aria-hidden="true">{index + 1}</span>{step.title}</button>)}
    </div>
    <div className={styles.stage} id={`${id}-stage`}>
      <div className={styles.canvas} data-layout={story.layout} data-evidence={story.connections.length === 0} data-dense={story.nodes.length === 6 && story.layout !== "fabric"}>
        <div className={styles.wide}><CcnaWebsiteVisualDiagram story={story} stageIndex={selectedStage} /></div>
        <div className={styles.narrow}><CcnaWebsiteVisualDiagram story={story} stageIndex={selectedStage} compact /></div>
      </div>
      <div className={`ccna-visual-stage-copy ${styles.stageCopy}`} aria-live="polite" aria-atomic="true"><span>Step {selectedStage + 1} of {story.stages.length}</span><h3>{stage.title}</h3><p>{stage.explanation}</p></div>
    </div>
    <div className={styles.controls}>
      <button type="button" aria-label="Previous visual step" title="Previous step" disabled={selectedStage === 0} onClick={() => setStageIndex(Math.max(0, selectedStage - 1))}><ArrowLeft aria-hidden="true" /></button>
      <button type="button" aria-label="Restart visual explanation" title="Restart explanation" disabled={selectedStage === 0} onClick={() => setStageIndex(0)}><RotateCcw aria-hidden="true" /></button>
      <button type="button" aria-label="Next visual step" title="Next step" disabled={selectedStage === story.stages.length - 1} onClick={() => setStageIndex(Math.min(story.stages.length - 1, selectedStage + 1))}><ArrowRight aria-hidden="true" /></button>
    </div>
    {/^Lab boundary:/i.test(story.boundary) ? <CcnaLabBoundary boundary={story.boundary} /> : <p className={styles.boundary}><strong>What this model leaves out:</strong> {story.boundary}</p>}
    <details className={`ccna-visual-transcript ${styles.transcript}`}><summary>Full visual explanation and references</summary>{stories.map((item) => <div key={item.title}>{stories.length > 1 ? <h3>{item.title}</h3> : null}<p>{item.altText}</p><p>{item.boundary}</p><ol>{item.stages.map((step) => <li key={step.title}><strong>{step.title}</strong><p>{step.explanation}</p>{step.sourceUrls.map((url) => <a key={url} href={url} rel="noreferrer" target="_blank">{new URL(url).hostname}</a>)}</li>)}</ol></div>)}</details>
  </section>;
}
