export const codexImageProvider = "codex-built-in-imagegen";

export function editorialImageMode(value = process.env.EDITORIAL_IMAGE_MODE) {
  const mode = value?.trim() || "provider-api";
  if (mode !== "provider-api" && mode !== "codex-assisted") {
    throw new Error("EDITORIAL_IMAGE_MODE must be provider-api or codex-assisted; no image provider was called.");
  }
  return mode;
}

export function editorialImageAction(input: {
  mode: ReturnType<typeof editorialImageMode>;
  status: string;
  complete: boolean;
  provider: string | null;
  force: boolean;
}) {
  // Imported, reviewed Codex artwork is never a paid backfill candidate.
  if (input.status === "ready" && input.complete &&
    (!input.force || input.provider === codexImageProvider || input.mode === "codex-assisted")) return "preserve";
  return input.mode === "codex-assisted" ? "handoff" : "provider";
}
