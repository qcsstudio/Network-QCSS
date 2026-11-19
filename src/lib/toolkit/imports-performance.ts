import { z } from "zod";
import type { ToolkitOperation } from "./types";
import { display, example, fail, integer, json, list, nonnegative, optionalRecord, record, result, safeAnalyze, unknown } from "./imports-common";

const measurementSchema = z.object({
  seconds: nonnegative.nullable(), start: nonnegative.nullable(), end: nonnegative.nullable(), bytes: integer.nullable(),
  bitsPerSecond: nonnegative.nullable(), sender: z.boolean().nullable(), omitted: z.boolean(),
  retransmits: integer.nullable(), jitter: nonnegative.nullable(), lost: integer.nullable(), packets: integer.nullable(),
  lossPercent: nonnegative.max(100).nullable(),
}).strict().superRefine((m, ctx) => {
  if (m.start !== null && m.end !== null && m.end < m.start || m.seconds === 0 && (m.bitsPerSecond ?? 0) > 0 ||
    m.lost !== null && m.packets !== null && m.lost > m.packets) ctx.addIssue({ code: "custom", message: "Inconsistent measurement" });
});
function measurement(raw: unknown) {
  const m = record(raw);
  if (!["seconds", "bytes", "bits_per_second", "retransmits", "jitter_ms", "lost_packets", "packets", "lost_percent"].some((key) => m[key] !== undefined && m[key] !== null)) fail("Aggregate contains no supported measurements.");
  return measurementSchema.parse({ seconds: m.seconds ?? null, start: m.start ?? null, end: m.end ?? null, bytes: m.bytes ?? null,
    bitsPerSecond: m.bits_per_second ?? null, sender: m.sender ?? null, omitted: m.omitted ?? false,
    retransmits: m.retransmits ?? null, jitter: m.jitter_ms ?? null, lost: m.lost_packets ?? null, packets: m.packets ?? null, lossPercent: m.lost_percent ?? null });
}

