import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import { transform } from "esbuild";
import postcss from "postcss";

const require = createRequire(import.meta.url);

export async function lessonCss() {
  return postcss.parse(await readFile(new URL("../../src/app/globals.css", import.meta.url), "utf8"));
}

// Exact-selector contracts at each breakpoint, not a browser layout calculation.
export function declarationsAt(css, selector, width) {
  const declarations = {};
  css.walkRules(rule => {
    if (!rule.selectors.includes(selector)) return;
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type !== "atrule" || parent.name !== "media") continue;
      const max = parent.params.match(/max-width:\s*(\d+)px/);
      const min = parent.params.match(/min-width:\s*(\d+)px/);
      if ((max && width > Number(max[1])) || (min && width < Number(min[1]))) return;
      if (!max && !min) return;
    }
    rule.walkDecls(declaration => { declarations[declaration.prop] = declaration.value; });
  });
  return declarations;
}

export function descendants(node) {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object" || !node.props) return [];
  return [node, ...descendants(node.props.children)];
}

export function textContent(node) {
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (node == null || typeof node === "boolean") return "";
  return typeof node === "object" ? textContent(node.props?.children) : String(node);
}

// Exercise the actual event/effect bodies with a deterministic hook host. This
// does not emulate DOM layout, React hydration, browser focus or screen readers.
export async function mountComponent(file, name, props) {
  const compiled = await transform(await readFile(file, "utf8"), { loader: "tsx", format: "cjs", jsx: "automatic" });
  const slots = [];
  const timers = new Map();
  const listeners = new Map();
  const storage = new Map();
  const hosts = new Map();
  let currentHosts = new WeakMap();
  let cursor = 0;
  let now = 0;
  let nextTimer = 0;
  let dirty = true;
  let tree;
  let effects = [];
  const document = { activeElement: null };
  class Element {
    focus(options) { this.focusOptions = options; document.activeElement = this; }
    contains(target) { return descendants(this.node).some(node => currentHosts.get(node) === target); }
    closest(selector) { return selector === 'a[href^="#"]' && this.node.type === "a" && this.node.props.href?.startsWith("#") ? this : null; }
  }
  const window = {
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    addEventListener(type, callback) { const group = listeners.get(type) || new Set(); group.add(callback); listeners.set(type, group); },
    removeEventListener(type, callback) { listeners.get(type)?.delete(callback); },
    localStorage: { setItem(key, value) { storage.set(key, value); } }
  };
  const react = {
    useState(initial) {
      const index = cursor++;
      slots[index] ??= { value: typeof initial === "function" ? initial() : initial };
      return [slots[index].value, next => {
        const value = typeof next === "function" ? next(slots[index].value) : next;
        if (!Object.is(value, slots[index].value)) { slots[index].value = value; dirty = true; }
      }];
    },
    useRef(initial) { const index = cursor++; slots[index] ??= { current: initial }; return slots[index]; },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (previous && dependencies?.every((value, i) => Object.is(value, previous.dependencies[i]))) return;
      effects.push(() => { previous?.cleanup?.(); slots[index] = { dependencies, cleanup: effect() }; });
    }
  };
  const compiledModule = { exports: {} };
  vm.runInNewContext(compiled.code, {
    module: compiledModule, exports: compiledModule.exports, window, document, Element,
    require: id => id === "react" ? react : require(id)
  }, { filename: String(file) });

  function bind(node, key = "root") {
    if (Array.isArray(node)) return node.forEach((item, index) => bind(item, `${key}/${index}`));
    if (!node || typeof node !== "object" || !node.props) return;
    if (typeof node.type === "string") {
      const host = hosts.get(key) || new Element();
      host.node = node;
      hosts.set(key, host);
      currentHosts.set(node, host);
      if (node.props.ref && typeof node.props.ref === "object") node.props.ref.current = host;
    }
    bind(node.props.children, `${key}/children`);
  }
  function flush() {
    for (let count = 0; dirty; count++) {
      assert.ok(count < 10, "Unexpected component update loop");
      dirty = false;
      cursor = 0;
      effects = [];
      currentHosts = new WeakMap();
      tree = compiledModule.exports[name](props);
      bind(tree);
      for (const effect of effects) effect();
    }
  }
  flush();
  return {
    get tree() { return tree; }, document, storage,
    find(predicate) { const node = descendants(tree).find(predicate); assert.ok(node, "Expected component node"); return node; },
    host(node) { return currentHosts.get(node); },
    act(callback) { callback(); flush(); },
    key(key) { for (const listener of listeners.get("keydown") || []) listener({ key }); flush(); },
    advance(milliseconds) {
      const end = now + milliseconds;
      while (true) {
        const next = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
        flush();
      }
      now = end;
    },
    unmount() { for (const slot of slots) slot.cleanup?.(); },
    get timerCount() { return timers.size; },
    get listenerCount() { return [...listeners.values()].reduce((total, group) => total + group.size, 0); }
  };
}
