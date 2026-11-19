import { z } from "zod";
import type { ToolkitOperation } from "./types";
import { display, example, fail, integer, json, list, nullableNumber, num, optionalRecord, record, result, safeAnalyze, text, unknown } from "./imports-common";

const scalar = (value: unknown): unknown => {
  if (!Array.isArray(value)) return value;
  if (value.length !== 1) fail("Repeated packet fields are unsupported. Export one outer network/transport layer per packet.");
  return value[0];
};
function field(tree: Record<string, unknown>, key: string): unknown {
  const values: unknown[] = [];
  const stack = [tree];
  while (stack.length) {
    const item = stack.pop()!;
    if (Object.hasOwn(item, key)) values.push(scalar(item[key]));
    for (const [name, value] of Object.entries(item)) {
      if (name !== key && value && typeof value === "object" && !Array.isArray(value)) stack.push(record(value));
    }
  }
  if (values.length > 1) fail("Ambiguous repeated packet field. Export a single supported layer.");
  return values[0];
}
const packetSchema = z.object({
  index: integer, frame: integer.min(1), epoch: nullableNumber, bytes: integer.max(4_294_967_295).nullable(), captured: integer.max(4_294_967_295).nullable(),
  source: z.union([z.ipv4(), z.ipv6()]).nullable(), destination: z.union([z.ipv4(), z.ipv6()]).nullable(),
  protocol: z.enum(["TCP", "UDP", "other"]), sourcePort: integer.max(65535).nullable(), destinationPort: integer.max(65535).nullable(),
  retransmission: z.boolean(), zeroWindow: z.boolean(),
}).strict();

