const colors = ["#c87031", "#c63f74", "#357bb0"];

export function pointOnPath(points, progress) {
  const lengths = points
    .slice(1)
    .map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (!total) return points[0] || [0, 0];
  let distance = Math.max(0, Math.min(1, progress)) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i] || i === lengths.length - 1) {
      const ratio = lengths[i] ? distance / lengths[i] : 0;
      return points[i].map(
        (value, axis) => value + (points[i + 1][axis] - value) * ratio,
      );
    }
    distance -= lengths[i];
  }
}

// Normalized architectural traces, not a claim about a real client network.
export function routesFor(kind) {
  if (kind === "security")
    return [0.3, 0.5, 0.7].map((y) => [
      [0.05, y],
      [0.34, y],
      [0.46, y],
      [0.56, y],
      [0.68, y],
      [0.95, y],
    ]);
  if (kind === "cloud")
    return [0, 1, 2].map((i) => [
      [0.04, 0.24 + i * 0.24],
      [0.23, 0.24 + i * 0.24],
      [0.36, 0.72 - i * 0.22],
      [0.78, 0.72 - i * 0.22],
      [0.9, 0.63 - i * 0.22],
    ]);
  if (kind === "approach")
    return [0, 1, 2].map((i) => [
      [0.04, 0.42 + i * 0.07],
      [0.27, 0.42 + i * 0.07],
      [0.34, 0.28 + i * 0.07],
      [0.59, 0.28 + i * 0.07],
      [0.67, 0.42 + i * 0.07],
      [0.96, 0.42 + i * 0.07],
    ]);
  if (kind === "guardrails")
    return [0, 1, 2].map((i) => {
      const inset = 0.06 + i * 0.09;
      return [
        [inset, inset],
        [1 - inset, inset],
        [1 - inset, 1 - inset],
        [inset, 1 - inset],
        [inset, inset],
      ];
    });
  if (kind === "learning")
    return [
      [
        [0.05, 0.81],
        [0.29, 0.81],
        [0.29, 0.67],
        [0.66, 0.67],
        [0.66, 0.81],
        [0.94, 0.81],
      ],
    ];
  if (kind === "contact")
    return [0, 1, 2].map((i) => [
      [0.06, 0.16 + i * 0.3],
      [0.39, 0.16 + i * 0.3],
      [0.65, 0.48],
      [0.96, 0.48],
    ]);
  return [0, 1, 2, 3, 4].map((i) => [
    [0.02, 0.16 + i * 0.14],
    [0.2 + i * 0.04, 0.16 + i * 0.14],
    [0.32 + i * 0.04, 0.3 + i * 0.13],
    [0.67, 0.3 + i * 0.13],
    [0.8, 0.18 + i * 0.13],
    [0.98, 0.18 + i * 0.13],
  ]);
}

export function shouldAnimate({
  visible,
  paused,
  reduced,
  hidden,
  labPaused,
  kind,
}) {
  return (
    visible &&
    !paused &&
    !reduced &&
    !hidden &&
    kind !== "evidence" &&
    !(kind === "learning" && labPaused)
  );
}

