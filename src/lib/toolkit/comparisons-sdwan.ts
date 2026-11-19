import { z } from "zod";
import type { ToolkitOptions, ToolkitResult } from "./types";
import { parseComparison, requireEmptyComparisonOptions, shortText } from "./comparisons-validation";

const delay = z.number().min(0).max(604_800_000);
const loss = z.number().min(0).max(100);
const duration = z.number().positive().max(604_800);
const threshold = (value: z.ZodNumber) => z.strictObject({
  max: value,
  comparison: z.enum(["lt", "lte"]),
  method: shortText,
  windowSeconds: duration,
});
const measurement = (value: z.ZodNumber) => z.strictObject({
  value: value.nullable().optional(),
  method: shortText.optional(),
});
const windowSchema = z.strictObject({
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
}).refine((window) => {
  const seconds = (Date.parse(window.end) - Date.parse(window.start)) / 1000;
  return seconds > 0 && seconds <= 604_800;
});
const sampleSchema = z.strictObject({
  origin: z.enum(["observed", "user-entered"]),
  window: windowSchema.optional(),
  sampleCount: z.number().int().positive().max(1_000_000_000).optional(),
  target: shortText.optional(),
  vantagePoint: shortText.optional(),
  latencyMs: measurement(delay).optional(),
  lossPct: measurement(loss).optional(),
  jitterMs: measurement(delay).optional(),
});
const sdwanSchema = z.strictObject({
  thresholds: z.strictObject({ latencyMs: threshold(delay), lossPct: threshold(loss), jitterMs: threshold(delay) }),
  links: z.array(z.strictObject({ name: shortText, samples: z.array(sampleSchema).min(1).max(64) })).min(1).max(16),
});
const definitions = [
  { key: "latencyMs", label: "Latency", unit: "ms", meaning: "Elapsed packet/probe delay using the named measurement method. Round-trip time is not one-way delay." },
  { key: "lossPct", label: "Loss", unit: "%", meaning: "The proportion of expected test packets or responses missing in this window, according to the named method. Probe loss is not automatically application loss." },
  { key: "jitterMs", label: "Jitter", unit: "ms", meaning: "Variation in packet delay computed by the named algorithm. RTT standard deviation and UDP delay variation are not interchangeable." },
] as const;

