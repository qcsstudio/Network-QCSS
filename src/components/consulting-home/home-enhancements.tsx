"use client";

import { useEffect } from "react";
import type { SceneController } from "./scene-engine";

const services = {
  network: {
    kicker: "CONNECT / OPERATE / TROUBLESHOOT",
    title: "Find where the path breaks.",
    copy: "Slow apps? Dropped calls? Unstable links? We trace the fault, check the evidence and agree what to fix. For ongoing support, we define the work and who owns each task.",
    link: "managed-network-services",
    label: "Explore network services",
    secondary: "network-troubleshooting",
    secondaryLabel: "Need troubleshooting?",
  },
  security: {
    kicker: "REVIEW / TEST / VERIFY",
    title: "Know what needs protecting.",
    copy: "Find who can reach your systems and where controls need work. For penetration testing, we agree the assets and methods first. You get findings, a fix plan and an agreed way to test the result.",
    link: "network-security-services",
    label: "Explore network security",
    secondary: "penetration-testing",
    secondaryLabel: "Explore authorized testing",
  },
  cloud: {
    kicker: "DESIGN / CONNECT / VALIDATE",
    title: "Connect your cloud with care.",
    copy: "Link your sites and cloud systems with clear routes and access rules. Before a move or change, we check what depends on each path and plan how to test it.",
    link: "cloud-network-services",
    label: "Explore cloud networking",
    secondary: "network-troubleshooting",
    secondaryLabel: "Investigate a connectivity issue",
  },
};
type Service = keyof typeof services;
const stages = [
  ["01 / SEND", "PC1 sends a packet toward PC2 on another network."],
  ["02 / SWITCH", "The switch forwards the local frame toward the router."],
  ["03 / ROUTE", "The router forwards the packet in a new frame toward PC2."],
  ["04 / RECEIVE", "PC2 receives the packet at the destination."],
  ["05 / REPLY", "PC2 sends a reply through the router and switch toward PC1."],
  [
    "06 / COMPLETE",
    "The reply reaches PC1. Both directions of this conceptual journey are complete.",
  ],
];

