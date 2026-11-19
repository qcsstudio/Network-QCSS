import { z } from "zod";
import type { ToolkitOperation } from "./types";
import { display, example, fail, integer, json, MAX_RECORDS, result, safeAnalyze, text, timestamp, unknown } from "./imports-common";

const domain = z.string().min(1).max(254).regex(/^(?:[a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?\.)*[a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?\.?$/);
const rrtype = z.enum(["A", "AAAA", "CNAME", "NS", "PTR", "TXT"]);
const dnsRecord = z.object({ name: domain, type: rrtype, value: text, ttl: integer.max(4_294_967_295) }).strict().superRefine((r, ctx) => {
  const schema = r.type === "A" ? z.ipv4() : r.type === "AAAA" ? z.ipv6() : r.type === "TXT" ? text : domain;
  if (!schema.safeParse(r.value).success) ctx.addIssue({ code: "custom", message: "Invalid record value" });
});
const question = z.object({ name: domain, type: rrtype }).strict();
const observationBase = { resolver: z.string().min(1).max(253), question, observedAt: timestamp };
const observation = z.discriminatedUnion("state", [
  z.object({ ...observationBase, state: z.literal("response"), rcode: z.enum(["NOERROR", "NXDOMAIN", "SERVFAIL", "REFUSED", "FORMERR", "NOTIMP"]), records: z.array(dnsRecord).max(500) }).strict(),
  z.object({ ...observationBase, state: z.literal("error"), error: z.enum(["timeout", "network", "collection", "parse"]) }).strict(),
  z.object({ ...observationBase, state: z.literal("unavailable"), reason: z.enum(["not-collected", "unsupported", "cancelled"]) }).strict(),
]);
const dnsSchema = z.object({ schemaVersion: z.literal(1), observations: z.array(observation).min(1).max(200) }).strict();
const canonicalName = (name: string) => name.toLowerCase().replace(/\.$/, "");
function canonicalValue(type: z.infer<typeof rrtype>, value: string) {
  if (type === "AAAA") return new URL(`http://[${value}]/`).hostname;
  return ["CNAME", "NS", "PTR"].includes(type) ? canonicalName(value) : value;
}

export const dnsOperation: ToolkitOperation = {
  id: "dns", name: "Resolver observation comparison", description: "Compare successful imported DNS answers while separating collection and DNS errors.",
  inputLabel: "Versioned DNS observation JSON", fields: [],
  format: '{"schemaVersion":1,"observations":[{"resolver":"192.0.2.53","observedAt":"2026-11-04T10:00:00Z","question":{"name":"example.test","type":"A"},"state":"response","rcode":"NOERROR","records":[{"name":"example.test","type":"A","value":"192.0.2.10","ttl":0}]}]}. Strict keys. observedAt requires an ISO timestamp with Z/offset and at most 3 fractional-second digits; finer precision is rejected, not rounded. Types: A/AAAA/CNAME/NS/PTR/TXT; class IN only. response rcode: NOERROR/NXDOMAIN/SERVFAIL/REFUSED/FORMERR/NOTIMP. Other states replace rcode/records with state:error,error:timeout|network|collection|parse or state:unavailable,reason:not-collected|unsupported|cancelled. Non-NOERROR records must be empty; 200 observations, 500 records each, 2000 result rows total.',
  sample: example({ schemaVersion: 1, observations: [
    { resolver: "192.0.2.53", observedAt: "2026-11-04T10:00:00Z", question: { name: "example.test", type: "A" }, state: "response", rcode: "NOERROR", records: [{ name: "example.test", type: "A", value: "192.0.2.10", ttl: 0 }] },
    { resolver: "198.51.100.53", observedAt: "2026-11-04T10:00:01Z", question: { name: "example.test", type: "A" }, state: "error", error: "timeout" },
  ] }),
  analyze: safeAnalyze((input) => {
    const { observations } = dnsSchema.parse(json(input));
    const out = result("Imported DNS observations", ["dns"]);
    let usable = 0, failures = 0, unavailable = 0, recordCount = 0;
    const groups = new Map<string, Set<string>>();
    observations.forEach((o, index) => {
      const base = { observation: index + 1, resolver: o.resolver, observedAt: o.observedAt, question: `${o.question.name} ${o.question.type}` };
      if (o.state !== "response") {
        if (o.state === "error") failures++; else unavailable++;
        out.rows.push({ ...base, state: o.state, rcode: unknown, name: unknown, type: unknown, value: unknown, ttlSeconds: unknown, detail: o.state === "error" ? o.error : o.reason });
        return;
      }
      if (o.rcode !== "NOERROR" && o.records.length) fail("This DNS profile requires empty records for non-NOERROR responses; negative CNAME chains are unsupported.");
      if (["NOERROR", "NXDOMAIN"].includes(o.rcode)) {
        usable++;
        const key = `${canonicalName(o.question.name)} ${o.question.type}`;
        const signatures = groups.get(key) ?? new Set<string>();
        const records = [...new Set(o.records.map((r) => JSON.stringify([canonicalName(r.name), r.type, canonicalValue(r.type, r.value)])))].sort();
        signatures.add(JSON.stringify([o.rcode, records]));
        groups.set(key, signatures);
      } else failures++;
      recordCount += o.records.length;
      const records = o.records.length ? o.records : [null];
      for (const r of records) out.rows.push({ ...base, state: "response", rcode: o.rcode, name: r?.name ?? unknown, type: r?.type ?? unknown, value: r?.value ?? unknown, ttlSeconds: r?.ttl ?? unknown,
        detail: r ? "imported answer record" : o.rcode === "NOERROR" ? "empty NOERROR answer; not NXDOMAIN" : o.rcode === "NXDOMAIN" ? "negative name response" : "DNS error response" });
      if (out.rows.length > MAX_RECORDS) fail("DNS output exceeds 2000 records. Import a smaller resolver observation set.");
    });
    const differences = [...groups.values()].filter((s) => s.size > 1).length;
    out.summary = usable === 0 ? "No usable NOERROR or NXDOMAIN responses. Resolver consistency is unavailable; matching failures are not agreement." : `${usable} usable responses, ${failures} failures and ${unavailable} unavailable observations; ${differences} question groups contain differing answers.`;
    out.metrics = [{ label: "Usable responses", value: usable, meaning: "NOERROR and NXDOMAIN responses; includes empty NOERROR, excludes collection errors and server failures." },
      { label: "Failures", value: failures, meaning: "Collection errors and DNS error response codes, not successful matching answers." },
      { label: "Unavailable observations", value: unavailable, meaning: "Not collected, unsupported or cancelled; not a failure response or absent record." },
      { label: "Answer records", value: recordCount, meaning: "Imported answer records, with TTL zero preserved." }];
    out.findings.push({ level: !usable || differences || failures ? "review" : "info", title: usable ? "Scoped answer comparison" : "Comparison unavailable", detail: usable ? "Comparison groups the same question only; ignores RR order, duplicate entries and TTL differences, normalizes DNS-name case and IPv6 address representation, and preserves CNAME records and response codes. One observation is not resolver agreement." : "Collect at least two usable observations for the same question before comparing answers. All failed or unavailable observations establish neither absence nor consistency." });
    out.caveats.push("Strict QCS schema v1, not raw dig/DoH/vendor JSON. Only the listed IN record types and answer section are supported; DNSSEC, authority, negative CNAME chains, MX/SOA/SRV and email policy are not evaluated.", "TTL is remaining cache lifetime in seconds, not a propagation countdown. Imported resolver labels and timestamps are not verified; no global propagation, DNSSEC validation or geographic conclusion.");
    return out;
  }),
};

const identifier = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_.:-]+$/);
const clockSchema = z.object({ source: identifier, offsetMs: z.number().int().min(-86_400_000).max(86_400_000).nullable(), quality: z.enum(["synchronized", "estimated", "unknown"]) }).strict()
  .refine((c) => c.quality === "unknown" ? c.offsetMs === null : c.offsetMs !== null);