export const performanceOperation: ToolkitOperation = {
  id: "performance", name: "iperf3 throughput evidence", description: "Inspect TCP/UDP aggregate summaries and intervals with explicit units and endpoint roles.",
  inputLabel: "iperf3 -J JSON export", fields: [],
  format: '{"start":{"version":"iperf 3.17","test_start":{"protocol":"TCP","reverse":0}},"intervals":[{"sum":{"start":0,"end":1,"seconds":1,"bytes":125000,"bits_per_second":1000000,"omitted":false,"sender":true}}],"end":{"sum_sent":{"seconds":1,"bytes":125000,"bits_per_second":1000000},"sum_received":{"seconds":1,"bytes":125000,"bits_per_second":1000000}}}. UDP also supports end.sum, jitter_ms, lost_packets, packets, lost_percent. Numbers must be JSON numbers; missing/null metrics remain unavailable. iperf3 major 3, TCP/UDP, unidirectional aggregate sum only; no iperf2/text/streamed JSON/bidir.',
  sample: example({ start: { version: "iperf 3.17", test_start: { protocol: "TCP", reverse: 0 } }, intervals: [
    { sum: { start: 0, end: 1, seconds: 1, bytes: 1250000, bits_per_second: 10000000, retransmits: 0, omitted: false, sender: true } },
    { sum: { start: 1, end: 2, seconds: 1, bytes: 2500000, bits_per_second: 20000000, retransmits: 1, omitted: false, sender: true } },
  ], end: { sum_sent: { seconds: 2, bytes: 3750000, bits_per_second: 15000000, retransmits: 1, sender: true }, sum_received: { seconds: 2, bytes: 3500000, bits_per_second: 14000000, sender: false } } }),
  analyze: safeAnalyze((input) => {
    const root = record(json(input));
    const start = record(root.start);
    if (typeof start.version !== "string" || !/^iperf 3\.\d+(?:[.\w+-]*)$/.test(start.version)) fail("Unsupported version. This importer supports the iperf3 major-3 aggregate JSON profile only.");
    const failed = root.error !== undefined;
    if (failed) z.string().max(4096).parse(root.error);
    if (failed && start.test_start === undefined) {
      const out = result("Imported performance evidence", ["iperf"]);
      out.summary = "iperf3 reported a collection failure before a supported test profile was available. Throughput, protocol and endpoint roles are unavailable.";
      out.metrics = [{ label: "Collection", value: "failed", meaning: "Imported error indicator only. Raw error text is withheld." },
        { label: "Throughput", value: unknown, unit: "bit/s", meaning: "No supported typed test profile or rate is available; failure is not zero throughput." }];
      out.findings.push({ level: "review", title: "No typed test measurements", detail: "The report lacks test_start protocol metadata. Review the local collector; no throughput or protocol is inferred from incomplete fields." });
      out.caveats.push("Only the iperf3 version and collection-error presence were accepted. No raw error message, system information or untyped interval is reproduced.");
      return out;
    }
    const profile = record(start.test_start);
    const protocol = z.enum(["TCP", "UDP"]).parse(profile.protocol);
    const reverse = z.union([z.literal(0), z.literal(1)]).nullable().parse(profile.reverse ?? null);
    if (profile.bidir !== undefined && profile.bidir !== 0 && profile.bidir !== false) fail("Bidirectional iperf3 reports are unsupported; export a unidirectional test.");
    const end = optionalRecord(root.end);
    if (Object.keys(end).some((key) => key.includes("bidir"))) fail("Bidirectional summary aggregates are unsupported.");
    const measurements: { scope: string; role: string; data: ReturnType<typeof measurement> }[] = [];
    for (const [key, role] of [["sum_sent", "sender"], ["sum_received", "receiver"], ["sum", "unspecified"]]) {
      if (end[key] === undefined) continue;
      const data = measurement(end[key]);
      if (data.omitted) fail("An omitted final summary is unsupported.");
      if (role === "sender" && data.sender === false || role === "receiver" && data.sender === true) fail("Conflicting iperf3 endpoint role fields.");
      measurements.push({ scope: `summary.${key}`, role: role === "unspecified" ? data.sender === null ? "unspecified" : data.sender ? "sender" : "receiver" : role, data });
    }
    const intervals = root.intervals === undefined ? [] : list(root.intervals);
    intervals.forEach((raw, index) => {
      const interval = record(raw);
      if (interval.sum_bidir_reverse !== undefined) fail("Bidirectional interval aggregates are unsupported.");
      if (interval.sum === undefined) fail("Unsupported interval: aggregate sum is required; per-stream aggregation is not inferred.");
      const data = measurement(interval.sum);
      measurements.push({ scope: `interval.${index + 1}`, role: data.sender === null ? "unspecified" : data.sender ? "sender" : "receiver", data });
    });
    if (!measurements.length && !failed) fail("No supported iperf3 aggregate summaries or intervals found.");
    const out = result("Imported performance evidence", ["iperf"]);
    const summaries = measurements.filter((m) => m.scope.startsWith("summary"));
    out.summary = `${protocol} ${reverse === null ? "direction unspecified" : reverse ? "reverse" : "forward"} report: ${summaries.length} aggregate summaries and ${intervals.length} intervals. ${failed ? "Collection reported an error; observations may be partial." : "Import does not independently verify test completion."}`;
    for (const m of summaries) out.metrics.push({ label: `${m.scope} (${m.role}) throughput`, value: m.data.bitsPerSecond === null ? unknown : m.data.bitsPerSecond / 1_000_000, unit: "Mbit/s", meaning: "Reported bits_per_second divided by 1000000 (decimal megabits), not bytes, MiB/s, circuit capacity or a sum of both endpoint reports." });
    out.rows = measurements.map(({ scope, role, data: m }) => ({ scope, role, protocol, startSeconds: display(m.start), endSeconds: display(m.end), seconds: display(m.seconds), bytes: display(m.bytes), bitsPerSecond: display(m.bitsPerSecond),
      megabitsPerSecond: m.bitsPerSecond === null ? unknown : m.bitsPerSecond / 1_000_000, mebibytesPerSecond: m.bitsPerSecond === null ? unknown : m.bitsPerSecond / 8 / 1_048_576,
      omittedWarmup: m.omitted ? "yes" : "no", tcpRetransmits: protocol === "TCP" ? display(m.retransmits) : "not applicable",
      udpJitterMs: protocol === "UDP" ? display(m.jitter) : "not applicable", udpLostDatagrams: protocol === "UDP" ? display(m.lost) : "not applicable", udpDatagrams: protocol === "UDP" ? display(m.packets) : "not applicable",
      udpLossPercent: protocol === "UDP" ? m.packets === 0 ? unknown : display(m.lossPercent) : "not applicable" }));
    if (failed || !summaries.length) out.findings.push({ level: "review", title: "Incomplete test evidence", detail: "A collection error or missing final summary prevents a complete-test conclusion. Error text is withheld; available intervals are retained separately." });
    if (protocol === "UDP") out.findings.push({ level: "info", title: "Endpoint role matters", detail: "UDP delivery loss and jitter require receiver-side evidence. An unlabeled end.sum is not automatically called a receiver measurement. Zero packets makes loss percentage unavailable." });
    out.caveats.push("Supports the listed iperf3 JSON field profile, not every release or platform feature. Reverse means server-to-client; sender/receiver summaries describe data direction, not client/server identity.", "No active throughput test, endpoint capacity verdict or interval averaging. Omitted warm-up intervals stay labeled; endpoint summaries are not added together. Extra native fields are ignored.", "Jitter is iperf3 UDP jitter, not RTT standard deviation. Missing receiver evidence, CPU limits, socket buffers and test conditions remain unresolved.");
    return out;
  }),
};
