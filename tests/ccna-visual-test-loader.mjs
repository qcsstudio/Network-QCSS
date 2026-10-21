import { registerHooks } from "node:module";

// Node's pure SSR tests do not run Next's CSS pipeline. Browser QA uses the real module.
export async function loadVisualExplainer() {
  const hook = registerHooks({
    load(url, context, nextLoad) {
      if (url.endsWith(".module.css")) return {
        format: "module", shortCircuit: true,
        source: "export default new Proxy({}, {get: (_target, key) => String(key)});"
      };
      return nextLoad(url, context);
    }
  });
  try { return await import("../src/components/ccna-visual-explainer.tsx"); }
  finally { hook.deregister(); }
}
