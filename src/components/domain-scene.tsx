"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { SceneController } from "./consulting-home/scene-engine";

export type DomainSceneVariant = "network" | "operations" | "security" | "cloud" | "training" | "intelligence" | "tools" | "resources" | "assessment" | "assurance";

const descriptions: Record<DomainSceneVariant, string> = {
  network: "Illustrative branch-to-core network path. This is not live telemetry.",
  operations: "Conceptual monitoring wall: observe service signals, triage issues and respond. The indicators are illustrative, not live telemetry.",
  security: "Conceptual policy checkpoint: permitted traffic reaches the destination; denied traffic stops at the boundary. This is not a live firewall or an IPsec diagram.",
  cloud: "Two conceptual workload zones linked by a protected private connection. The model is not a specific cloud provider architecture.",
  training: "Build understanding step by step, then try and verify it at a practice console. This learning model is not an OSI stack or a lab topology.",
  intelligence: "Official-source reports converge for context checking, then enter a priority queue. This is an editorial workflow, not a live feed.",
  resources: "An indexed reference library: read a practical guide and keep the supporting details close at hand.",
  assessment: "Readiness questions paired with an evidence checklist. The animated dial is illustrative and does not represent a measured score.",
  assurance: "A bounded, authorized scope paired with validated findings. The sweep is illustrative; no security test is running.",
  tools: "A focused command input paired with structured diagnostic output. No commands are executed by this illustration."
};

export function DomainScene({ variant, fallback, alt }: { variant: DomainSceneVariant; fallback: string; alt: string }) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<SceneController | null>(null);
  const motion = useRef({ paused: false, reduced: false, hidden: false, labPaused: false });
  const wake = useRef<() => void>(() => {});
  const [paused, setPaused] = useState(false);
  const [ready, setReady] = useState(false);
  const [reduced, setReduced] = useState(false);
  const kind = `domain-${variant}`;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let disposed = false, loading = false, visible = false, frame = 0, previous = 0;

    const tick = (time: number) => {
      frame = 0;
      if (disposed || !controller.current || !visible || motion.current.hidden || motion.current.paused || motion.current.reduced) return;
      if (time - previous >= 1000 / 30) {
        controller.current.render(Math.min((time - previous) / 1000, 0.05));
        previous = time;
      }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      motion.current.reduced = preference.matches;
      motion.current.hidden = document.hidden;
      setReduced(preference.matches);
      cancelAnimationFrame(frame);
      frame = 0;
      controller.current?.render(0);
      if (controller.current && visible && !motion.current.hidden && !motion.current.paused && !motion.current.reduced) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      }
    };
    wake.current = sync;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !loading && !controller.current) {
        loading = true;
        import("./consulting-home/scene-engine").then(({ createScene }) => {
          if (disposed) return;
          controller.current = createScene(element, () => motion.current);
          controller.current.setMode(variant === "security" || variant === "cloud" ? variant : "network");
          setReady(true);
          sync();
        }).catch(() => {
          if (!disposed) element.dataset.renderState = "fallback";
        });
      }
      sync();
    }, { rootMargin: "120px" });
    observer.observe(element);
    preference.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      preference.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
      controller.current?.dispose();
      controller.current = null;
      wake.current = () => {};
    };
  }, [variant]);

  return (
    <div className="qcs-domain-scene">
      <div className="qcs-domain-canvas" ref={host} data-kind={kind} role="img" aria-label={descriptions[variant]}>
        <Image className="qcs-scene-fallback" src={fallback} alt={alt} fill sizes="(max-width: 850px) 92vw, 44vw" />
        <div className="scene-labels" aria-hidden="true" />
      </div>
      {ready ? <div className="qcs-scene-controls">
        <span>{reduced ? "Reduced motion" : "Illustrative model"}</span>
        <button type="button" aria-label={paused ? "Play illustration" : "Pause illustration"} title={paused ? "Play illustration" : "Pause illustration"} aria-pressed={paused} disabled={reduced} onClick={() => {
          const next = !paused;
          motion.current.paused = next;
          setPaused(next);
          wake.current();
        }}>{paused || reduced ? <Play aria-hidden="true" size={17} /> : <Pause aria-hidden="true" size={17} />}</button>
        <button type="button" aria-label="Reset illustration view" title="Reset illustration view" onClick={() => controller.current?.reset()}><RotateCcw aria-hidden="true" size={17} /></button>
      </div> : null}
      <p className="qcs-scene-caption">{descriptions[variant]}</p>
    </div>
  );
}