export const packetOperation: ToolkitOperation = {
  id: "packet", name: "TShark packet evidence", description: "Inspect supported decoded frame, address, transport and TCP analysis fields.",
  inputLabel: "TShark -T json export (not PCAP)", fields: [],
  format: 'JSON array from tshark -T json: [{"_source":{"layers":{"frame":{"frame.number":"1","frame.time_epoch":"1.25","frame.len":"60","frame.cap_len":"60"},"ip":{"ip.src":"192.0.2.1","ip.dst":"198.51.100.1"},"tcp":{"tcp.srcport":"50000","tcp.dstport":"443"}}}}]. Supports ip/ipv6, tcp/udp and nested tcp.analysis.retransmission/fast_retransmission/spurious_retransmission/zero_window flags. Scalar strings or one-item arrays only; other fields ignored. Duplicate object keys, including escaped equivalents, are rejected. If the installed TShark supports --no-duplicate-keys, use it with -T json; repeated layers or multi-valued supported fields are still unsupported. No binary capture or -T ek support.',
  sample: example([
    { _source: { layers: { frame: { "frame.number": "1", "frame.time_epoch": "1793786400.125", "frame.len": "60", "frame.cap_len": "60" }, ip: { "ip.src": "192.0.2.10", "ip.dst": "198.51.100.20" }, tcp: { "tcp.srcport": "51000", "tcp.dstport": "443" } } } },
    { _source: { layers: { frame: { "frame.number": "2", "frame.time_epoch": "1793786400.325", "frame.len": "100", "frame.cap_len": "80" }, ip: { "ip.src": "192.0.2.10", "ip.dst": "198.51.100.20" }, tcp: { "tcp.srcport": "51000", "tcp.dstport": "443", "tcp.analysis": { "tcp.analysis.flags": { "tcp.analysis.retransmission": "" } } } } } },
  ]),
  analyze: safeAnalyze((input) => {
    const packets = list(json(input));
    if (!packets.length) fail("No packets in this export.");
    const normalized = packets.map((raw, index) => {
      const layers = record(record(record(raw)._source).layers);
      const frame = record(layers.frame);
      if (layers.ip && layers.ipv6 || layers.tcp && layers.udp) fail("Multiple network or transport layers are unsupported.");
      const family = layers.ip ? "ip" : "ipv6";
      const network = optionalRecord(layers[family]);
      const protocol = layers.tcp ? "TCP" : layers.udp ? "UDP" : "other";
      const transport = optionalRecord(layers[protocol.toLowerCase()]);
      const port = (key: string) => num(field(transport, `${protocol.toLowerCase()}.${key}`));
      const flag = (name: string) => {
        const value = field(transport, `tcp.analysis.${name}`);
        if (value === undefined) return false;
        if (!["", "1", "0", true, false, 0, 1].includes(value as string)) fail("Unsupported TShark analysis flag representation.");
        return value === "" || value === "1" || value === true || value === 1;
      };
      const item = packetSchema.parse({ index: index + 1, frame: num(scalar(frame["frame.number"])), epoch: num(scalar(frame["frame.time_epoch"])),
        bytes: num(scalar(frame["frame.len"])), captured: num(scalar(frame["frame.cap_len"])),
        source: scalar(network[`${family}.src`]) ?? null, destination: scalar(network[`${family}.dst`]) ?? null,
        protocol, sourcePort: port("srcport"), destinationPort: port("dstport"),
        retransmission: ["retransmission", "fast_retransmission", "spurious_retransmission"].some(flag), zeroWindow: flag("zero_window") });
      if (item.bytes !== null && item.captured !== null && item.captured > item.bytes) fail("Captured length exceeds original frame length.");
      return item;
    });
    const out = result("Imported packet evidence", ["tcp", "filters"]);
    const retransmissions = normalized.filter((p) => p.retransmission).length;
    const truncated = normalized.filter((p) => p.bytes !== null && p.captured !== null && p.captured < p.bytes).length;
    out.summary = `${normalized.length} decoded frames; ${retransmissions} marked by TShark as suspected retransmissions; ${truncated} known truncated frames.`;
    out.metrics = [
      { label: "Frames", value: normalized.length, meaning: "Records in this export, not total packets on the network." },
      { label: "Suspected retransmissions", value: retransmissions, unit: "frames", meaning: "Frames carrying a supported TShark analysis flag; not a loss measurement." },
      { label: "Known original bytes", value: normalized.some((p) => p.bytes !== null) ? normalized.reduce((sum, p) => sum + (p.bytes ?? 0), 0) : unknown, unit: "bytes", meaning: "Sum of available frame.len fields only; excludes unknown lengths. Unavailable when every length is missing." },
      { label: "Unknown lengths", value: normalized.filter((p) => p.bytes === null).length, unit: "frames", meaning: "Missing length is not a zero-byte frame." },
    ];
    out.rows = normalized.map((p) => ({ record: p.index, frame: p.frame, epochSeconds: display(p.epoch), source: display(p.source), sourcePort: display(p.sourcePort), destination: display(p.destination), destinationPort: display(p.destinationPort), transport: p.protocol, originalBytes: display(p.bytes), capturedBytes: display(p.captured), retransmission: p.retransmission ? "TShark flagged" : "not flagged / analysis coverage unknown", zeroWindow: p.zeroWindow ? "TShark flagged" : "not flagged / analysis coverage unknown" }));
    if (retransmissions || truncated) out.findings.push({ level: "review", title: "Capture interpretation needs context", detail: "Retransmission flags and truncation can reflect capture quality, reordering or duplicate capture. They do not locate packet loss or prove a firewall fault." });
    out.caveats.push("Duplicate JSON object keys are rejected before object parsing, including escaped key spellings. Native JSON.parse handles supported values; this is not a PCAP dissector. No payload, stream reconstruction, decryption or handshake inference. Unknown protocol layers are not analyzed.", "Missing flags do not prove absence; TCP analysis preferences, capture direction, drops, timestamps and capture point are not verified. Additional export fields are ignored.");
    return out;
  }),
};

const hopSchema = z.object({ hop: integer.min(1).max(255), host: text, sent: integer.nullable(), loss: nullableNumber.refine((n) => n === null || n <= 100),
  last: nullableNumber, average: nullableNumber, best: nullableNumber, worst: nullableNumber, stdev: nullableNumber }).strict();