class SectionBackground {
  constructor(element, kind, state) {
    this.element = element;
    this.kind = kind;
    this.state = state;
    this.phase = 0;
    this.visible = false;
    this.draws = 0;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "section-backdrop";
    this.canvas.setAttribute("aria-hidden", "true");
    this.context = this.canvas.getContext("2d", { alpha: true });
    if (!this.context) return;
    element.classList.add("has-backdrop");
    element.dataset.backdrop = kind;
    element.prepend(this.canvas);
    this.observer = new IntersectionObserver(
      ([entry]) => {
        this.visible = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    this.observer.observe(this.canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
    this.resize();
  }
  resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height || !this.context) return;
    this.width = width;
    this.height = height;
    // Cap each decorative surface at two megapixels, independent of text resolution.
    this.dpr = Math.min(
      devicePixelRatio || 1,
      2,
      Math.sqrt(2000000 / (width * height)),
    );
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(height * this.dpr);
    this.draw(true);
  }
  line(points, color, opacity, width = 1) {
    const c = this.context;
    c.globalAlpha = opacity;
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    points.forEach(([x, y], i) =>
      i
        ? c.lineTo(x * this.width, y * this.height)
        : c.moveTo(x * this.width, y * this.height),
    );
    c.stroke();
  }
  rectangle(x, y, w, h, color, opacity) {
    const c = this.context;
    c.strokeStyle = color;
    c.globalAlpha = opacity;
    c.lineWidth = 1;
    c.strokeRect(
      x * this.width,
      y * this.height,
      w * this.width,
      h * this.height,
    );
  }
  draw(forceSample = false) {
    if (!this.context || !this.width) return;
    const c = this.context,
      kind = this.kind;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.width, this.height);
    if (kind === "learning") {
      for (let x = 0.04; x < 1; x += 0.08)
        this.line(
          [
            [x, 0.08],
            [x, 0.93],
          ],
          "#357bb0",
          0.12,
        );
      for (let y = 0.08; y < 1; y += 0.12)
        this.line(
          [
            [0.04, y],
            [0.96, y],
          ],
          "#357bb0",
          0.12,
        );
      [
        [0.04, 0.08],
        [0.96, 0.08],
        [0.04, 0.92],
        [0.96, 0.92],
      ].forEach(([x, y]) => {
        this.line(
          [
            [x - 0.018, y],
            [x + 0.018, y],
          ],
          colors[2],
          0.5,
        );
        this.line(
          [
            [x, y - 0.026],
            [x, y + 0.026],
          ],
          colors[2],
          0.5,
        );
      });
    }
    if (kind === "evidence") {
      for (let i = 0; i < 3; i++)
        this.rectangle(
          0.24 + i * 0.06,
          0.1 + i * 0.09,
          0.55,
          0.61,
          colors[i],
          0.22,
        );
    } else {
      if (kind === "security") {
        this.rectangle(0.035, 0.11, 0.38, 0.78, colors[0], 0.32);
        this.rectangle(0.59, 0.11, 0.38, 0.78, colors[1], 0.38);
        this.rectangle(0.465, 0.2, 0.07, 0.6, colors[1], 0.55);
      }
      if (kind === "cloud")
        [0, 1, 2].forEach((i) =>
          this.rectangle(0.41, 0.12 + i * 0.22, 0.47, 0.13, colors[i], 0.27),
        );
      const routes = routesFor(kind);
      routes.forEach((points, i) => {
        const color = colors[i % 3];
        const emphasis =
          kind === "approach" &&
          i ===
            Number(
              document.getElementById("method-scene")?.dataset.focusItem || 0,
            );
        this.line(
          points,
          color,
          emphasis ? 0.56 : kind === "guardrails" ? 0.38 : 0.25,
          emphasis ? 2 : 1.2,
        );
        if (kind !== "guardrails")
          [points[0], points[points.length - 1]].forEach(([x, y]) => {
            c.globalAlpha = 0.5;
            c.strokeStyle = color;
            c.strokeRect(x * this.width - 3, y * this.height - 3, 6, 6);
          });
        const t = (this.phase * 0.055 + i * 0.19) % 1;
        // Measure distance in display pixels so packets don't accelerate at corners.
        const p = pointOnPath(
          points.map(([x, y]) => [x * this.width, y * this.height]),
          t,
        );
        c.globalAlpha = kind === "guardrails" ? 0.55 : 0.72;
        c.fillStyle = color;
        c.fillRect(p[0] - 5, p[1] - 2, 10, 4);
        if (kind === "security" && t > 0.4 && t < 0.6) {
          c.strokeStyle = colors[1];
          c.lineWidth = 1.5;
          c.strokeRect(p[0] - 8, p[1] - 5, 16, 10);
        }
      });
    }
    c.globalAlpha = 1;
    this.canvas.dataset.phase = this.phase.toFixed(3);
    if (new URLSearchParams(location.search).has("qa")) {
      this.canvas.dataset.draws = String(++this.draws);
      if (
        forceSample ||
        this.lastSample === undefined ||
        this.phase - this.lastSample > 0.8
      ) {
        const pixels = c.getImageData(
          0,
          0,
          this.canvas.width,
          this.canvas.height,
        ).data;
        let ink = 0;
        for (let i = 3; i < pixels.length; i += 64) if (pixels[i] > 8) ink++;
        this.canvas.dataset.ink = String(ink);
        this.lastSample = this.phase;
      }
    }
  }
  render(delta) {
    if (!this.context) return;
    if (this.kind === "approach") {
      const focus = document.getElementById("method-scene")?.dataset.focusItem;
      if (focus !== this.lastFocus) {
        this.lastFocus = focus;
        this.draw();
      }
    }
    if (
      this.visible &&
      this.dpr !==
        Math.min(
          devicePixelRatio || 1,
          2,
          Math.sqrt(2000000 / (this.width * this.height)),
        )
    )
      this.resize();
    if (
      !shouldAnimate({
        ...this.state(),
        visible: this.visible,
        kind: this.kind,
      })
    )
      return;
    this.phase += delta;
    this.draw();
  }
}

export function createSectionBackgrounds(state, root) {
  const specs = [
    ["#service-scene", "network"],
    ["#situations", "situations"],
    ["#approach", "approach"],
    ["#deliverables", "evidence"],
    ["#guardrails", "guardrails"],
    ["#learning", "learning"],
    ["#contact", "contact"],
  ];
  const backgrounds = specs
    .map(([selector, kind]) => {
      const element = root.querySelector(selector);
      if (!element) return null;
      try {
        return new SectionBackground(element, kind, state);
      } catch {
        element.querySelector(".section-backdrop")?.remove();
        element.classList.remove("has-backdrop");
        return null;
      }
    })
    .filter(Boolean);
  return {
    dispose() {
      backgrounds.forEach((b) => {
        b.observer?.disconnect();
        b.resizeObserver?.disconnect();
        b.canvas.remove();
        b.element.classList.remove("has-backdrop");
      });
    },
    render(delta) {
      backgrounds.forEach((background) => background.render(delta));
    },
    setService(kind) {
      if (!["network", "security", "cloud"].includes(kind)) return;
      const background = backgrounds.find(
        (item) => item.element.id === "service-scene",
      );
      if (background) {
        background.kind = kind;
        background.element.dataset.backdrop = kind;
        background.draw(true);
      }
    },
  };
}
