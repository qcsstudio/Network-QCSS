import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildDomainModel } from "./domain-models.js";

export function createScene(element, state, onStage = () => {}) {
  const reduceMotion = {
    get matches() {
      return state().reduced;
    },
  };
  let paused = state().paused,
    labPaused = state().labPaused;
  const palette = {
    shell: 0xf7f6fb,
    body: 0x555d78,
    mint: 0xffba87,
    green: 0xb62962,
    coral: 0xed719d,
    metal: 0x959db3,
    dark: 0x292c3c,
  };
  const mat = (color, metalness = 0.25, roughness = 0.4) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness });

  class NetworkScene {
    constructor(element, hero = false) {
      this.el = element;
      this.hero = hero;
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 100);
      this.camera.position.set(12, 14, 18);
      this.camera.lookAt(0, 0.5, 0);
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        preserveDrawingBuffer: new URLSearchParams(location.search).has("qa"),
        powerPreference: "low-power",
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;
      this.renderer.domElement.setAttribute("aria-hidden", "true");
      this.el.prepend(this.renderer.domElement);
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const environment = new RoomEnvironment();
      this.environmentTarget = pmrem.fromScene(environment, 0.04);
      this.scene.environment = this.environmentTarget.texture;
      environment.dispose();
      pmrem.dispose();
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x9497af, 2));
      const key = new THREE.DirectionalLight(0xffffff, 3.2);
      key.position.set(-5, 12, 8);
      key.castShadow = true;
      key.shadow.mapSize.set(hero ? 2048 : 1024, hero ? 2048 : 1024);
      Object.assign(key.shadow.camera, {
        left: -10,
        right: 10,
        top: 10,
        bottom: -10,
        near: 0.5,
        far: 40,
      });
      key.shadow.bias = -0.0003;
      this.scene.add(key);
      const rim = new THREE.DirectionalLight(0xffdce9, 1.3);
      rim.position.set(6, 4, -7);
      this.scene.add(rim);
      this.root = new THREE.Group();
      this.scene.add(this.root);
      this.routes = [];
      this.labels = [];
      this.groups = {};
      this.materials = new Map();
      this.build();
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls.target.set(0, 0.5, 0);
      this.controls.enableZoom = false;
      this.controls.enablePan = false;
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.minPolarAngle = 0.55;
      this.controls.maxPolarAngle = 1.05;
      this.controls.minAzimuthAngle = 0.1;
      this.controls.maxAzimuthAngle = 1.05;
      this.controls.saveState();
      this.visible = true;
      this.phase = 0;
      this.observer = new IntersectionObserver(
        ([entry]) => {
          this.visible = entry.isIntersecting;
        },
        { rootMargin: "80px" },
      );
      this.observer.observe(this.el);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.el);
      this.resize();
      this.setMode("network");
      this.el.classList.add("webgl-ready");
      this.el.dataset.renderState = "ready";
      this.renderer.domElement.addEventListener("webglcontextlost", (event) => {
        event.preventDefault();
        this.el.classList.remove("webgl-ready");
        this.el.dataset.renderState = "fallback";
      });
      this.renderer.domElement.addEventListener("webglcontextrestored", () => {
        this.el.classList.add("webgl-ready");
        this.el.dataset.renderState = "ready";
        this.resize();
      });
    }
    material(color, metal = 0.25) {
      const id = `${color}-${metal}`;
      if (!this.materials.has(id)) this.materials.set(id, mat(color, metal));
      return this.materials.get(id);
    }
    box(parent, x, y, z, w, h, d, color, radius = 0.06, metal = 0.25) {
      const mesh = new THREE.Mesh(
        new RoundedBoxGeometry(w, h, d, 2, radius),
        this.material(color, metal),
      );
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }
    plate(parent, x, z, w, d, color = palette.shell) {
      this.box(parent, x, 0.03, z, w, 0.16, d, color, 0.1);
      this.box(
        parent,
        x,
        -0.075,
        z,
        w * 0.86,
        0.09,
        d * 0.86,
        palette.metal,
        0.05,
      );
    }
    rack(parent, x, z, height = 2.3, accent = palette.mint) {
      this.box(
        parent,
        x,
        height / 2 + 0.16,
        z,
        0.88,
        height,
        0.78,
        palette.shell,
        0.07,
        0.65,
      );
      this.box(
        parent,
        x,
        height / 2 + 0.16,
        z + 0.4,
        0.71,
        height * 0.87,
        0.045,
        palette.dark,
        0.015,
      );
      for (let i = 0; i < 6; i++) {
        const y = 0.4 + i * ((height - 0.4) / 6);
        this.box(
          parent,
          x,
          y,
          z + 0.44,
          0.59,
          0.19,
          0.085,
          palette.body,
          0.018,
        );
        this.box(
          parent,
          x - 0.17,
          y,
          z + 0.49,
          0.045,
          0.038,
          0.015,
          accent,
          0.005,
          0.1,
        );
        this.box(
          parent,
          x + 0.05,
          y,
          z + 0.49,
          0.24,
          0.022,
          0.015,
          palette.metal,
          0.004,
        );
      }
      this.box(
        parent,
        x,
        height + 0.185,
        z,
        0.42,
        0.012,
        0.45,
        accent,
        0.02,
        0.1,
      );
    }
    cable(points, type, color, options = {}) {
      const featured = options.featured ?? ["network", "security", "cloud"].includes(type);
      const secured = options.secured ?? (type === "security" || type === "cloud");
      const curve = new THREE.CatmullRomCurve3(
        points.map((p) => new THREE.Vector3(...p)),
        false,
        "catmullrom",
        0.12,
      );
      const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 70, featured ? 0.045 : 0.025, 8, false),
        mat(color, 0.35),
      );
      this.root.add(mesh);
      const packets = Array.from({ length: 3 }, () => {
        const packet = this.box(
          this.root,
          0,
          0.2,
          0,
          featured ? 0.3 : 0.13,
          featured ? 0.21 : 0.075,
          featured ? 0.3 : 0.13,
          featured ? 0x292c3c : color,
          0.018,
          0.15,
        );
        if (featured)
          this.box(
            packet,
            0,
            0.115,
            0,
            0.19,
            0.025,
            0.19,
            0xffffff,
            0.008,
            0.1,
          );
        if (secured) {
          const wrapper = new THREE.Group();
          packet.add(wrapper);
          packet.userData.wrapper = wrapper;
          const shell = new THREE.Mesh(
            new RoundedBoxGeometry(0.48, 0.34, 0.48, 2, 0.035),
            new THREE.MeshBasicMaterial({
              color,
              transparent: true,
              opacity: 0.25,
              depthWrite: false,
            }),
          );
          const edge = new THREE.LineSegments(
            new THREE.EdgesGeometry(new THREE.BoxGeometry(0.48, 0.34, 0.48)),
            new THREE.LineBasicMaterial({ color }),
          );
          wrapper.add(shell, edge);
          this.box(wrapper, 0.21, 0, 0, 0.08, 0.32, 0.46, color, 0.012, 0.1);
        }
        return packet;
      });
      const tunnel = new THREE.Group();
      this.root.add(tunnel);
      if (secured) {
        const path = new THREE.CatmullRomCurve3(
          Array.from({ length: 31 }, (_, i) =>
            curve.getPointAt(0.18 + (i / 30) * 0.64),
          ),
        );
        tunnel.add(
          new THREE.Mesh(
            new THREE.TubeGeometry(path, 50, 0.31, 12, false),
            new THREE.MeshBasicMaterial({
              color,
              transparent: true,
              opacity: 0.09,
              depthWrite: false,
              side: THREE.DoubleSide,
            }),
          ),
        );
        [0.18, 0.82].forEach((t) => {
          const portal = new THREE.Mesh(
            new THREE.TorusGeometry(0.34, 0.04, 10, 32),
            this.material(color, 0.15),
          );
          portal.position.copy(curve.getPointAt(t));
          portal.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            curve.getTangentAt(t),
          );
          tunnel.add(portal);
          const peer = this.box(
            tunnel,
            portal.position.x,
            portal.position.y - 0.37,
            portal.position.z,
            0.7,
            0.18,
            0.7,
            palette.shell,
            0.03,
          );
          this.box(peer, 0, 0.1, 0, 0.42, 0.025, 0.42, color, 0.01, 0.1);
        });
      }
      this.routes.push({
        curve,
        packets,
        type,
        mesh,
        tunnel,
        secured,
        featured,
      });
    }
    label(text, point, mode = "") {
      const node = document.createElement("span");
      node.className = "scene-label";
      node.textContent = text;
      this.el.querySelector(".scene-labels").append(node);
      this.labels.push({ node, point: new THREE.Vector3(...point), mode });
    }
    build() {
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(28, 24),
        new THREE.ShadowMaterial({ opacity: 0.16 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.15;
      floor.receiveShadow = true;
      this.root.add(floor);
      const grid = new THREE.GridHelper(17, 34, 0xc7ccdc, 0xdde0eb);
      grid.position.y = -0.14;
      grid.material.transparent = true;
      grid.material.opacity = 0.42;
      this.root.add(grid);
      const branch = new THREE.Group();
      this.root.add(branch);
      this.groups.network = branch;
      this.plate(branch, -3.5, 1.8, 2.4, 2.1);
      this.rack(branch, -3.9, 1.6, 1.3);
      this.box(
        branch,
        -3.05,
        0.78,
        2.05,
        0.72,
        0.95,
        0.12,
        palette.body,
        0.05,
        0.65,
      );
      this.box(
        branch,
        -3.05,
        0.79,
        2.12,
        0.59,
        0.76,
        0.022,
        palette.mint,
        0.02,
        0.15,
      );
      this.box(branch, -3.05, 0.25, 2.05, 0.07, 0.25, 0.08, palette.metal);
      this.box(branch, -3.05, 0.15, 2.08, 0.6, 0.07, 0.35, palette.metal);
      const core = new THREE.Group();
      this.root.add(core);
      this.groups.core = core;
      this.plate(core, 0, 0, 3.15, 2.75);
      for (let i = 0; i < 3; i++)
        this.rack(core, (i - 1) * 0.98, -0.3, i === 1 ? 3.25 : 2.6);
      this.box(core, 0, 0.35, 0.85, 2.45, 0.32, 0.5, palette.body, 0.055, 0.7);
      for (let j = 0; j < 9; j++)
        this.box(
          core,
          -0.96 + j * 0.24,
          0.36,
          1.105,
          0.13,
          0.07,
          0.018,
          palette.mint,
          0.006,
          0.1,
        );
      const cloud = new THREE.Group();
      this.root.add(cloud);
      this.groups.cloud = cloud;
      this.plate(cloud, 2.7, -3.3, 2.9, 2.05);
      for (let i = 0; i < 3; i++) {
        this.box(
          cloud,
          2.7,
          0.4 + i * 0.37,
          -3.3,
          2.35,
          0.27,
          1.6,
          i === 2 ? palette.mint : palette.shell,
          0.1,
          0.55,
        );
        this.box(
          cloud,
          2.7,
          0.4 + i * 0.37,
          -2.48,
          1.7,
          0.055,
          0.025,
          palette.green,
          0.01,
        );
      }
      for (let i = 0; i < 3; i++)
        this.box(
          cloud,
          2.0 + i * 0.68,
          1.75,
          -3.4,
          0.52,
          0.54,
          0.65,
          palette.shell,
          0.065,
          0.55,
        );
      const security = new THREE.Group();
      this.root.add(security);
      this.groups.security = security;
      this.plate(security, 3.3, 2.45, 2.7, 1.8);
      this.box(
        security,
        3.3,
        0.5,
        2.45,
        2.25,
        0.65,
        0.9,
        palette.coral,
        0.07,
        0.5,
      );
      for (let i = 0; i < 8; i++)
        this.box(
          security,
          2.45 + 0.24 * i,
          0.49,
          2.92,
          0.11,
          0.15,
          0.035,
          palette.dark,
          0.008,
        );
      const shape = new THREE.Shape();
      shape.moveTo(0, 1.4);
      shape.lineTo(0.65, 1.12);
      shape.lineTo(0.57, 0.42);
      shape.quadraticCurveTo(0.45, 0.07, 0, -0.2);
      shape.quadraticCurveTo(-0.45, 0.07, -0.57, 0.42);
      shape.lineTo(-0.65, 1.12);
      shape.closePath();
      const shield = new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, {
          depth: 0.16,
          bevelEnabled: true,
          bevelThickness: 0.045,
          bevelSize: 0.045,
          bevelSegments: 2,
          steps: 1,
        }),
        mat(palette.shell, 0.65),
      );
      shield.position.set(3.3, 0.95, 2.3);
      shield.castShadow = true;
      security.add(shield);
      this.box(
        security,
        3.3,
        1.6,
        2.51,
        0.34,
        0.31,
        0.08,
        palette.green,
        0.025,
      );
      const lock = new THREE.Mesh(
        new THREE.TorusGeometry(0.12, 0.033, 8, 20, Math.PI),
        mat(palette.green),
      );
      lock.position.set(3.3, 1.77, 2.52);
      security.add(lock);
      this.cable(
        [
          [-3.5, 0.16, 2.8],
          [-3.5, 0.18, 3.5],
          [-1.6, 0.18, 3.5],
          [-1.6, 0.18, 1.5],
          [0, 0.18, 1.5],
          [0, 0.18, 1.1],
        ],
        "network",
        0xc45120,
      );
      this.cable(
        [
          [0.9, 0.4, 1.15],
          [0.9, 0.65, 2],
          [1.7, 0.65, 2],
          [2.4, 0.65, 3.3],
          [3.3, 0.5, 2.94],
        ],
        "security",
        0xc62968,
      );
      this.cable(
        [
          [1.2, 0.45, 1.12],
          [2.05, 2.4, 0.9],
          [3.8, 2.4, -0.5],
          [3.6, 1.2, -2.1],
          [2.7, 1.14, -2.45],
        ],
        "cloud",
        0x1763ac,
      );
      this.label("BRANCH / USERS", [-3.5, 0.18, 3.25], "network");
      this.label("NETWORK CORE", [0, 3.8, -0.3], "core");
      this.label("SECURITY BOUNDARY", [3.3, 0.16, 3.6], "security");
      this.label("CLOUD WORKLOADS", [2.7, 2.45, -3.5], "cloud");
    }
    resize() {
      const width = this.el.clientWidth,
        height = this.el.clientHeight;
      if (!width || !height) return;
      const mobile = window.innerWidth < 1000;
      const aspect = width / height;
      const viewHeight =
        this.hero && !mobile
          ? 11.6
          : this.hero
            ? Math.max(10, 14 / aspect)
            : Math.max(6.7, 9.4 / aspect);
      const viewWidth = viewHeight * aspect;
      const center = this.hero && !mobile ? 0.68 : 0.5;
      this.camera.left = -viewWidth * center;
      this.camera.right = viewWidth * (1 - center);
      this.camera.top = viewHeight * 0.53;
      this.camera.bottom = -viewHeight * 0.47;
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height, false);
      this.controls.enableRotate = !mobile;
      this.render(0);
    }
    setMode(mode) {
      this.mode = mode;
      this.el.dataset.mode = mode;
      this.labels.forEach((label) => {
        label.node.classList.toggle(
          "active",
          label.mode === mode || (label.mode === "core" && mode === "network"),
        );
        label.node.hidden =
          !this.hero && label.mode !== "core" && label.mode !== mode;
      });
      if (!this.hero) {
        Object.entries(this.groups).forEach(
          ([key, group]) => (group.visible = key === "core" || key === mode),
        );
        const targets = {
          network: [-1.3, 0.6, 0.8],
          security: [1.4, 0.65, 1],
          cloud: [1.2, 0.65, -1.4],
        };
        const target = new THREE.Vector3(...targets[mode]);
        this.camera.position.copy(target).add(new THREE.Vector3(2, 11, 18));
        this.controls.target.copy(target);
        this.controls.update();
      }
      this.routes.forEach((route) => {
        route.mesh.material.transparent = true;
        route.mesh.material.opacity = route.type === mode ? 1 : 0.32;
        route.mesh.visible = this.hero || route.type === mode;
        route.tunnel.visible = route.type === mode;
        route.packets.forEach((packet) => {
          packet.visible = this.hero || route.type === mode;
          packet.scale.setScalar(route.type === mode ? 1.25 : 0.85);
        });
      });
      this.render(0);
    }
    render(delta) {
      if (
        !this.visible ||
        document.hidden ||
        this.el.dataset.renderState === "fallback"
      )
        return;
      if (!paused) this.phase += delta;
      this.routes.forEach((route, i) =>
        route.packets.forEach((packet, j) => {
          const progress =
            route.progress ??
            (this.phase * (route.featured ? 0.085 : 0.16) + j / 3 + i * 0.17) %
              1;
          packet.position.copy(route.curve.getPointAt(progress));
          if (route.featured)
            packet.quaternion.setFromUnitVectors(
              new THREE.Vector3(1, 0, 0),
              route.curve.getTangentAt(progress),
            );
          if (packet.userData.wrapper)
            packet.userData.wrapper.visible =
              progress >= 0.18 && progress <= 0.82;
          if (j === 0 && route.type === this.mode) {
            const stage = route.secured
              ? progress < 0.18
                ? "encapsulate"
                : progress <= 0.82
                  ? "protected"
                  : "decapsulate"
              : "forward";
            this.el.dataset.packetStage = stage;
            this.el.dataset.packetProgress = progress.toFixed(3);
            this.el
              .closest("#service-panel")
              ?.querySelectorAll("[data-tunnel-stage]")
              .forEach((item) =>
                item.classList.toggle(
                  "active",
                  item.dataset.tunnelStage === stage,
                ),
              );
          }
        }),
      );
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      const placedLabels = [];
      this.labels.forEach((label) => {
        if (label.node.hidden) return;
        const p = label.point.clone().project(this.camera);
        const halfWidth = label.node.offsetWidth / 2 + 8;
        const halfHeight = label.node.offsetHeight / 2 + 8;
        const x = THREE.MathUtils.clamp(
          (p.x + 1) * 0.5 * this.el.clientWidth,
          halfWidth,
          this.el.clientWidth - halfWidth,
        );
        let y = THREE.MathUtils.clamp(
          (1 - p.y) * 0.5 * this.el.clientHeight,
          halfHeight,
          this.el.clientHeight - halfHeight,
        );
        for (let attempt = 0; attempt < this.labels.length; attempt++) {
          if (
            !placedLabels.some(
              (other) =>
                Math.abs(x - other.x) < halfWidth + other.w &&
                Math.abs(y - other.y) < halfHeight + other.h,
            )
          )
            break;
          y = Math.max(halfHeight, y - 2 * halfHeight - 3);
        }
        placedLabels.push({ x, y, w: halfWidth, h: halfHeight });
        label.node.style.left = `${x}px`;
        label.node.style.top = `${y}px`;
      });
      this.el.dataset.frame = String(Math.round(this.phase * 30));
      // Opt-in pixel sampling verifies actual WebGL output without exposing scene internals.
      if (
        new URLSearchParams(location.search).has("qa") &&
        (!this.lastProbe || performance.now() - this.lastProbe > 700)
      ) {
        this.lastProbe = performance.now();
        const gl = this.renderer.getContext();
        const width = this.renderer.domElement.width,
          height = this.renderer.domElement.height;
        const pixels = new Uint8Array(width * height * 4);
        gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        let visible = 0,
          hash = 0;
        const colors = new Set();
        for (let i = 0; i < pixels.length; i += 28) {
          if (pixels[i + 3] > 10) visible++;
          hash =
            (Math.imul(hash, 31) +
              pixels[i] +
              pixels[i + 1] * 3 +
              pixels[i + 2] * 7 +
              pixels[i + 3]) >>>
            0;
          colors.add(
            `${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`,
          );
        }
        this.el.dataset.pixelCheck = JSON.stringify({
          visible,
          colors: colors.size,
          hash,
          width,
          height,
        });
      }
    }
  }

  class ObjectScene extends NetworkScene {
    monitor(parent, x, z, color = palette.mint) {
      this.box(parent, x, 1.05, z, 1.35, 0.95, 0.16, palette.body);
      this.box(parent, x, 1.06, z + 0.095, 1.16, 0.75, 0.035, color);
      this.box(parent, x, 0.43, z, 0.12, 0.38, 0.12, palette.metal);
      this.box(parent, x, 0.22, z + 0.1, 0.85, 0.08, 0.5, palette.shell);
    }
    document(parent, x, y, z, accent = palette.green) {
      this.box(parent, x, y, z, 1.8, 2.25, 0.12, palette.shell);
      for (let i = 0; i < 5; i++) {
        this.box(
          parent,
          x - 0.53,
          y + 0.7 - i * 0.35,
          z + 0.085,
          0.14,
          0.13,
          0.035,
          i === 1 ? palette.coral : accent,
        );
        this.box(
          parent,
          x + 0.12,
          y + 0.7 - i * 0.35,
          z + 0.085,
          i === 3 ? 0.65 : 0.95,
          0.045,
          0.035,
          palette.metal,
        );
      }
    }
    check(parent, x, y, z) {
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(0.67, 0.67, 0.16, 40),
        this.material(palette.mint),
      );
      disc.rotation.x = Math.PI / 2;
      disc.position.set(x, y, z);
      parent.add(disc);
      const short = this.box(
        parent,
        x - 0.2,
        y - 0.02,
        z + 0.13,
        0.38,
        0.11,
        0.08,
        palette.green,
      );
      short.rotation.z = -0.7;
      const long = this.box(
        parent,
        x + 0.13,
        y + 0.1,
        z + 0.13,
        0.68,
        0.11,
        0.08,
        palette.green,
      );
      long.rotation.z = 0.8;
    }
    build() {
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(22, 12),
        new THREE.ShadowMaterial({ opacity: 0.12 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -0.15;
      floor.receiveShadow = true;
      this.root.add(floor);
      const kind = this.el.dataset.kind;
      if (kind === "service") {
        const parent = this.root;
        this.serviceModels = {};
        for (const mode of ["network", "security", "cloud"]) {
          const group = new THREE.Group();
          parent.add(group);
          this.root = group;
          const start = this.labels.length;
          buildDomainModel(this, mode, palette);
          this.serviceModels[mode] = { group, labels: this.labels.slice(start), animate: this.domainMotion };
        }
        this.root = parent;
        this.domainSpan = 11;
        return;
      }
      if (kind?.startsWith("domain-")) {
        buildDomainModel(this, kind.slice(7), palette);
        return;
      }
      if (kind === "method") {
        this.focusObjects = [-4, 0, 4].map((x) => {
          const group = new THREE.Group();
          group.position.x = x;
          this.root.add(group);
          this.plate(group, 0, 0, 3, 2.5);
          return group;
        });
        const [scope, evidence, verify] = this.focusObjects;
        this.rack(scope, -0.5, -0.2, 1.65);
        this.monitor(scope, 0.45, 0.4);
        this.document(evidence, 0, 1.35, -0.1);
        const lens = new THREE.Mesh(
          new THREE.TorusGeometry(0.48, 0.085, 12, 40),
          this.material(palette.coral, 0.65),
        );
        lens.position.set(0.45, 1.45, 0.6);
        evidence.add(lens);
        const handle = this.box(
          evidence,
          0.91,
          0.83,
          0.6,
          0.13,
          0.65,
          0.13,
          palette.coral,
        );
        handle.rotation.z = -0.55;
        this.document(verify, 0, 1.35, -0.1);
        this.check(verify, 0.45, 1.55, 0.25);
        this.cable(
          [
            [-2.5, 0.2, 0],
            [-1.9, 0.2, 0],
            [-1.5, 0.2, 0],
          ],
          "method",
          palette.mint,
        );
        this.cable(
          [
            [1.5, 0.2, 0],
            [2, 0.2, 0],
            [2.5, 0.2, 0],
          ],
          "method",
          palette.coral,
        );
        this.label("01 / SCOPE", [-4, 0, 2]);
        this.label("02 / EVIDENCE", [0, 0, 2]);
        this.label("03 / VERIFY", [4, 0, 2]);
      } else if (kind === "evidence") {
        this.focusObjects = [];
        for (let i = 0; i < 3; i++) {
          const file = new THREE.Group();
          this.root.add(file);
          this.document(
            file,
            0,
            1.4,
            0,
            i === 1 ? palette.coral : palette.green,
          );
          file.position.set(
            (i - 1) * 1.65,
            i === 1 ? 0.35 : 0,
            i === 1 ? -0.35 : 0,
          );
          file.rotation.y = (i - 1) * -0.19;
          file.userData.restY = file.position.y;
          this.focusObjects.push(file);
        }
        this.check(this.root, 1.9, 0.9, 0.35);
        this.label("OBSERVE", [-1.65, -0.1, 0.5]);
        this.label("PRIORITIZE", [0, -0.1, 0.5]);
        this.label("VERIFY", [1.9, -0.1, 0.5]);
      } else if (kind === "lab") {
        this.monitor(this.root, -4.5, 0);
        this.monitor(this.root, 4.5, 0, palette.coral);
        [-1.5, 1.5].forEach((x, i) => {
          this.box(
            this.root,
            x,
            0.5,
            0,
            1.7,
            0.65,
            1.15,
            i ? palette.coral : palette.shell,
          );
          for (let n = 0; n < 5; n++)
            this.box(
              this.root,
              x - 0.6 + n * 0.3,
              0.5,
              0.6,
              0.16,
              0.15,
              0.04,
              palette.dark,
            );
        });
        this.cable(
          [
            [-4.5, 0.25, 0.5],
            [-4.5, 0.25, 1.1],
            [-1.9, 0.25, 1.1],
            [-1.5, 0.5, 0.6],
            [-1.1, 0.25, 1.1],
            [1.1, 0.25, 1.1],
            [1.5, 0.5, 0.6],
            [1.9, 0.25, 1.1],
            [4.5, 0.25, 1.1],
            [4.5, 0.25, 0.5],
          ],
          "lab",
          palette.green,
        );
        this.routes[0].progress = 0;
        this.routes[0].packets.forEach((p) => (p.visible = false));
        this.routes[0].packets[0].scale.set(2.4, 2.4, 2.4);
        this.journeyTime = 0;
        ["PC1", "SWITCH", "ROUTER", "PC2"].forEach((name, i) =>
          this.label(name, [-4.5 + i * 3, -0.1, 1.7]),
        );
      } else {
        this.monitor(this.root, -1.3, 0, palette.dark);
        for (let i = 0; i < 3; i++)
          this.box(
            this.root,
            -1.35,
            1.25 - i * 0.17,
            0.14,
            0.6 - i * 0.1,
            0.045,
            0.03,
            palette.mint,
          );
        this.document(this.root, 1, 1.15, -0.3);
        this.box(this.root, -0.4, 0.2, 1, 2.9, 0.28, 0.7, palette.shell);
        for (let i = 0; i < 8; i++)
          this.box(
            this.root,
            -1.5 + i * 0.31,
            0.24,
            1.37,
            0.16,
            0.12,
            0.02,
            i === 2 ? palette.coral : palette.green,
          );
        this.cable(
          [
            [-1.3, 0.15, 0.3],
            [-2.4, 0.15, 0.3],
            [-2.4, 0.15, 1.4],
            [-1.7, 0.15, 1.4],
          ],
          "tools",
          palette.coral,
        );
      }
    }
    resize() {
      const width = this.el.clientWidth,
        height = this.el.clientHeight;
      if (!width || !height) return;
      const kind = this.el.dataset.kind;
      const span = this.domainSpan || (kind === "method" || kind === "lab" ? 13 : 6.5);
      const size = Math.max(
        this.domainHeight || (kind === "method" ? 4.4 : 4.1),
        span / (width / height),
      );
      const horizontal = (size * width) / height;
      Object.assign(this.camera, {
        left: -horizontal / 2,
        right: horizontal / 2,
        top: size / 2,
        bottom: -size / 2,
      });
      this.camera.position.set(2, 8, 20);
      this.controls.target.set(0, 0.65, 0);
      this.controls.enableRotate = false;
      this.controls.update();
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height, false);
      this.render(0);
    }
    setMode(mode) {
      if (!this.serviceModels) return;
      for (const [name, model] of Object.entries(this.serviceModels)) {
        model.group.visible = name === mode;
        model.labels.forEach((label) => { label.node.hidden = name !== mode; });
      }
      this.domainMotion = this.serviceModels[mode]?.animate;
      this.mode = mode;
      this.el.dataset.model = mode;
      this.phase = 0;
      if (this.controls) this.render(0);
    }
    render(delta) {
      this.domainMotion?.(this.phase || 0);
      if (this.focusObjects) {
        const selected = Number(this.el.dataset.focusItem || 0);
        this.focusObjects.forEach((object, index) => {
          const y =
            (object.userData.restY || 0) + (selected === index ? 0.25 : 0);
          object.position.y =
            paused || reduceMotion.matches
              ? y
              : THREE.MathUtils.lerp(object.position.y, y, 0.14);
        });
        this.labels.forEach((label, index) =>
          label.node.classList.toggle("active", index === selected),
        );
      }
      if (this.el.dataset.kind === "lab") {
        if (
          this.visible &&
          !document.hidden &&
          !paused &&
          !labPaused &&
          !reduceMotion.matches
        )
          this.journeyTime += delta;
        const time = this.journeyTime % 13;
        const outbound = time < 6;
        const progress =
          time < 5
            ? time / 5
            : time < 6
              ? 1
              : time < 11
                ? 1 - (time - 6) / 5
                : 0;
        this.routes[0].progress = progress;
        const packet = this.routes[0].packets[0];
        packet.visible = true;
        packet.material = this.material(outbound ? 0xb62962 : 0x225e91, 0.15);
        const index =
          time < 1.6
            ? 0
            : time < 3.3
              ? 1
              : time < 5
                ? 2
                : time < 6
                  ? 3
                  : time < 11
                    ? 4
                    : 5;
        this.el.dataset.packetDirection = outbound ? "request" : "reply";
        this.el.dataset.packetProgress = progress.toFixed(3);
        if (index !== this.lastStage) {
          this.lastStage = index;
          onStage(index);
        }
      }
      super.render(delta);
    }
  }

  const view = element.dataset.kind
    ? new ObjectScene(element)
    : new NetworkScene(element, element.id === "hero-scene");
  let drawing = false;
  const redrawWhenStopped = () => {
    if (drawing || !(state().paused || state().reduced)) return;
    drawing = true;
    view.render(0);
    drawing = false;
  };
  view.controls.addEventListener("change", redrawWhenStopped);
  return {
    render(delta) {
      paused = state().paused;
      labPaused = state().labPaused;
      if (delta > 0 && (paused || state().reduced || (element.dataset.kind === "lab" && labPaused))) return;
      if (view.visible) view.render(delta);
    },
    setMode(mode) {
      view.setMode(mode);
    },
    reset() {
      view.controls.reset();
      view.render(0);
    },
    replay() {
      view.journeyTime = 0;
      view.lastStage = -1;
      view.render(0);
    },
    resize() {
      view.resize();
    },
    dispose() {
      view.observer.disconnect();
      view.resizeObserver.disconnect();
      view.controls.removeEventListener("change", redrawWhenStopped);
      view.controls.dispose();
      const geometries = new Set(),
        materials = new Set();
      view.scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material)
          (Array.isArray(object.material)
            ? object.material
            : [object.material]
          ).forEach((m) => materials.add(m));
        object.shadow?.map?.dispose();
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      view.environmentTarget.dispose();
      view.renderer.dispose();
      view.renderer.forceContextLoss();
      view.renderer.domElement.remove();
      view.labels.forEach((label) => label.node.remove());
      element.classList.remove("webgl-ready");
      delete element.dataset.renderState;
    },
  };
}
