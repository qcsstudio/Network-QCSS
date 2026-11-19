export const publicPublisher = "QuantumCrafters Studio";

export const publicTechnicalScope =
  "This guide draws on the technical references cited above and explains their practical implications for network and security teams. Diagrams are illustrative. Check applicability against your device model, software release and environment before making changes; documentation-based guidance is not evidence of a completed appliance or laboratory test.";

export function publicSourceUrl(value: string): string {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return value;
    const sources = url.searchParams.getAll("utm_source");
    if (!sources.some((source) => source.toLowerCase() === "openai")) return value;
    url.searchParams.delete("utm_source");
    for (const source of sources) {
      if (source.toLowerCase() !== "openai") url.searchParams.append("utm_source", source);
    }
    return url.href;
  } catch {
    return value;
  }
}

// Preserve the original source record; change only the reader-facing workflow sentence.
export function fortigateReaderHtml(html: string): string {
  return html.replace(
    "Independent review applies to the exact public release artifacts and does not claim appliance execution.",
    "Documentation and browser checks do not establish appliance execution; complete the lab setup and validation prerequisites before practical exercises."
  );
}