export function analyzeSdwan(input: string, options: ToolkitOptions = {}): ToolkitResult {
  requireEmptyComparisonOptions(options, "SD-WAN");
  const value = parseComparison(input, sdwanSchema, "SD-WAN comparison");
  const rows: ToolkitResult["rows"] = [];
  let observed = 0, entered = 0, within = 0, outside = 0, unknown = 0, incomparable = 0;
  value.links.forEach((link, linkIndex) => link.samples.forEach((sample, sampleIndex) => {
    if (sample.origin === "observed") observed++; else entered++;
    const windowSeconds = sample.window ? (Date.parse(sample.window.end) - Date.parse(sample.window.start)) / 1000 : undefined;
    for (const definition of definitions) {
      const measured = sample[definition.key];
      const requirement = value.thresholds[definition.key];
      let status: string;
      let detail: string;
      if (measured?.value === undefined || measured.value === null || !measured.method || windowSeconds === undefined) {
        status = "unknown";
        detail = "Value, measurement method and an explicit observation window are all required. Missing is not zero.";
        unknown++;
      } else if (measured.method !== requirement.method || Math.abs(windowSeconds - requirement.windowSeconds) > 0.000001) {
        status = "not comparable";
        detail = "The stated method or window duration does not match this requirement. No metric conversion or normalization is assumed.";
        incomparable++;
      } else {
        const passes = requirement.comparison === "lt" ? measured.value < requirement.max : measured.value <= requirement.max;
        status = passes ? "within entered limit" : "outside entered limit";
        detail = "Comparison of this supplied sample with an operator-entered limit only; not routing eligibility or an independently verified SLA verdict.";
        if (passes) within++; else outside++;
      }
      rows.push({
        Link: link.name, LinkIndex: linkIndex + 1, Sample: sampleIndex + 1,
        Origin: sample.origin === "observed" ? "observed (user-declared import)" : "user-entered (not measured here)",
        Metric: definition.label, Value: measured?.value ?? "unknown", Unit: definition.unit,
        Method: measured?.method ?? "unknown", WindowStart: sample.window?.start ?? "unknown", WindowEnd: sample.window?.end ?? "unknown",
        WindowSeconds: windowSeconds ?? "unknown", SampleCount: sample.sampleCount ?? "unknown",
        Target: sample.target ?? "unknown", VantagePoint: sample.vantagePoint ?? "unknown",
        Requirement: `${requirement.comparison === "lt" ? "<" : "<="} ${requirement.max} ${definition.unit}`,
        RequiredMethod: requirement.method, RequiredWindowSeconds: requirement.windowSeconds,
        Comparison: status, Meaning: definition.meaning, Detail: detail,
      });
    }
  }));
  return {
    title: "Entered SD-WAN link evidence comparison",
    summary: `${observed} user-declared observed and ${entered} user-entered samples. Per metric: ${within} within entered limits, ${outside} outside, ${unknown} unknown and ${incomparable} not comparable. No path is selected.`,
    evidence: "imported",
    metrics: [
      ...definitions.map((definition) => ({ label: `${definition.label} requirement`, value: `${value.thresholds[definition.key].comparison === "lt" ? "<" : "<="} ${value.thresholds[definition.key].max}`, unit: definition.unit, meaning: `${definition.meaning} This limit is operator-defined, not a vendor default or universal recommendation.` })),
      { label: "User-declared observed samples", value: observed, unit: "samples", meaning: "Imported records labelled observed by the user; this browser does not collect or independently verify them." },
      { label: "User-entered samples", value: entered, unit: "samples", meaning: "Manually supplied examples or values, not measurements made by this tool." },
    ],
    rows,
    findings: [
      { level: outside ? "review" : "info", title: `${outside} metric comparisons outside entered limits`, detail: "See the metric, sample index, value, operator and requirement on each row. No combined score or overall link-health verdict is calculated." },
      { level: unknown || incomparable ? "review" : "info", title: `${unknown} unknown; ${incomparable} not comparable`, detail: "Missing values/methods/windows remain unknown. Different methods or durations cannot be silently compared; method labels must match exactly." },
      { level: "info", title: "Routing policy and failover remain unknown", detail: "Health-check samples alone do not establish path choice, fail/recovery counters, hysteresis, application reachability, capacity or failover timing." },
    ],
    caveats: [
      "All thresholds, measurement methods and values are provided by the user. No device probe, network request, traffic test or storage write is performed.",
      "Methods are exact user-declared identifiers, not verified algorithms. Different jitter definitions, loss denominators, directions, probe protocols, targets and vantage points need separate requirements.",
      "A threshold specifies its own window duration and explicit < or <= boundary. A matching duration does not prove synchronized windows across links. No time-series interpolation, aggregation, percentile invention or ranking is performed.",
      "A zero value is retained. Missing/null values are unknown, not a successful measurement; missing sample counts and collection quality limit interpretation even where a numeric comparison is possible.",
      "ICMP response filtering/rate limiting may differ from forwarded application traffic. iperf UDP loss/jitter and probe loss/RTT are different evidence. A reachable health target does not establish business-service health.",
      "Fortinet SLA documentation is marked blocked in the source register. These are generic operator-entered comparisons, not FortiOS defaults, vendor SLA state or a failover simulation.",
      "Supported limits: 16 links, 64 samples per link, windows up to seven days; delays 0 to 604800000 ms, loss 0 to 100%. Samples are not silently truncated.",
    ],
    sourceIds: ["forti-sla", "mtr", "iperf"],
  };
}

const window = { start: "2026-11-04T00:00:00Z", end: "2026-11-04T00:01:00Z" };
export const sdwanSample = JSON.stringify({
  thresholds: {
    latencyMs: { max: 100, comparison: "lte", method: "icmp-rtt-mean", windowSeconds: 60 },
    lossPct: { max: 1, comparison: "lt", method: "icmp-response-loss-percent", windowSeconds: 60 },
    jitterMs: { max: 20, comparison: "lte", method: "iperf3-udp-jitter", windowSeconds: 60 },
  },
  links: [
    { name: "Synthetic WAN A", samples: [{ origin: "user-entered", window, sampleCount: 60, target: "192.0.2.10", vantagePoint: "Synthetic branch collector", latencyMs: { value: 42, method: "icmp-rtt-mean" }, lossPct: { value: 0, method: "icmp-response-loss-percent" }, jitterMs: { value: 3.2, method: "iperf3-udp-jitter" } }] },
    { name: "Synthetic WAN B", samples: [{ origin: "user-entered", window, sampleCount: 60, target: "192.0.2.10", vantagePoint: "Synthetic branch collector", latencyMs: { value: 100, method: "icmp-rtt-mean" }, lossPct: { value: 1, method: "icmp-response-loss-percent" }, jitterMs: { value: 21, method: "iperf3-udp-jitter" } }] },
  ],
}, null, 2);
