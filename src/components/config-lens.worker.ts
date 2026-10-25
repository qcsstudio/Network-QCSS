import { analyzeConfiguration } from "../lib/config-lens/engine";
import type { Selection } from "../lib/config-lens/catalog";

self.onmessage = async (event: MessageEvent<{ input: string; file?: File; selection: Selection }>) => {
  try {
    let input = event.data.input;
    if (event.data.file) {
      const file = event.data.file;
      const reader = file.stream().getReader();
      const decoder = new TextDecoder("utf-8", { fatal: true });
      const chunks: string[] = [];
      let completed = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(decoder.decode(value, { stream: true }));
          completed += value.byteLength;
          self.postMessage({ progress: { phase: "reading", completed, total: file.size } });
        }
        chunks.push(decoder.decode());
      } catch (error) {
        if (error instanceof RangeError) throw error;
        throw new Error("This file is not readable UTF-8 text. Export a plain-text CLI configuration.");
      } finally { reader.releaseLock(); }
      input = chunks.join("");
    }
    const analysis = analyzeConfiguration(input, event.data.selection, progress => self.postMessage({ progress }));
    self.postMessage({ analysis });
  } catch (error) {
    // Parser errors are controlled messages, never raw configuration or stack traces.
    self.postMessage({ error: error instanceof RangeError ? "The browser ran out of processing capacity. Close other tabs or use a device with more available memory. Nothing was uploaded." : error instanceof Error ? error.message : "Local analysis failed. Check the export format." });
  }
};
