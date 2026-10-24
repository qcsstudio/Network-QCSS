import { analyzeConfiguration } from "../lib/config-lens/engine";
import type { Selection } from "../lib/config-lens/catalog";

self.onmessage = (event: MessageEvent<{ input: string; selection: Selection }>) => {
  try {
    const analysis = analyzeConfiguration(event.data.input, event.data.selection);
    self.postMessage({ analysis });
  } catch (error) {
    // Parser errors are controlled messages, never raw configuration or stack traces.
    self.postMessage({ error: error instanceof Error ? error.message : "Local analysis failed. Check the export format." });
  }
};
