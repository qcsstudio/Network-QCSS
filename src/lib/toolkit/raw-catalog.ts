import { diagnosticProfiles } from "./raw-diagnostic-catalog";

export const rawProfiles = [
  {
    id: "cisco-ip-brief", vendor: "cisco", family: "Cisco IOS / IOS XE", command: "show ip interface brief",
    scope: "IPv4 interface summary; documented IOS / IOS XE column layout. Other Cisco operating systems are not covered.",
    sample: "Interface              IP-Address      OK? Method Status                Protocol\nGigabitEthernet0/0     192.0.2.1       YES manual up                    up\nGigabitEthernet0/1     unassigned      YES unset  administratively down down\nVlan20                 198.51.100.1    YES manual up                    down"
  },
  {
    id: "cisco-interfaces", vendor: "cisco", family: "Cisco IOS / IOS XE", command: "show interfaces",
    scope: "Interface state and selected numeric counters. Descriptions and other free text are excluded; a counter is not a root-cause diagnosis.",
    sample: "GigabitEthernet0/0 is up, line protocol is up\n  Hardware is iGbE, address is 0200.0000.0001 (bia 0200.0000.0001)\n  Internet address is 192.0.2.1/24\n  MTU 1500 bytes, BW 1000000 Kbit/sec, DLY 10 usec,\n     reliability 255/255, txload 1/255, rxload 1/255\n  Full-duplex, 1000Mb/s, media type is RJ45\n  Last clearing of \"show interface\" counters never\n  5 minute input rate 12000 bits/sec, 15 packets/sec\n  5 minute output rate 8000 bits/sec, 10 packets/sec\n     1200 packets input, 180000 bytes, 0 no buffer\n     4 input errors, 3 CRC, 0 frame, 0 overrun, 1 ignored\n     900 packets output, 135000 bytes, 0 underruns\n     0 output errors, 0 collisions, 0 interface resets"
  },
  {
    id: "cisco-route", vendor: "cisco", family: "Cisco IOS / IOS XE", command: "show ip route",
    scope: "IPv4 routing-table evidence only. Recursive, policy-based, VRF and forwarding decisions need separate evidence; unsupported rows remain explicit.",
    sample: "Codes: L - local, C - connected, S - static, R - RIP, B - BGP\nGateway of last resort is 192.0.2.254 to network 0.0.0.0\nS*    0.0.0.0/0 [1/0] via 192.0.2.254\nC     192.0.2.0/24 is directly connected, GigabitEthernet0/0\nL     192.0.2.1/32 is directly connected, GigabitEthernet0/0\nO     198.51.100.0/24 [110/20] via 192.0.2.2, 00:00:12, GigabitEthernet0/0"
  },
  {
    id: "fortigate-performance", vendor: "fortigate", family: "FortiGate / FortiOS", command: "get system performance status",
    scope: "CPU, memory and supported performance labels. Formats vary by model and release; missing measurements are not treated as zero.",
    sample: "CPU states: 5% user 2% system 0% nice 92% idle 0% iowait 0% irq 1% softirq\nMemory: 4000000k total, 1800000k used (45.0%), 2000000k free (50.0%), 200000k freeable (5.0%)\nAverage network usage: 120 / 80 kbps in 1 minute, 110 / 75 kbps in 10 minutes, 100 / 70 kbps in 30 minutes\nAverage sessions: 40 sessions in 1 minute, 35 sessions in 10 minutes, 30 sessions in 30 minutes\nUptime: 3 days, 4 hours, 20 minutes"
  },
  {
    id: "fortigate-route", vendor: "fortigate", family: "FortiGate / FortiOS", command: "get router info routing-table all",
    scope: "FortiOS IPv4 NAT-mode route-table layout. This is not FortiADC, FortiSwitch or a proof that traffic follows the displayed route.",
    sample: "Codes: K - kernel, C - connected, S - static, R - RIP, B - BGP\nRouting table for VRF=0\nS*      0.0.0.0/0 [10/0] via 192.0.2.254, wan1\nC       192.0.2.0/24 is directly connected, wan1\nC       198.51.100.0/24 is directly connected, internal"
  },
  {
    id: "fortigate-vpn", vendor: "fortigate", family: "FortiGate / FortiOS", command: "get vpn ipsec tunnel summary",
    scope: "IPv4 peer and selector/counter summary. Detailed tunnel/key dumps are not accepted. Up selectors do not prove application reachability.",
    sample: "'branch-a' 192.0.2.10:4500 selectors(total,up): 2/1 rx(pkt,err): 140/0 tx(pkt,err): 110/2\n'branch-b' 198.51.100.10:0 selectors(total,up): 1/1 rx(pkt,err): 50/0 tx(pkt,err): 60/0"
  },
  ...diagnosticProfiles
] as const;
export type RawProfileId = typeof rawProfiles[number]["id"];
export const rawInputLimit = 1024 * 1024;
const publicErrors = {
  size: "This command output exceeds the local 1 MiB or 20,000-line budget. Import one command snapshot; nothing was uploaded.",
  format: "This output does not match the selected command's supported format. Choose the correct device and command, and supply one complete snapshot without paging or truncation markers. Nothing was uploaded.",
  unsafe: "Control sequences, binary data, private keys and detailed key dumps are not supported. Use plain UTF-8 output from the selected read-only command. Nothing was uploaded."
};
export class RawOutputError extends Error {
  constructor(readonly code: keyof typeof publicErrors) { super(publicErrors[code]); }
}
export function rawErrorMessage(error: unknown): string | undefined {
  return error instanceof RawOutputError ? publicErrors[error.code] : undefined;
}
