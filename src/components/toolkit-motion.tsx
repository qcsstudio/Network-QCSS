"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Network, Monitor, Play, Pause, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import reference from "@/lib/toolkit/reference.json";
import styles from "./network-toolkit.module.css";

const subscribe = (notify: () => void) => { const media = matchMedia("(prefers-reduced-motion: reduce)"); media.addEventListener("change", notify); return () => media.removeEventListener("change", notify); };
const snapshot = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
export function ToolkitMotion({ kind }: { kind: keyof typeof reference.stories }) {
  const story = reference.stories[kind];
  const systemReduced = useSyncExternalStore(subscribe, snapshot, () => true);
  const [reduce, setReduce] = useState(false), [playing, setPlaying] = useState(false), [step, setStep] = useState(0);
  const reduced = reduce || systemReduced;
  const dot = useRef<SVGCircleElement>(null);
  const current = story.steps[step];
  const x = (i: number) => 800 * (i + .5) / story.nodes.length;
  const from = x(Number(current[2])), to = x(Number(current[3]));
  useEffect(() => {
    const hide = () => { if (document.hidden) setPlaying(false); };
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const preference = () => { if (media.matches) setPlaying(false); };
    document.addEventListener("visibilitychange", hide);
    media.addEventListener("change", preference);
    return () => { document.removeEventListener("visibilitychange", hide); media.removeEventListener("change", preference); };
  }, []);
  useEffect(() => {
    if (!playing || reduced) return;
    let frame = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      dot.current?.setAttribute("cx", String(from + (to - from) * Math.min(elapsed / 1000, 1)));
      if (elapsed >= 1700) {
        if (step === story.steps.length - 1) setPlaying(false); else setStep(value => value + 1);
      } else frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [playing, reduced, step, from, to, story.steps.length]);
  const move = (next: number) => { setPlaying(false); setStep(next); };
  return <section className={styles.motion} aria-label={story.title}>
    <div className={styles.motionHeading}><h3>{story.title}</h3><span>Illustration, not captured traffic</span></div>
    <div className={styles.motionNodes} style={{ gridTemplateColumns: `repeat(${story.nodes.length},1fr)` }}>{story.nodes.map((name, index) => <div key={name}>{index ? <Network size={23} aria-hidden="true" /> : <Monitor size={23} aria-hidden="true" />}<span>{name}</span></div>)}</div>
    <svg className={styles.diagram} viewBox="0 0 800 120" role="img" aria-label={`Illustrated exchange: ${String(current[0])}`}>
      <defs><marker id={`tk-arrow-${kind}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#086c63" /></marker></defs>
      <line x1={x(0)} x2={x(story.nodes.length - 1)} y1="60" y2="60" stroke="#b5c2ce" strokeWidth="2" />
      {story.nodes.map((name, index) => <circle key={name} cx={x(index)} cy="60" r="16" fill="white" stroke="#708599" strokeWidth="2" />)}
      <line x1={from + (to > from ? 20 : -20)} x2={to + (to > from ? -24 : 24)} y1="60" y2="60" stroke="#086c63" strokeWidth="3" markerEnd={`url(#tk-arrow-${kind})`} />
      {!reduced && <circle ref={dot} key={step} cx={to} cy="60" r="8" fill="#a61952" stroke="white" strokeWidth="2" />}
    </svg>
    <div className={styles.motionCopy}><span>Step {step + 1} of {story.steps.length}</span><h4>{String(current[0])}</h4><p>{String(current[1])}</p></div>
    <div className={styles.motionControls}><div className={styles.actions}>
      <button type="button" className={styles.icon} title="Restart sequence" aria-label="Restart sequence" onClick={() => move(0)}><RotateCcw size={18} /></button>
      <button type="button" className={styles.icon} title="Previous step" aria-label="Previous step" disabled={!step} onClick={() => move(step - 1)}><SkipBack size={18} /></button>
      <button type="button" className={`${styles.icon} ${styles.primary}`} title={playing && !reduced ? "Pause sequence" : "Play sequence"} aria-label={playing && !reduced ? "Pause sequence" : "Play sequence"} disabled={reduced} onClick={() => { if (!playing && step === story.steps.length - 1) setStep(0); setPlaying(!playing); }}>{playing && !reduced ? <Pause size={18} /> : <Play size={18} />}</button>
      <button type="button" className={styles.icon} title="Next step" aria-label="Next step" disabled={step === story.steps.length - 1} onClick={() => move(step + 1)}><SkipForward size={18} /></button>
    </div><label className={styles.checkbox}><input type="checkbox" checked={reduced} disabled={systemReduced} onChange={event => { setReduce(event.target.checked); setPlaying(false); }} />Reduce motion</label></div>
  </section>;
}
