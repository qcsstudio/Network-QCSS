import type { ToolkitOperation } from "./types";
import { analyzeVpn, vpnSample } from "./comparisons-vpn";
import { analyzeSdwan, sdwanSample } from "./comparisons-sdwan";

export { generateCaptureFilters } from "./comparisons-filters";
export type { CaptureFilterOptions, CaptureFilters } from "./comparisons-filters";

export const comparisonOperations: ToolkitOperation[] = [
  {
    id: "vpn",
    name: "Configured IKEv2 peer comparison",
    description: "Compare supplied IKE/ESP proposal alternatives and reversed traffic selectors. Missing evidence stays unknown; no tunnel-health verdict is inferred.",
    inputLabel: "Peer A / Peer B configured profiles (JSON; no secrets)",
    format: "Strict JSON: peerA and peerB; each may contain ikeVersion: 2, ikeProposals, childProposals, selectors, ikeLifetimeSeconds and childLifetimeSeconds. Proposals contain encryption[], optional integrity[], dhGroups[], IKE prf[] or CHILD esn[]. AES CBC and GCM16 use separate proposals. Selectors contain localCIDR, remoteCIDR, optional protocol (any/tcp/udp), localPorts and remotePorts ({start,end}). Missing fields stay unknown. At most 16 items per array and 131072 input characters. Sample is synthetic configured evidence.",
    sample: vpnSample,
    fields: [],
    analyze: analyzeVpn,
  },
  {
    id: "sdwan",
    name: "SD-WAN sample / requirement comparison",
    description: "Compare each entered latency, loss and jitter value to an explicit method- and window-specific requirement. No opaque score or path recommendation.",
    inputLabel: "Link samples and operator-defined thresholds (JSON)",
    format: "Strict JSON: thresholds for latencyMs, lossPct and jitterMs ({max, comparison: lt/lte, method, windowSeconds}); links[] with name and samples[]. Each sample needs origin: observed/user-entered; optional window {start,end} with ISO timestamps/timezones, sampleCount, target, vantagePoint and metric objects {value,method}. Missing evidence is unknown. Up to 16 links and 64 samples each; 131072 input characters. Samples are synthetic user-entered values, not measurements.",
    sample: sdwanSample,
    fields: [],
    analyze: analyzeSdwan,
  },
];
