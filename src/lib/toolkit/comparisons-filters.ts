import { z } from "zod";
import { ipLiteralSchema, parseIP } from "./comparisons-validation";

const captureSchema = z.strictObject({
  sourceIP: ipLiteralSchema.optional(),
  destinationIP: ipLiteralSchema.optional(),
  protocol: z.enum(["any", "tcp", "udp", "icmp", "icmp6"]),
  port: z.number().int().min(0).max(65535).optional(),
  direction: z.enum(["forward", "reverse", "both"]),
  ipFamily: z.enum(["any", "ipv4", "ipv6"]).optional(),
}).superRefine((options, ctx) => {
  if (options.port !== undefined && (options.protocol === "icmp" || options.protocol === "icmp6")) {
    ctx.addIssue({ code: "custom", message: "ICMP has no transport port." });
  }
});

export type CaptureFilterOptions = z.input<typeof captureSchema>;
export type CaptureFilters = { bpf: string; wireshark: string; caveats: string[]; sourceIds: string[] };

// Grammar references: https://www.wireshark.org/docs/man-pages/pcap-filter.html
// and https://www.wireshark.org/docs/man-pages/wireshark-filter.html (checked 2026-11-04).
/** Direction applies to the supplied endpoints; port matches either transport endpoint. */
export function generateCaptureFilters(options: CaptureFilterOptions): CaptureFilters {
  const result = captureSchema.safeParse(options);
  const message = "Invalid capture filter options. Supply literal IPs of one family, a supported protocol and direction, and an integer TCP/UDP port from 0 to 65535 when needed.";
  if (!result.success) throw new Error(message);
  const value = result.data;
  const source = value.sourceIP === undefined ? undefined : parseIP(value.sourceIP);
  const destination = value.destinationIP === undefined ? undefined : parseIP(value.destinationIP);
  const families = [source?.kind(), destination?.kind(), value.ipFamily === "any" ? undefined : value.ipFamily,
    value.protocol === "icmp" ? "ipv4" : value.protocol === "icmp6" ? "ipv6" : undefined].filter(Boolean);
  if (new Set(families).size > 1) throw new Error(message);
  const family = families[0];
  const displayFamily = family === "ipv6" ? "ipv6" : "ip";
  const bpf: string[] = [family === "ipv4" ? "ip" : family === "ipv6" ? "ip6" : "ip or ip6"];
  const wireshark: string[] = [family === "ipv4" ? "ip" : family === "ipv6" ? "ipv6" : "ip || ipv6"];
  if (value.protocol !== "any") {
    bpf.push(value.protocol);
    wireshark.push(value.protocol === "icmp6" ? "icmpv6" : value.protocol);
  }
  const endpointExpression = (reverse: boolean, display: boolean) => {
    const conditions: string[] = [];
    if (source) conditions.push(display ? `${displayFamily}.${reverse ? "dst" : "src"} == ${source.toString()}` : `${reverse ? "dst" : "src"} host ${source.toString()}`);
    if (destination) conditions.push(display ? `${displayFamily}.${reverse ? "src" : "dst"} == ${destination.toString()}` : `${reverse ? "src" : "dst"} host ${destination.toString()}`);
    return conditions.join(display ? " && " : " and ");
  };
  if (source || destination) {
    for (const display of [false, true]) {
      const expression = value.direction === "both"
        ? `(${endpointExpression(false, display)}) ${display ? "||" : "or"} (${endpointExpression(true, display)})`
        : endpointExpression(value.direction === "reverse", display);
      (display ? wireshark : bpf).push(expression);
    }
  }
  if (value.port !== undefined) {
    const protocols = value.protocol === "any" ? ["tcp", "udp"] : [value.protocol];
    bpf.push(protocols.map((protocol) => `${protocol} port ${value.port}`).join(" or "));
    wireshark.push(protocols.map((protocol) => `${protocol}.port == ${value.port}`).join(" || "));
  }
  return {
    bpf: bpf.map((part) => `(${part})`).join(" and "),
    wireshark: wireshark.map((part) => `(${part})`).join(" && "),
    caveats: [
      "With no endpoints, port or family restriction, protocol any matches IPv4 or IPv6 only, not ARP or other non-IP traffic. Omitted port adds no port condition; port 0 is a literal transport port.",
      "Direction is relative to the supplied source/destination endpoints, not capture-interface ingress/egress. Port matches either transport endpoint; protocol any with a port means TCP or UDP only.",
      "These are separate BPF capture and Wireshark display expressions, not translations of arbitrary filter text. No capture or network request is performed.",
      "BPF may omit non-initial fragments and packets with IPv6 extension headers; Wireshark dissection/reassembly and nested tunnels can match differently. Validate in the installed capture tool and inspect the capture point, link type, encapsulation and NAT context.",
    ],
    sourceIds: ["filters", "tcp"],
  };
}