// Progressively enhance server-rendered content; navigation and lead capture never depend on WebGL.
export function HomeEnhancements() {
  useEffect(() => {
    const root = document.getElementById("consulting-home");
    if (!root) return;
    root.classList.add("home-enhanced");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = matchMedia("(max-width: 699px)");
    const hover = matchMedia("(hover: hover) and (pointer: fine)");
    const abort = new AbortController();
    const views = new Map<string, SceneController>();
    let backgrounds:
      | ReturnType<typeof import("./backgrounds").createSectionBackgrounds>
      | undefined;
    let disposed = false,
      paused = motion.matches,
      labPaused = false;
    let frame = 0,
      last = 0,
      hoverTimer: ReturnType<typeof setTimeout> | undefined;
    let currentService: Service = "network",
      heroMode: Service = "network";
    const state = () => ({
      paused,
      reduced: motion.matches,
      labPaused,
      hidden: document.hidden,
    });
    const el = <T extends HTMLElement = HTMLElement>(id: string) =>
      root.querySelector<T>(`#${id}`)!;
    const all = <T extends HTMLElement = HTMLElement>(selector: string) => [
      ...root.querySelectorAll<T>(selector),
    ];
    const listen = (target: EventTarget, event: string, fn: EventListener) =>
      target.addEventListener(event, fn, { signal: abort.signal });

    function updateMotion() {
      root!.classList.toggle("motion-paused", paused || motion.matches);
      all<HTMLButtonElement>("[data-motion]").forEach((button) => {
        const label = motion.matches
          ? "Reduced motion enabled"
          : paused
            ? "Resume all animations"
            : "Pause all animations";
        button.disabled = motion.matches;
        button.setAttribute("aria-label", label);
        button.title = label;
        button.setAttribute("aria-pressed", String(paused));
      });
      const lab = el<HTMLButtonElement>("lab-motion");
      lab.disabled = paused || motion.matches;
      lab.setAttribute("aria-pressed", String(labPaused || lab.disabled));
      lab.setAttribute(
        "aria-label",
        labPaused ? "Resume packet animation" : "Pause packet animation",
      );
      lab.title = lab.getAttribute("aria-label")!;
    }
    function selectService(button: HTMLElement) {
      const mode = button.dataset.service as Service;
      if (!(mode in services)) return;
      currentService = mode;
      const data = services[mode];
      all<HTMLButtonElement>("[data-service]").forEach((tab) => {
        tab.setAttribute("aria-selected", String(tab === button));
        tab.tabIndex = tab === button ? 0 : -1;
      });
      el("service-panel").setAttribute("aria-labelledby", button.id);
      el("service-kicker").textContent = data.kicker;
      el("service-title").textContent = data.title;
      el("service-copy").textContent = data.copy;
      const link = el<HTMLAnchorElement>("service-link");
      link.href = `/services/${data.link}`;
      link.firstChild!.textContent = `${data.label} `;
      const secondary = el<HTMLAnchorElement>("service-secondary");
      secondary.href = `/services/${data.secondary}`;
      secondary.textContent = data.secondaryLabel;
      el("packet-title").textContent =
        mode === "network"
          ? "Network / packet forwarding"
          : mode === "cloud"
            ? "Hybrid cloud / IPsec VPN example"
            : "Security / policy checkpoint";
      root!.querySelector<HTMLElement>(".packet-stages")!.hidden =
        mode !== "cloud";
      root!.querySelector<HTMLElement>(".packet-explainer")!.dataset.mode =
        mode;
      const note =
        mode === "network"
          ? "Branch users reach an application server through a WAN router. Illustrative traffic, not live telemetry."
          : mode === "security"
            ? "Permitted traffic reaches its destination. Denied traffic stops at the policy boundary. This is a conceptual firewall, not a live test."
            : "Two workload zones connect through an illustrative IPsec tunnel. Peers protect the inner packet; outer headers remain visible. IKE is omitted.";
      el("packet-note").textContent = note;
      el("service-scene").setAttribute(
        "aria-label",
        note,
      );
      views.get("service-scene")?.setMode(mode);
      backgrounds?.setService(mode);
    }
    function selectObject(kind: "method" | "evidence", index: string) {
      all(`[data-${kind}]`).forEach((button) => {
        const selected = button.dataset[kind] === index;
        button.setAttribute("aria-pressed", String(selected));
        button
          .closest(kind === "method" ? "article" : "li")
          ?.classList.toggle("selected", selected);
      });
      el(`${kind}-scene`).dataset.focusItem = index;
      if (kind === "evidence")
        all(".evidence-specimen dl>div").forEach((row, i) =>
          row.classList.toggle("selected", i === Number(index)),
        );
      views.get(`${kind}-scene`)?.render(0);
    }
    listen(root, "click", ((event: MouseEvent) => {
      const button = (event.target as Element).closest<HTMLElement>("button");
      if (!button) return;
      if (button.hasAttribute("data-motion")) {
        paused = !paused;
        updateMotion();
      }
      if (button.id === "reset-view") views.get("hero-scene")?.reset();
      if (button.dataset.service) selectService(button);
      if (button.dataset.focus) {
        heroMode = button.dataset.focus as Service;
        all("[data-focus]").forEach((item) =>
          item.setAttribute("aria-pressed", String(item === button)),
        );
        views.get("hero-scene")?.setMode(heroMode);
        root!.querySelector(".scene-toolbar>span")!.textContent =
          heroMode === "network"
            ? "Illustrative architecture"
            : "IPsec ESP tunnel example";
      }
      if (button.dataset.method !== undefined)
        selectObject("method", button.dataset.method);
      if (button.dataset.evidence !== undefined)
        selectObject("evidence", button.dataset.evidence);
      if (button.id === "lab-motion") {
        labPaused = !labPaused;
        updateMotion();
      }
      if (button.id === "run-packet") views.get("lab-scene")?.replay();
    }) as EventListener);
    const tabs = all<HTMLButtonElement>("[data-service]");
    tabs.forEach((button, index) => {
      listen(button, "pointerenter", ((event: PointerEvent) => {
        if (hover.matches && event.pointerType !== "touch") {
          clearTimeout(hoverTimer);
          hoverTimer = setTimeout(() => selectService(button), 100);
        }
      }) as EventListener);
      listen(button, "pointerleave", () => clearTimeout(hoverTimer));
      listen(button, "focus", () => {
        clearTimeout(hoverTimer);
        selectService(button);
      });
      listen(button, "keydown", ((event: KeyboardEvent) => {
        const next = {
          ArrowRight: index + 1,
          ArrowDown: index + 1,
          ArrowLeft: index - 1,
          ArrowUp: index - 1,
          Home: 0,
          End: 2,
        }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        tabs[(next + tabs.length) % tabs.length].focus();
      }) as EventListener);
    });
    const orientation = () =>
      root!
        .querySelector(".service-tabs")!
        .setAttribute(
          "aria-orientation",
          coarse.matches ? "vertical" : "horizontal",
        );
    listen(coarse, "change", orientation);
    orientation();
    listen(motion, "change", () => {
      paused = motion.matches;
      updateMotion();
    });
    const visibility = () =>
      root!.classList.toggle("page-hidden", document.hidden);
    listen(document, "visibilitychange", visibility);
    visibility();
    updateMotion();
    selectObject("method", "0");
    selectObject("evidence", "0");
    const entrances = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          entry.target.classList.toggle("motion-in-view", entry.isIntersecting);
          if (entry.isIntersecting) entry.target.classList.add("home-arrived");
        }),
      { threshold: 0.1 },
    );
    all(".motion-surface, h1, h2, h3").forEach((element) =>
      entrances.observe(element),
    );
    const chapters = all<HTMLAnchorElement>(".chapter-nav a");
    const updateChapter = () => {
      let selected = chapters[0];
      chapters.forEach((link) => {
        if (root!.querySelector(link.hash)!.getBoundingClientRect().top <= 190)
          selected = link;
      });
      chapters.forEach((link) =>
        link === selected
          ? link.setAttribute("aria-current", "location")
          : link.removeAttribute("aria-current"),
      );
    };
    const chapterObserver = new IntersectionObserver(updateChapter, {
      rootMargin: "-160px 0px -45% 0px",
      threshold: [0, 1],
    });
    chapters.forEach((link) =>
      chapterObserver.observe(root!.querySelector(link.hash)!),
    );

    // Import the GPU code after first paint, and construct below-fold scenes only near the viewport.
    let sceneObserver: IntersectionObserver | undefined;
    const initialize = async () => {
      try {
        const [engine, backdrop] = await Promise.all([
          import("./scene-engine"),
          import("./backgrounds"),
        ]);
        if (disposed) return;
        backgrounds = backdrop.createSectionBackgrounds(state, root!);
        backgrounds.setService(currentService);
        sceneObserver = new IntersectionObserver(
          (entries) =>
            entries.forEach(({ target, isIntersecting }) => {
              if (!isIntersecting || views.has(target.id)) return;
              sceneObserver!.unobserve(target);
              try {
                const view = engine.createScene(
                  target as HTMLElement,
                  state,
                  (index) => {
                    el("lab-step").textContent = stages[index][0];
                    el("lab-message").textContent = stages[index][1];
                  },
                );
                views.set(target.id, view);
                if (target.id === "service-scene") view.setMode(currentService);
                if (target.id === "hero-scene") view.setMode(heroMode);
              } catch {
                (target as HTMLElement).dataset.renderState = "fallback";
                target.querySelector("canvas:not(.section-backdrop)")?.remove();
              }
            }),
          { rootMargin: "150px" },
        );
        all(".hero-scene, .service-scene, .object-scene").forEach((element) =>
          sceneObserver!.observe(element),
        );
        const animate = (time: number) => {
          if (disposed) return;
          frame = requestAnimationFrame(animate);
          if (time - last < 33) return;
          const delta = Math.min((time - last) / 1000, 0.05);
          last = time;
          if (document.hidden) return;
          views.forEach((view) => view.render(delta));
          backgrounds?.render(delta);
        };
        frame = requestAnimationFrame(animate);
        listen(window, "resize", () => views.forEach((view) => view.resize()));
      } catch {
        all(".object-scene").forEach((element) => {
          element.dataset.renderState = "fallback";
        });
      }
    };
    const timer = setTimeout(() => void initialize(), 100);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(hoverTimer);
      cancelAnimationFrame(frame);
      abort.abort();
      entrances.disconnect();
      chapterObserver.disconnect();
      sceneObserver?.disconnect();
      views.forEach((view) => view.dispose());
      views.clear();
      backgrounds?.dispose();
      root.classList.remove("motion-paused", "page-hidden", "home-enhanced");
    };
  }, []);
  return null;
}
