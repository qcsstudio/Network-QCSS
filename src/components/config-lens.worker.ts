import { analyzeConfiguration } from "../lib/config-lens/engine";
import type { Selection } from "../lib/config-lens/catalog";
import { readConfigurationFile, validateTextLimits } from "../lib/config-lens/intake";

self.onmessage = async (event: MessageEvent<{ input: string; file?: File; selection: Selection }>) => {
  try {
    let input = event.data.input;
    if (event.data.file) {
      const read = await readConfigurationFile(event.data.file, (completed, total) => self.postMessage({ progress: { phase: "reading", completed, total } }));
      input = read.text;
    }
    input = validateTextLimits(input).text;
    const analysis = analyzeConfiguration(input, event.data.selection, progress => self.postMessage({ progress }));
    self.postMessage({ analysis });
  } catch (error) {
    // Parser errors are controlled messages, never raw configuration or stack traces.
    self.postMessage({ error: error instanceof RangeError ? "The browser ran out of processing capacity. Close other tabs or use a device with more available memory. Nothing was uploaded." : error instanceof Error ? error.message : "Local analysis failed. Check the export format." });
  }
};