export const pathOperation: ToolkitOperation = {
  id: "path", name: "MTR path evidence", description: "Review reported hop response loss and round-trip summaries without inferring a failed router.",
  inputLabel: "MTR --json report", fields: [],
  format: '{"report":{"mtr":{"dst":"198.51.100.20"},"hubs":[{"count":1,"host":"192.0.2.1","Loss%":0,"Snt":10,"Last":1,"Avg":1,"Best":0,"Wrst":2,"StDev":0}]}}. count and host required; listed measurements may be absent/null. Numeric values or decimal strings; RTT in ms, Loss% in percent. Extra MTR metadata ignored; text traceroute unsupported.',
  sample: example({ report: { mtr: { dst: "198.51.100.20", src: "192.0.2.10" }, hubs: [
    { count: 1, host: "192.0.2.1", "Loss%": 30, Snt: 10, Last: 2, Avg: 2, Best: 1, Wrst: 3, StDev: 0.5 },
    { count: 2, host: "???", "Loss%": 100, Snt: 10, Last: 0, Avg: 0, Best: 0, Wrst: 0, StDev: 0 },
    { count: 3, host: "198.51.100.20", "Loss%": 0, Snt: 10, Last: 12, Avg: 12, Best: 10, Wrst: 15, StDev: 1 },
  ] } }),
  analyze: safeAnalyze((input) => {
    const report = record(record(json(input)).report);
    const hops = list(report.hubs).map((raw) => {
      const h = record(raw);
      return hopSchema.parse({ hop: num(h.count), host: h.host, sent: num(h.Snt), loss: num(h["Loss%"]), last: num(h.Last), average: num(h.Avg), best: num(h.Best), worst: num(h.Wrst), stdev: num(h.StDev) });
    });
    if (!hops.length) fail("No hops in this MTR report.");
    if (new Set(hops.map((h) => h.hop)).size !== hops.length) fail("Duplicate hop counts are unsupported.");
    const out = result("Imported path evidence", ["mtr"]);
    const responsive = (h: typeof hops[number]) => !["???", "*", "unknown"].includes(h.host.toLowerCase()) && h.sent !== 0 && h.loss !== 100;
    out.rows = hops.map((h) => ({ hop: h.hop, responder: h.host, probesSent: display(h.sent), responseLossPercent: h.sent === 0 ? unknown : display(h.loss),
      responseState: h.sent === 0 ? "no probes sent" : responsive(h) ? "responder reported" : "no response reported", averageRttMs: responsive(h) ? display(h.average) : unknown, lastRttMs: responsive(h) ? display(h.last) : unknown,
      bestRttMs: responsive(h) ? display(h.best) : unknown, worstRttMs: responsive(h) ? display(h.worst) : unknown, rttStdevMs: responsive(h) ? display(h.stdev) : unknown }));
    const last = [...hops].sort((a, b) => a.hop - b.hop).at(-1)!;
    out.summary = `${hops.length} reported hops; ${hops.filter((h) => !responsive(h)).length} have no reported response or no probes. Intermediate response loss is not an application-loss conclusion.`;
    out.metrics = [{ label: "Last reported hop response loss", value: last.sent === 0 ? unknown : display(last.loss), unit: "%", meaning: "The final reported hop, not necessarily the destination; unanswered probes are not application packet loss." },
      { label: "Last reported hop average RTT", value: responsive(last) ? display(last.average) : unknown, unit: "ms", meaning: "Imported round-trip mean. No response placeholders are not zero-millisecond measurements." }];
    out.findings.push({ level: "info", title: "Intermediate loss does not locate a fault", detail: "ICMP response filtering and rate limits can affect a hop while later hops still respond. Compare the destination, probe protocol, observation window and application evidence." });
    out.caveats.push("MTR --json hubs only; no live traceroute, destination reachability certification, inferred topology, percentiles or one-way jitter. Additional metadata is ignored.", "A null/missing measurement remains unavailable. For no-response or zero-sent hops, zero RTT placeholders are unavailable. A genuine reported zero RTT at a responding hop is preserved.");
    return out;
  }),
};
