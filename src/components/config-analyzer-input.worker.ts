import { analyzeConfiguration, type Analysis } from "../lib/config-lens/engine";
import type { Selection } from "../lib/config-lens/catalog";
import { inspectConfiguration, InputValidationError, readConfigurationFile, validateComparison, validateTextLimits, type InputMetadata, type IntakeResult } from "../lib/config-lens/intake";

export type AnalyzerInput = { input: string; file?: File; selection: Selection; metadata: InputMetadata };
export type ValidatedInputs = { intakes: IntakeResult[]; analyses: Analysis[]; comparisonIssues: ReturnType<typeof validateComparison> };

self.onmessage = async (event: MessageEvent<{ inputs: AnalyzerInput[] }>) => {
  try {
    const inputs = event.data.inputs;
    if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 2) throw new InputValidationError("input-count", "Choose one configuration, or a Before/After pair. Batch imports are not supported.");
    const comparisonIssues = inputs.length === 2 ? validateComparison(inputs[0], inputs[1]) : [];
    const intakes: IntakeResult[] = [], analyses: Analysis[] = [];
    for (let index = 0; index < inputs.length; index++) {
      const document = inputs[index];
      let input = document.input, encoding = "Pasted text";
      if (document.file) {
        const read = await readConfigurationFile(document.file, (completed, total) => self.postMessage({ progress: { index, phase: "reading", completed, total } }));
        input = read.text; encoding = read.encoding;
      }
      const normalized = validateTextLimits(input);
      const intake = inspectConfiguration(normalized.text, document.selection, document.metadata, encoding);
      intakes.push(intake);
      if (intake.state !== "blocked" && !comparisonIssues.some(i => i.level === "blocked")) {
        // Reuse the existing parser to validate block balance and supported structure.
        // Only its masked result leaves this worker; original text dies with the job.
        analyses.push(analyzeConfiguration(normalized.text, document.selection, progress => self.postMessage({ progress: { ...progress, index } })));
      }
    }
    self.postMessage({ validated: { intakes, analyses: analyses.length === inputs.length ? analyses : [], comparisonIssues } satisfies ValidatedInputs });
  } catch (error) {
    self.postMessage({ error: error instanceof RangeError ? "The browser reached its processing capacity. Assessment incomplete; no final verdict was produced." : error instanceof Error ? error.message : "Input validation could not finish. Select a clean plaintext export." });
  }
};