const logSchema = z.object({ schemaVersion: z.literal(1), clocks: z.array(clockSchema).max(200), events: z.array(z.object({
  source: identifier, timestamp, severity: integer.max(7), message: z.string().max(4096),
  fields: z.record(z.string().min(1).max(64), z.union([z.string().max(4096), z.number().finite(), z.boolean(), z.null()])).optional(),
}).strict()).min(1).max(MAX_RECORDS) }).strict();
const sensitiveKey = /password|passwd|secret|token|cookie|authorization|api[-_]?key|private[-_]?key|credential|psk|community/i;
const severityNames = ["emergency", "alert", "critical", "error", "warning", "notice", "informational", "debug"];

export const logsOperation: ToolkitOperation = {
  id: "logs", name: "Redacted event timeline", description: "Order timestamped imported events with explicit clock correction and withheld message content.",
  inputLabel: "Versioned event JSON", fields: [],
  format: '{"schemaVersion":1,"clocks":[{"source":"edge-1","offsetMs":0,"quality":"synchronized"}],"events":[{"source":"edge-1","timestamp":"2026-11-04T10:00:00Z","severity":4,"message":"raw message","fields":{"token":"masked"}}]}. Strict keys; severity 0..7 (syslog), ISO timestamp with Z/offset required. At most 3 fractional-second digits; finer precision is rejected, not rounded. Clock quality synchronized|estimated requires integer offsetMs +/-86400000; unknown requires null. Positive offset means source clock ahead: corrected=timestamp-offset. Missing source clocks remain unknown. fields optional flat scalar object; values and messages are never displayed.',
  sample: example({ schemaVersion: 1, clocks: [{ source: "edge-1", offsetMs: 2000, quality: "estimated" }, { source: "collector-1", offsetMs: 0, quality: "synchronized" }], events: [
    { source: "edge-1", timestamp: "2026-11-04T10:00:02Z", severity: 4, message: "Synthetic event with token=EXAMPLE_ONLY", fields: { token: "EXAMPLE_ONLY", interface: "port1" } },
    { source: "collector-1", timestamp: "2026-11-04T10:00:01Z", severity: 6, message: "Synthetic collector observation" },
  ] }),
  analyze: safeAnalyze((input) => {
    const data = logSchema.parse(json(input));
    const clocks = new Map(data.clocks.map((c) => [c.source, c]));
    if (clocks.size !== data.clocks.length) fail("Duplicate clock sources are unsupported.");
    let masked = 0, uncertain = 0;
    const events = data.events.map((event, index) => {
      const clock = clocks.get(event.source);
      const offset = clock?.offsetMs ?? null;
      if (clock?.quality !== "synchronized") uncertain++;
      const sensitive = Object.keys(event.fields ?? {}).filter((key) => sensitiveKey.test(key)).length;
      masked += sensitive;
      const time = Date.parse(event.timestamp) - (offset ?? 0);
      return { time, row: { record: index + 1, source: event.source, originalTimestamp: event.timestamp, normalizedUtc: new Date(time).toISOString(), clockOffsetMs: display(offset), clockQuality: clock?.quality ?? "unknown", severity: event.severity, severityName: severityNames[event.severity],
        message: "[withheld]", knownSecretValues: sensitive ? `[REDACTED: ${sensitive} values]` : "none in known structured keys", otherStructuredValues: `[withheld: ${Object.keys(event.fields ?? {}).length - sensitive} values]` } };
    }).sort((a, b) => a.time - b.time || a.row.record - b.row.record);
    const out = result("Imported redacted event timeline", ["syslog"]);
    out.summary = `${events.length} events ordered by normalized timestamp; ${uncertain} use estimated or unknown clocks. All free-text messages and structured values are withheld.`;
    out.rows = events.map((e) => e.row);
    out.metrics = [{ label: "Events", value: events.length, meaning: "Input records retained, including duplicates; sorting preserves original record numbers." },
      { label: "Known secret values masked", value: masked, meaning: "Recognized sensitive structured key values are redacted. Other structured values and all messages are also withheld." },
      { label: "Uncertain clock events", value: uncertain, meaning: "Estimated or unknown synchronization; relative time order is not established fact." }];
    out.findings.push({ level: uncertain ? "review" : "info", title: "Ordering is not causation", detail: "Timezone offsets are normalized; declared clock offsets are subtracted. Unknown clocks receive no correction and remain labeled unknown. Clock quality is imported, not independently verified." });
    out.caveats.push("Strict normalized event schema v1 only; no raw RFC5424, legacy syslog, multiline vendor parser, inferred timezone, inferred year or automatic root cause. Timestamps with more than 3 fractional-second digits are rejected so sub-millisecond events cannot collapse or be misordered.", "Message content is withheld in every output, not regex-redacted and repeated. Known secret keys are counted without exposing names or values; this is not proof that the original input is secret-free.", "Source identifiers and timestamps remain visible. Review them before exporting. Duplicate events remain distinct; declared clock corrections do not prove synchronization.");
    return out;
  }),
};
