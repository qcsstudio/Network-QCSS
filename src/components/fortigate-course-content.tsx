"use client";

import { useEffect, useRef } from "react";

type PacketStep = {
  title: string; hop: string; ether: string; ip: string; transport: string;
  decision: string; why: string; evidence: string;
};
const paths: Record<string, [string, string[]]> = {
  client: ["At LabClient: local decision", ["client"]],
  server: ["At LabServer: local decision", ["server"]],
  firewall: ["At FortiGate: forwarding decision", ["firewall"]],
  cf: ["LabClient → FortiGate client-facing port2", ["client", "firewall"]],
  fc: ["FortiGate client-facing port2 → LabClient", ["firewall", "client"]],
  fs: ["FortiGate server-facing port3 → LabServer", ["firewall", "server"]],
  sf: ["LabServer → FortiGate server-facing port3", ["server", "firewall"]],
  cs: ["LabClient → port2 → port3 → LabServer", ["client", "firewall", "server"]],
  sc: ["LabServer → port3 → port2 → LabClient", ["server", "firewall", "client"]],
  deny: ["New TCP 22 request: LabClient → STOP at FortiGate", ["client", "firewall"]],
  stuck: ["Reply stops at LabServer route lookup", ["server"]],
  dnsq: ["Concept only: client → abstract DNS resolver", ["client", "dns"]],
  dnsr: ["Concept only: abstract DNS resolver → client", ["dns", "client"]]
};

// Only repository-authored, build-time HTML is accepted here. No user or remote HTML.
export function FortigateCourseContent({ html, steps }: { html: string; steps?: PacketStep[] }) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = container.current;
    if (!host) return;
    const events = new AbortController();
    const options = { signal: events.signal };
    const cleanups: (() => void)[] = [];
    const listen = (node: EventTarget, event: string, fn: EventListener) => node.addEventListener(event, fn, options);

    host.querySelectorAll<HTMLFormElement>("form.quiz").forEach((form) => {
      const output = form.querySelector("output")!;
      const clearFeedback = () => form.querySelectorAll(".feedback").forEach((x) => { x.textContent = ""; });
      listen(form, "submit", (event) => {
        event.preventDefault();
        const questions = [...form.querySelectorAll("fieldset")];
        if (questions.some((q) => !q.querySelector("input:checked"))) {
          output.textContent = "Answer every question first.";
          return;
        }
        let score = 0;
        questions.forEach((question) => {
          const answer = question.querySelector<HTMLInputElement>("input:checked")!;
          score += Number(answer.dataset.correct === "true");
          question.querySelector(".feedback")!.textContent = answer.dataset.feedback ?? "";
        });
        output.textContent = `Score: ${score}/${questions.length}. Read the reasons before retrying.`;
      });
      listen(form, "change", () => { output.textContent = "Answers changed; score again."; clearFeedback(); });
      listen(form, "reset", () => { output.textContent = "Quiz reset."; clearFeedback(); });
    });
    host.querySelectorAll<HTMLButtonElement>("[data-play]").forEach((button) => {
      listen(button, "click", () => {
        const video = [...host.querySelectorAll("video")].find((v) => v.id === button.dataset.play);
        if (video) { video.currentTime = 0; void video.play().catch(() => { /* Native controls remain available. */ }); }
      });
    });
    if (steps?.length) host.querySelectorAll<HTMLElement>(".packet-explorer").forEach((root) => {
      const find = <T extends Element,>(selector: string) => root.querySelector<T>(selector)!;
      const select = find<HTMLSelectElement>(".step-select");
      const pace = find<HTMLSelectElement>(".pace-select");
      const play = find<HTMLButtonElement>(".play-steps");
      let index = 0, playing = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stop = () => { playing = false; clearTimeout(timer); };
      const render = () => {
        const step = steps[index];
        select.value = String(index);
        find(".step-title").textContent = step.title;
        find(".explorer-status").textContent = `Step ${index + 1} of ${steps.length} • ${playing ? "Playing" : "Paused"}`;
        for (const key of ["ether", "ip", "transport", "decision", "why", "evidence"] as const) {
          find(`[data-field="${key}"]`).textContent = step[key];
        }
        const [label, nodes] = paths[step.hop];
        const lane = find(".hop-line");
        const text = document.createElement("span"); text.textContent = label;
        const dot = document.createElement("span"); dot.className = "packet-dot"; dot.setAttribute("aria-hidden", "true");
        lane.replaceChildren(text, dot);
        lane.classList.toggle("reverse", ["fc", "sf", "sc", "dnsr"].includes(step.hop));
        lane.classList.toggle("stationary", ["client", "server", "firewall", "stuck"].includes(step.hop));
        root.classList.toggle("is-fault", ["deny", "stuck"].includes(step.hop));
        root.querySelectorAll<HTMLElement>("[data-node]").forEach((node) => {
          node.classList.toggle("active", nodes.includes(node.dataset.node!));
          node.hidden = node.dataset.node === "dns" && !step.hop.startsWith("dns");
        });
        find<HTMLButtonElement>(".prev-step").disabled = index === 0;
        find<HTMLButtonElement>(".next-step").disabled = index === steps.length - 1;
        root.style.setProperty("--step-time", pace.value + "ms");
        play.textContent = playing ? "Pause steps" : "Play steps";
        root.classList.toggle("is-playing", playing);
      };
      const schedule = () => {
        clearTimeout(timer);
        if (playing) timer = setTimeout(() => {
          if (index === steps.length - 1) stop(); else index++;
          render(); schedule();
        }, Number(pace.value));
      };
      const go = (i: number) => { stop(); index = i; render(); };
      listen(select, "change", () => go(Number(select.value)));
      listen(pace, "change", () => { render(); schedule(); });
      listen(find(".prev-step"), "click", () => go(Math.max(0, index - 1)));
      listen(find(".next-step"), "click", () => go(Math.min(steps.length - 1, index + 1)));
      listen(find(".reset-steps"), "click", () => go(0));
      listen(play, "click", () => {
        if (playing) stop(); else { if (index === steps.length - 1) index = 0; playing = true; }
        render(); schedule();
      });
      listen(document, "visibilitychange", () => { if (document.hidden) { stop(); render(); } });
      cleanups.push(stop);
      render();
    });
    return () => {
      events.abort();
      cleanups.forEach((cleanup) => cleanup());
      host.querySelectorAll("video").forEach((video) => video.pause());
    };
  }, [html, steps]);

  return <div className="fg-content" ref={container} dangerouslySetInnerHTML={{ __html: html }} />;
}
