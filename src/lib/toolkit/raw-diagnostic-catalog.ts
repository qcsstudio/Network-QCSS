// Synthetic documentation-shaped examples. Keep parser code in the worker bundle.
export const diagnosticProfiles = [
  {
    id: "cisco-vlan", vendor: "cisco", family: "Cisco IOS / IOS XE", command: "show vlan brief",
    scope: "VLAN IDs, local status and listed ports from IOS / IOS XE brief tables. VLAN names are excluded; trunk membership is separate evidence.",
    sample: "show vlan brief\nVLAN Name                             Status    Ports\n---- -------------------------------- --------- -------------------------------\n1    default                          active    Gi1/0/1, Gi1/0/2\n10   EXAMPLE                          active    Gi1/0/3\n20   EXAMPLE_PAUSED                    suspend\n1002 fddi-default                     act/unsup"
  },
  {
    id: "cisco-trunk", vendor: "cisco", family: "Cisco IOS / IOS XE", command: "show interfaces trunk",
    scope: "Unwrapped trunk tables with separate allowed, active and STP-forwarding VLAN sets. Local evidence only; no remote-port or topology inference.",
    sample: "show interfaces trunk\nPort        Mode         Encapsulation  Status        Native vlan\nGi1/0/1     on           802.1q         trunking      1\nPort        Vlans allowed on trunk\nGi1/0/1     1,10,20-22\nPort        Vlans allowed and active in management domain\nGi1/0/1     1,10,20\nPort        Vlans in spanning tree forwarding state and not pruned\nGi1/0/1     1,10"
  },
  {
    id: "cisco-stp", vendor: "cisco", family: "Cisco IOS / IOS XE", command: "show spanning-tree",
    scope: "VLAN-based ieee/rstp Role/Sts tables with explicit root and bridge context. MST, NX-OS and unsupported layouts are not inferred.",
    sample: "show spanning-tree\nVLAN0010\n  Spanning tree enabled protocol rstp\n  Root ID    Priority    32778\n             Address     0200.0000.0010\n             This bridge is the root\n             Hello Time 2 sec Max Age 20 sec Forward Delay 15 sec\n  Bridge ID  Priority    32778 (priority 32768 sys-id-ext 10)\n             Address     0200.0000.0010\n             Hello Time 2 sec Max Age 20 sec Forward Delay 15 sec\n             Aging Time 300 sec\nInterface           Role Sts Cost      Prio.Nbr Type\n------------------- ---- --- --------- -------- --------------------------------\nGi1/0/1             Desg FWD 20000     128.1    P2p\nGi1/0/2             Desg FWD 20000     128.2    P2p Edge"
  },
  {
    id: "cisco-ospf", vendor: "cisco", family: "Cisco IOS / IOS XE", command: "show ip ospf neighbor",
    scope: "IPv4 OSPF neighbour table: ID, state, role, timer, address and interface. The table does not identify its process/area/VRF; no context is invented.",
    sample: "show ip ospf neighbor\nNeighbor ID     Pri   State           Dead Time   Address         Interface\n192.0.2.2         1   FULL/DR         00:00:32    198.51.100.2    GigabitEthernet1/0/1\n192.0.2.3         1   2WAY/DROTHER    00:00:34    198.51.100.3    GigabitEthernet1/0/1"
  },
  {
    id: "cisco-bgp", vendor: "cisco", family: "Cisco IOS / IOS XE", command: "show ip bgp summary",
    scope: "IPv4 BGP summary with router ID and local AS context. Numeric State/PfxRcd is an established session, including zero prefixes; other address families are not covered.",
    sample: "show ip bgp summary\nBGP router identifier 192.0.2.1, local AS number 4200000000\nBGP table version is 7, main routing table version 7\nNeighbor        V          AS MsgRcvd MsgSent TblVer InQ OutQ Up/Down State/PfxRcd\n192.0.2.2       4  4200000001      12      13      7   0    0 00:04:20 0\n192.0.2.3       4       64512       0       0      0   0    0 never Active"
  },
  {
    id: "fortigate-session-stat", vendor: "fortigate", family: "FortiGate / FortiOS", command: "diagnose sys session stat",
    scope: "Documented scalar session statistics and selected TCP state counts. Unknown counters remain unsupported; this is not a session inventory or capacity verdict.",
    sample: "diagnose sys session stat\nmisc info: session_count=42 setup_rate=3 exp_count=1 clash=0\nmemory_tension_drop=0 ephemeral=0/10000 removeable=0 ha_scan=0\nTCP sessions:\n24 in ESTABLISHED state\n2 in SYN_SENT state\n1 in CLOSE_WAIT state"
  },
  {
    id: "fortigate-flow", vendor: "fortigate", family: "FortiGate / FortiOS", command: "diagnose debug flow (existing trace)",
    scope: "Existing strict IPv4 packet anchors and selected policy/drop events. No diagnostic commands are run. Duplicate/restarted trace contexts are rejected; an allow does not prove delivery.",
    sample: 'id=65308 trace_id=10 func=print_pkt_detail line=6019 msg="vd-root:0 received a packet(proto=6, 192.0.2.10:50123->198.51.100.20:443) tun_id=0.0.0.0 from port1. flag [S], seq 100, ack 0, win 64240"\nid=65308 trace_id=10 func=fw_forward_handler line=1002 msg="Allowed by Policy-7:"\nid=65308 trace_id=11 func=print_pkt_detail line=6019 msg="vd-root:0 received a packet(proto=17, 192.0.2.11:53000->198.51.100.53:53) from port1."\nid=65308 trace_id=11 func=fw_forward_handler line=1002 msg="Denied by forward policy check (policy 0)"'
  },
  {
    id: "fortigate-ike", vendor: "fortigate", family: "FortiGate / FortiOS", command: "diagnose vpn ike gateway list",
    scope: "Explicit VDOM/tunnel blocks, IKE state and IPv4 endpoints. Key-bearing dumps are rejected; cookies/SPIs/serials are omitted. Phase 1 is not proof of protected application traffic.",
    sample: "diagnose vpn ike gateway list\nvd: root/0\nname: branch-a\nversion: 2\naddr: 192.0.2.1:500 -> 198.51.100.1:500\ntun_id: 198.51.100.1/::198.51.100.1\ndirection: initiator\nstatus: established 120-120s ago = 0ms\nvd: root/0\nname: branch-b\nversion: 1\naddr: 192.0.2.1:500 -> 203.0.113.1:500\ndirection: responder\nstatus: connecting, state 3, started 15s ago"
  }
] as const;
