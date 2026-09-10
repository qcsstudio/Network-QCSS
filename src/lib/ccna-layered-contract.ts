import type { CcnaLessonContent } from "./ccna-lesson-schema.ts";
import type { CcnaVisualStory } from "./ccna-visual-story.ts";
import { ccnaImageLicensingNote } from "./ccna-image-licensing.ts";
import { ccnaContentDigest } from "./ccna-generation-pipeline.ts";

const refs = {
  acl: "https://www.cisco.com/c/en/us/support/docs/security/ios-firewall/23602-confaccesslists.html",
  ping: "https://www.cisco.com/c/en/us/support/docs/ios-nx-os-software/ios-software-releases-121-mainline/12778-ping-traceroute.html",
  vpcs: "https://docs.gns3.com/docs/emulators/vpcs",
  setup: "https://docs.gns3.com/docs/getting-started/your-first-cisco-topology",
  switching: "https://docs.gns3.com/docs/using-gns3/advanced/hubs-and-switches",
  license: "https://developer.cisco.com/docs/modeling-labs/vm-images-for-cml-labs/",
  layers: "https://www.rfc-editor.org/rfc/rfc1122"
};

export const ccnaLayeredSources = [
  { label: "Cisco IPv4 access lists", url: refs.acl, supports: "Numbered and named ACL identification, interface attachment, filtering and safe removal." },
  { label: "Cisco ping troubleshooting", url: refs.ping, supports: "ICMP observations, interface state, ARP and access lists as possible causes of missing replies." },
  { label: "GNS3 VPCS console", url: refs.vpcs, supports: "Opening a virtual PC console, configuring an address and testing a remote address." },
  { label: "GNS3 Cisco topology setup", url: refs.setup, supports: "Installing an authorized router appliance, naming nodes and connecting router interfaces." },
  { label: "GNS3 Ethernet switch", url: refs.switching, supports: "Built-in Ethernet switch port settings; no Cisco IOS command console is required." },
  { label: "Cisco CML image licensing", url: refs.license, supports: "CML reference images are licensed for CML unless another license permits use elsewhere." },
  { label: "RFC 1122 Internet layers", url: refs.layers, supports: "Internet host link, IP and transport requirements and the limits of a layered model." }
];

export const ccnaLayeredPrelude: NonNullable<CcnaLessonContent["teachingPrelude"]> = {
  terms: [
    { term: "Layer and model", meaning: "A layer groups related communication jobs. The OSI model has seven layers; the four-layer TCP/IP model groups jobs differently. These are thinking tools, not seven separate boxes or a fault detector." },
    { term: "OSI and TCP/IP", meaning: "Open Systems Interconnection (OSI) describes physical, data link, network, transport, session, presentation and application jobs. This lesson uses four TCP/IP layers: link, internet, transport and application. Some teaching sources split link into physical and data link, giving five layers. These are grouping conventions, not different networks. TCP/IP means Transmission Control Protocol/Internet Protocol." },
    { term: "Frame and packet", meaning: "A frame carries data across one local link. An IP packet carries data toward an IP destination, inside a frame on Ethernet. A router reads the destination IP and builds a new outgoing frame; a switch forwards local frames." },
    { term: "Address and gateway", meaning: "An IP address identifies a network interface. A /24 prefix means a 255.255.255.0 mask; compare the first three numbers in this lab. A default gateway is the local router used to reach another network. A MAC address identifies an Ethernet interface on a local link." },
    { term: "Interface and segment", meaning: "An interface is a device connection such as GigabitEthernet0/0. A local Ethernet segment lets devices exchange frames without routing. Router separates the two IP networks in this lesson; its two interfaces need different network addresses." },
    { term: "VPCS and Console", meaning: "Virtual PC Simulator (VPCS) is GNS3's lightweight practice computer. A Console is its text-control window: right-click the node and choose Console. A prompt such as PC1> means it is ready. Type only the command, then press Enter. The built-in Switch has no IOS console." },
    { term: "Router command modes", meaning: "The router's prompt may use its configured hostname. A > prompt is user EXEC; enable opens privileged EXEC (#), which permits inspection and changes. configure terminal enters (config)#; interface selects (config-if)#. exit goes back one level; end returns to #. Never type the prompt." },
    { term: "Ping and ICMP", meaning: "Ping sends an Internet Control Message Protocol (ICMP) echo request and waits for an echo reply. ICMP belongs with IP at the TCP/IP internet layer, not TCP/UDP transport. A host is a network-connected computer. No reply means the exchange timed out, not proof of a failed layer. Host settings, filters and either path direction can affect it. A self-ping tests the local IP stack, not the peer path; a reply does not prove application health." },
    { term: "ARP and intermittent loss", meaning: "Address Resolution Protocol (ARP) finds a local Ethernet MAC address for an IPv4 next hop. An initial request can time out during discovery. Repeat the same peer test; intermittent loss can also reflect links, load or filtering. Persistent failure needs evidence, not a guess." },
    { term: "ACL number and name", meaning: "An access control list (ACL) is an ordered permit/deny rule list. In running-config, access-list 199 identifies a numbered list; ip access-list extended LAB_FILTER identifies a named list. An interface's ip access-group line shows its list and in/out direction. A rule's sequence number is not the ACL identifier." },
    { term: "Baseline and rollback", meaning: "A baseline records the known configuration, cabling and successful tests before a change. Running-config is active; startup-config is the saved boot configuration. Rollback returns only our changes to that recorded state. Copying startup-config into running-config merges settings; it is not a reliable rollback." },
    { term: "Filtering boundary", meaning: "This router ACL checks ICMP and IP addresses, not TCP/UDP port numbers or application health. permit ip any any allows other IPv4 packets after the specific deny; it is safe only for this disconnected practice example, not a production security policy." }
  ],
  explanation: "Use these definitions before the diagram, walkthrough or commands. First establish a working peer exchange, then change one known rule and compare observations. An analogy can help remember a job, but it is not literal forwarding behavior. Our checklist narrows possibilities; it does not prove a faulty layer from one symptom.",
  labBoundary: "Lab boundary: Use a disconnected, disposable GNS3 project with PC1, Switch, Router and PC2. No company network or Internet bridge is allowed. This IPv4/ICMP exercise does not test application, wireless or firewall-product behavior."
};

export function ccnaLayeredVisual(): CcnaVisualStory {
  return {
    conceptSelection: {
      candidates: [
        { name: "Packet Journey", scene: "Trace PC1 through Switch and Router to PC2, then follow the reply and mark the one controlled filter.", teachingValue: "Connect a real lab observation to layered reasoning without diagnosing by guesswork.", limitation: "An ICMP exchange does not demonstrate transport or application health." },
        { name: "Layer stack", scene: "Place OSI and TCP/IP job names alongside one another in a comparison chart.", teachingValue: "Compare how two models group the same communication jobs.", limitation: "A stack cannot show this lab's device connections or where the test is filtered." },
        { name: "Fault checklist", scene: "List interface status, local addressing, peer tests and filtering evidence in order.", teachingValue: "Help beginners collect evidence before deciding what to change.", limitation: "A list alone does not name all cable endpoints in the packet path." }
      ], selectedIndex: 0,
      selectionReason: "The complete Packet Journey matches the addressing table and every cable endpoint. Forward and return stages separate a successful exchange from a controlled filtering observation."
    },
    title: "Packet Journey", layout: "sequence",
    takeaway: "Trace the peer exchange and collect evidence. A missing reply does not identify a faulty layer by itself.",
    altText: "PC1 sends through Switch and Router to PC2; the reply follows the reverse path. The request path ends at PC2, not Router.",
    boundary: "This wired IPv4 lab tests an ICMP exchange and one router ACL. It omits wireless, Internet services and application traffic because they are outside this isolated path.",
    nodes: [
      { id: "pc1", kind: "computer", label: "PC1", detail: "Sends echo requests" },
      { id: "switch", kind: "switch", label: "Switch", detail: "Forwards local frames" },
      { id: "router", kind: "router", label: "Router", detail: "Routes IP packets" },
      { id: "pc2", kind: "computer", label: "PC2", detail: "Receives and replies" }
    ],
    connections: [{ id: "pc1-switch", from: "pc1", to: "switch" }, { id: "switch-router", from: "switch", to: "router" }, { id: "router-pc2", from: "router", to: "pc2" }],
    stages: [
      { title: "PC1 sends to PC2", explanation: "PC1 is 192.168.1.10/24. Switch forwards its local frame to Router at 192.168.1.1/24. Router sends a new frame from 192.168.2.1/24 to PC2 at 192.168.2.10/24.", activeNodes: ["pc1", "switch", "router", "pc2"], activeConnections: ["pc1-switch", "switch-router", "router-pc2"], direction: "forward", sourceUrls: [refs.layers] },
      { title: "PC2 replies to PC1", explanation: "PC2 uses gateway 192.168.2.1 to return through Router and Switch to PC1. Replies confirm this ICMP exchange, not a working website or every application.", activeNodes: ["pc1", "switch", "router", "pc2"], activeConnections: ["pc1-switch", "switch-router", "router-pc2"], direction: "reverse", sourceUrls: [refs.ping] },
      { title: "Check Router filtering", explanation: "The lab-only ACL 199 blocks PC1's echo request before Router forwards it to PC2. Check the matching rule counter, detach and delete only our ACL, then repeat the same peer test.", activeNodes: ["pc1", "switch", "router"], activeConnections: ["pc1-switch", "switch-router"], direction: "forward", sourceUrls: [refs.acl] }
    ]
  };
}

type Step = CcnaLessonContent["lab"]["steps"][number];
function step(title: string, instruction: string, pairs: [string, string][], expectedResult: string, why: string): Step {
  return { title, instruction, commands: pairs.map(([command]) => command), commandExplanations: pairs.map(([, explanation]) => explanation), expectedResult, why };
}
function consoleStep(node: "Router" | "PC1" | "PC2", title: string, instruction: string, pairs: [string, string][], expectedResult: string, why: string) {
  return step(title, `In the isolated project, right-click ${node} and choose Console before typing. ${instruction} Type one command per line and press Enter; do not type the prompt.`, pairs, expectedResult, why);
}

export function ccnaLayeredLab(): CcnaLessonContent["lab"] {
  return {
    title: "Locate a controlled ICMP fault with layered evidence",
    goal: "Build one working routed path, record a clean baseline, block only its test request with a temporary numbered ACL, and restore the identical peer test. Learn what each observation supports and what it cannot prove.",
    topology: "PC1 Ethernet0 -> Switch Ethernet0; Switch Ethernet1 -> Router GigabitEthernet0/0 (LAN1); Router GigabitEthernet0/1 (LAN2) -> PC2 Ethernet0. There is no Internet or company-network connection. Map actual router port names before configuration; Packet Journey is the diagram title, not a fifth device.",
    devices: ["PC1: built-in GNS3 VPCS", "Switch: built-in GNS3 Ethernet switch, default access ports", "Router: legally usable Cisco IOS/IOS XE router appliance with two routed Ethernet interfaces and IPv4 ACL support", "PC2: built-in GNS3 VPCS"],
    addressing: [
      { device: "PC1", interface: "Ethernet0", address: "192.168.1.10/24", purpose: "Source; default gateway 192.168.1.1" },
      { device: "Router", interface: "GigabitEthernet0/0 (LAN1)", address: "192.168.1.1/24", purpose: "Router port cabled to Switch; map the observed name" },
      { device: "Router", interface: "GigabitEthernet0/1 (LAN2)", address: "192.168.2.1/24", purpose: "Router port cabled to PC2; map the observed name" },
      { device: "PC2", interface: "Ethernet0", address: "192.168.2.10/24", purpose: "Destination; default gateway 192.168.2.1" }
    ],
    setup: [
      "Complete the start-here guide and recap Day 2's console and gateway concepts. Use a new disconnected project. Keep any existing project untouched. For Windows notes, click Start, type Notepad, press Enter, and click New tab. Type a heading, press Ctrl+Shift+S, choose Documents, enter Day4-baseline.txt, then click Save. Keep this window open; click below existing notes, paste copied console output, and press Ctrl+S after each addition. A dated paper notebook is an alternative.",
      "Install a router appliance using GNS3's official Cisco topology instructions and only an image whose applicable license permits GNS3 use. Ensure it offers two routed Ethernet ports and IPv4 extended ACLs. If no legal image is available, trace the documented steps on paper; do not claim an executed routed test. CML is a separately configured official alternative.",
      "Drag two VPCS nodes and one built-in Ethernet switch into the project, add the authorized router template and rename the nodes exactly PC1, Switch, Router and PC2. Select Add a link, then each device and named port from the connection plan. Start all nodes. Switch uses default access ports and has no IOS console.",
      "In show ip interface brief, map the port wired to Switch as LAN1 and the port wired to PC2 as LAN2. Example: if the router shows GigabitEthernet0/0/0 and GigabitEthernet0/0/1, use those instead of GigabitEthernet0/0 and GigabitEthernet0/1 in EVERY command, including ACL removal. Record that two-row mapping beside the address table.",
      "If either expected port is absent, stop. Check the correct console and template in GNS3, stop Router before changing its adapter settings, select two supported Ethernet adapters, reconnect and restart. Re-run the inventory and record actual names; never guess an interface name or paste a placeholder.",
      "Router may show Router> or a different hostname; enable reaches #. If prompted for a password, use only your authorized lab credential. Decline an initial configuration dialog for this new practice router. PC1> and PC2> are VPCS prompts, not IOS. At --More-- press Space to read the remaining output. Keep consoles open for comparison."
    ],
    steps: [
      step("Isolate and record the connection plan", "Create the new disposable project and connect the four named devices using the topology above. Keep Cloud, NAT and real network adapters out. Create Day4-baseline.txt using the setup instructions, or use a notebook. Record the cable endpoints. In Step 2, match each router port to show ip interface brief and record LAN1 and LAN2 before any router configuration. To copy output, drag over its text in the console and use that console's Copy menu; paste into your notes and save.", [], "Four started nodes and exactly three links match the plan. Your existing projects are unchanged, and baseline notes identify this working copy.", "Isolation and an explicit record prevent an educational filter from changing a real service or an unrelated project."),
      consoleStep("Router", "Inspect and record the untouched router", "Start at > or #. Copy the complete output to Day4-baseline.txt. Require two unused routed ports, no existing ip access-group on either, and no ACL 199 anywhere. If any pre-existing setting is present, stop and choose a clean disposable router; do not remove or replace it.", [
        ["enable", "Enter privileged EXEC on this lab Router so the baseline can include its active configuration."],
        ["show ip interface brief", "List actual router interface names, assigned IPv4 addresses and link status; use this output to map LAN1 and LAN2."],
        ["show running-config", "Read the complete active configuration. Record interface blocks and all ACL references before making any change."],
        ["show access-lists", "List existing ACL identifiers and rules. A numbered list uses an identifier such as 199, not a rule sequence number."]
      ], "Your baseline shows no ACL 199 and no ACL attachment or existing IP address on the two selected ports. If it does not, stop without changing that router.", "A numbered ACL can be shared by other features. Confirm it is absent everywhere before reserving 199 for this exercise."),
      consoleStep("Router", "Configure the two mapped router ports", "Use the exact interface mapping from your notes. These full commands assume LAN1 is GigabitEthernet0/0 and LAN2 is GigabitEthernet0/1. no shutdown enables only those approved lab ports. If status remains down, check the cable endpoints and started peer nodes before proceeding.", [
        ["enable", "Select Router's privileged mode before starting this interface-configuration block."],
        ["configure terminal", "Enter global configuration mode to make the recorded lab-only address changes."],
        ["interface GigabitEthernet0/0", "Select LAN1, the port connected to Switch. Substitute its observed full interface name if different."],
        ["ip address 192.168.1.1 255.255.255.0", "Assign LAN1 its local gateway address and /24 mask; 255.255.255.0 describes this first network."],
        ["no shutdown", "Enable LAN1 if administratively down. This removes a configuration disable; it does not fix missing cabling."],
        ["exit", "Return from LAN1 interface mode to global configuration before selecting the other port."],
        ["interface GigabitEthernet0/1", "Select LAN2, connected directly to PC2; substitute the second recorded full interface name."],
        ["ip address 192.168.2.1 255.255.255.0", "Assign LAN2 its different /24 network address so Router can join the two directly connected networks."],
        ["no shutdown", "Enable LAN2 on this isolated router; its PC2 connection must also exist and be started."],
        ["end", "Leave configuration mode and return to privileged EXEC before reading router status."],
        ["show ip interface brief", "Verify both mapped ports have the intended addresses and read up/up after their links initialize."]
      ], "LAN1 is 192.168.1.1 and LAN2 is 192.168.2.1 with up/up state. Administratively down means configured shutdown; a missing port or other down state needs inspection, not repeated blind commands.", "Interface status gives local Layer 1/2 evidence. Correct addresses add Layer 3 configuration, but neither alone proves a successful remote exchange."),
      consoleStep("PC1", "Configure the source computer", "At the VPCS prompt, configure PC1 and record its displayed address. Do not enter Router IOS commands here.", [
        ["ip 192.168.1.10/24 192.168.1.1", "Set PC1 to 192.168.1.10 with a /24 mask and default gateway 192.168.1.1 for remote networks."],
        ["show ip", "Confirm PC1's own IPv4 address, mask and gateway before choosing a different peer address for testing."]
      ], "PC1 reports 192.168.1.10/24 and gateway 192.168.1.1. It must not use either Router address or PC2's address.", "A self-ping stays local and cannot verify the switch, router or destination; record the source identity first."),
      consoleStep("PC2", "Configure the destination computer", "At the VPCS prompt, configure PC2 and record its displayed address separately from PC1.", [
        ["ip 192.168.2.10/24 192.168.2.1", "Set PC2's address to 192.168.2.10/24 and its local default gateway to 192.168.2.1 for the reply path."],
        ["show ip", "Check PC2's own address and gateway. PC2 is the destination of PC1's test, not the source of that command."]
      ], "PC2 reports 192.168.2.10/24 with gateway 192.168.2.1. Both endpoints have unique addresses in different networks.", "An echo reply also needs a return route. A correct forward path cannot compensate for a wrong destination gateway."),
      consoleStep("PC1", "Establish the working peer exchange", "Compare show ip with the destination: 192.168.2.10 must be PC2, not PC1. Run the peer test twice. An initial timeout can occur during ARP discovery; repeated or intermittent loss is not a reliable working baseline. Stop and troubleshoot until repeated replies work before adding a filter.", [
        ["show ip", "Recheck that this console belongs to source 192.168.1.10 before sending packets to another host."],
        ["ping 192.168.2.10", "Send ICMP echo requests from PC1 to PC2 and record replies or timeouts for this first peer exchange."],
        ["ping 192.168.2.10", "Repeat the same PC1-to-PC2 exchange after address discovery; compare results rather than declaring a fault from one timeout."]
      ], "Repeated replies establish the test baseline. A timeout only shows no timely reply; cabling, ARP, addresses, return routing, host state or filtering can contribute. A reply does not test a website.", "Changing a filter before a stable baseline would make the cause of a later failure ambiguous."),
      consoleStep("Router", "Save the clean pre-filter baseline", "Copy this output and both successful endpoint tests to Day4-baseline.txt. Confirm ACL 199 and interface ACL bindings are still absent. On this disposable router only, save the known working configuration; at Destination filename [startup-config]? press Enter. Never save the later fault configuration.", [
        ["enable", "Return to Router's privileged EXEC to record the clean configuration before any filtering change."],
        ["show running-config", "Record the full working configuration, including both IP addresses and the absence of interface ACL bindings."],
        ["show access-lists", "Check again that ACL 199 is unused before the exercise claims ownership of that identifier."],
        ["copy running-config startup-config", "Save this clean disposable-router baseline for a subsequent boot; press Enter to accept the proposed startup-config filename."]
      ], "Baseline notes and startup-config contain the working path without ACL 199. Record the timestamp and router identity; do not continue if an existing filter is discovered.", "A recorded known state makes rollback verifiable. Later detach only our attachment and delete only our new list; never erase unrelated ACLs."),
      consoleStep("Router", "Apply the one lab-owned ICMP filter", "Continue only from the clean Step 7 baseline. If resuming after interruption, inspect running-config and ACLs first; never append into an existing 199. Build the complete list before binding it inbound on mapped LAN1. The narrow deny blocks PC1's echo requests to PC2, not all IPv4 traffic.", [
        ["enable", "Open Router privileged EXEC for the isolated, recorded ACL experiment."],
        ["configure terminal", "Enter global configuration to define the complete new numbered extended list."],
        ["access-list 199 deny icmp host 192.168.1.10 host 192.168.2.10 echo", "In list 199, deny only ICMP echo requests from PC1 to PC2. host selects one exact address; echo selects the request type."],
        ["access-list 199 permit ip any any", "Permit other IPv4 traffic after the narrow deny; without this entry the implicit final deny would block other traffic too."],
        ["interface GigabitEthernet0/0", "Select the recorded LAN1 interface connected to Switch, not the PC2-facing port."],
        ["ip access-group 199 in", "Attach our complete ACL 199 to packets arriving at Router from LAN1; in means inbound on this selected port."],
        ["end", "Return to privileged EXEC without saving the deliberately faulty running configuration."],
        ["show ip interface GigabitEthernet0/0", "Confirm LAN1's inbound access list is 199. Substitute the same mapped interface name used in the configuration."]
      ], "Only the test-owned list 199 is attached inbound on LAN1. Startup-config remains the clean baseline; the router interfaces and cables remain unchanged.", "Changing one narrowly scoped filter provides a known cause that can be checked with rule counters and the identical peer test."),
      consoleStep("PC1", "Compare filtered peer and gateway tests", "Reconfirm the source address, repeat the exact peer ping, then test the local gateway. Record results without changing addresses, cables or masks. A filter timeout or unreachable response is not evidence of a broken physical link.", [
        ["show ip", "Confirm the current console still belongs to PC1 at 192.168.1.10 before comparing destinations."],
        ["ping 192.168.2.10", "Repeat the baseline PC1-to-PC2 request; the lab's inbound rule should now prevent echo replies from that peer."],
        ["ping 192.168.1.1", "Test Router's LAN1 gateway from PC1; this destination is not denied by the specific test rule."]
      ], "The PC2 echo exchange fails while the gateway should still reply. This difference is evidence to investigate; use the matching ACL counter next rather than diagnosing a layer from the ping alone.", "An ICMP filter can hide otherwise available connectivity. Outside this controlled lab, local host settings and firewalls can also suppress replies."),
      consoleStep("Router", "Inspect the actual filter evidence", "Read the numbered list, its match counters and the interface attachment. Counter presentation can vary by image. If the deny counter does not increase, verify the source, target and inbound port; do not claim the filter caused the observed loss without matching evidence.", [
        ["enable", "Use privileged EXEC to inspect the temporary Router filter without altering the experiment."],
        ["show access-lists 199", "Read our list's ICMP deny and permit rules and compare the deny match count with the peer tests."],
        ["show ip interface GigabitEthernet0/0", "Verify 199 is still the inbound list on mapped LAN1, where requests from PC1 enter."],
        ["show ip interface brief", "Compare interface status and addresses with the working baseline while the peer ICMP test is filtered."]
      ], "The exact deny rule has matching traffic evidence and the intended attachment, while the mapped links remain up/up. Missing counters are a limitation to investigate, not invented successful evidence.", "Multiple observations distinguish a known Layer 3 policy decision from a link or addressing problem; ping alone cannot do that."),
      consoleStep("Router", "Detach and delete only test ACL 199", "Compare with the saved Step 7 baseline: no ACL was originally attached. Use mapped LAN1 and exactly these mode transitions. Remove our interface binding first, then the entire lab-owned numbered list. If 199 is not solely ours, stop; do not delete it. Do not substitute an unknown ACL number or name.", [
        ["enable", "Return to Router privileged EXEC to begin explicit rollback of this lab-owned change."],
        ["configure terminal", "Enter global configuration before selecting the port with our test binding."],
        ["interface GigabitEthernet0/0", "Select the same LAN1 interface used for the test; use its recorded actual name if different."],
        ["no ip access-group 199 in", "Detach only list 199 in the inbound direction from LAN1, restoring its recorded unfiltered baseline."],
        ["exit", "Leave interface mode for global configuration; ACL deletion belongs at the global level."],
        ["no access-list 199", "Delete the entire numbered ACL 199 created by this lab, not an arbitrary numbered entry or a named ACL."],
        ["end", "Return to privileged EXEC before checking the removal; do not save a fault configuration."],
        ["show access-lists", "Check that the test-owned list 199 is absent and unrelated lists have not been changed."],
        ["show ip interface GigabitEthernet0/0", "Verify LAN1 no longer has the temporary inbound binding, matching the recorded baseline."]
      ], "ACL 199 and its inbound LAN1 binding are absent. Other configuration is unchanged. An absent list message is acceptable; verify attachment removal separately.", "Deleting an ACL definition and detaching it are separate operations. Explicit commands and ownership checks prevent a vague remove-all cleanup."),
      consoleStep("PC1", "Retest the restored forward exchange", "Check the source and repeat exactly the same destination test twice after rollback. Compare with the saved working result, not with a ping of PC1's own address.", [
        ["show ip", "Verify the restored test still originates at PC1, not PC2 or the router console."],
        ["ping 192.168.2.10", "Repeat the original PC1-to-PC2 exchange after detaching and deleting the test ACL."],
        ["ping 192.168.2.10", "Confirm repeated peer replies rather than accepting one isolated response as a stable restoration."]
      ], "Repeated replies to PC1 resume after the lab-owned filter is removed. If they do not, compare interface status, addressing and remaining attachments with the baseline.", "The same source, destination and command make the before/fault/after comparison meaningful."),
      consoleStep("PC2", "Verify a separate reverse peer exchange", "Compare PC2's own 192.168.2.10 with destination 192.168.1.10. The destination must be PC1, never PC2's own address. This is an additional check after rollback, not a substitute for the original PC1 test.", [
        ["show ip", "Confirm PC2's identity, /24 mask and gateway 192.168.2.1 before testing the other computer."],
        ["ping 192.168.1.10", "Send a new ICMP echo exchange from PC2 to PC1 to check this reverse-direction test after restoration."]
      ], "PC2 receives replies from PC1 through Router and Switch. Neither peer test proves TCP, UDP, DNS or an application works.", "Peer tests from both named endpoints avoid accidental self-tests and expose endpoint-specific settings."),
      consoleStep("Router", "Verify baseline restoration and close", "Compare both outputs with the clean Step 7 baseline, especially the two interface blocks and ACLs. Do not copy startup-config into running-config as a rollback: that merges settings. If unexpected differences remain, stop and investigate or discard only this disposable working project; preserve original projects and baseline notes.", [
        ["enable", "Use Router privileged EXEC for the final read-only configuration comparison."],
        ["show running-config", "Verify the active configuration matches the pre-filter baseline, with no test ACL or attachment remaining."],
        ["show startup-config", "Check the saved boot baseline was not overwritten while the deliberate fault was active."]
      ], "The pre-filter interface and ACL baseline is restored, both peer tests reply, and your original projects are untouched. Stop the disposable nodes when finished.", "A successful ping is not sufficient cleanup evidence; configuration comparison verifies that the temporary policy change is gone.")
    ],
    verification: [
      "Compare node identities and show ip before each peer test. PC1 tests 192.168.2.10; PC2 tests 192.168.1.10. Neither command is a self-ping.",
      "Record repeated PC1-to-PC2 replies before applying 199. Initial ARP discovery may delay a reply; intermittent or persistent loss must be investigated before changing policy.",
      "With the test ACL active, correlate lost PC2 echo replies with the exact deny-rule count and inbound LAN1 attachment. A timeout alone does not locate the faulty layer.",
      "After detaching and deleting only ACL 199, repeat the identical forward peer test and a separate reverse test. Compare interfaces and ACL settings to the saved pre-filter baseline.",
      "Record that ping exercises an IP/ICMP round trip and underlying dependencies. Host behavior, firewall rules and ICMP filtering can cause missing replies; success does not test transport ports or applications."
    ],
    troubleshooting: [
      "Console confusion: right-click the actual node and choose Console. PC1> or PC2> is VPCS, which accepts ip/show ip/ping. Router> and Router# are IOS modes; enable selects privileged EXEC. The built-in Switch has no IOS console. If the expected prompt is absent, stop and select the correct device.",
      "Missing interface: compare show ip interface brief with GNS3's actual adapter and cable-endpoint list. Stop Router before modifying supported adapter settings, then reconnect, restart and inventory again. Map the observed names; never invent a port name or configure an unrelated interface.",
      "Administratively down means configured shutdown. In the Router console, repeat Step 3's full enable/configure terminal/interface/no shutdown/end sequence only for the mapped lab port. If down/down persists, inspect its cable and started peer. Up/down requires checking both sides and link settings; no shutdown alone is not proof of health.",
      "ACL identifier: show running-config may display access-list 199 deny icmp or ip access-list extended 199 for a numbered list. A named example is ip access-list extended LAB_FILTER. The interface's ip access-group 199 in or ip access-group LAB_FILTER in names the attachment. show access-lists confirms the identifier. Rule sequence numbers are different. This exercise removes only its own 199, never LAB_FILTER or a pre-existing binding.",
      "Ping loss: repeat the same remote target, inspect show ip, cables, router ports, ARP and ACL counters. Initial ARP discovery or intermittent links can delay replies; ICMP filtering, host state and the return path can also prevent them. Never conclude that all Layer 3 routing is broken from a single failed ping.",
      "Rollback uncertainty: compare the timestamped pre-filter running-config, interface bindings and saved startup-config. This lab requires no prior ACL binding; if one existed, stop instead of deleting it. Step 11 shows detach then delete for lab-owned 199. Do not erase configuration, remove all ACLs or assume a startup-config merge reverses changes."
    ],
    cleanup: [
      "Perform Step 11 on Router: detach only our inbound ACL 199, exit interface mode, delete only numbered ACL 199, then verify the list and binding are absent. Never remove an unknown named or numbered ACL.",
      "Repeat Steps 12-13 peer tests and Step 14 configuration comparison against the clean Step 7 baseline. Check both addresses, interface state and original absence of ACL bindings. Do not save the fault state.",
      "Stop the disposable GNS3 nodes. Preserve baseline notes and original projects. To undo the entire exercise, discard only its new working project; do not run erase commands or change shared network settings."
    ], licensingNote: ccnaImageLicensingNote
  };
}

export function ccnaLayeredBeginnerGuide(): NonNullable<CcnaLessonContent["beginnerGuide"]> {
  return {
    startingPoint: "Read the definitions above first; no command experience is assumed. This introductory walkthrough is a paper prediction using PC1, Switch, Router and PC2. Do not type commands yet. The later Practice network section supplies all installation, console, addressing, baseline and rollback steps in order. A paper prediction is not a tested network result.",
    whyItMatters: "A missing reply is a symptom, not a diagnosis. Layer names help organize questions about the cable, local delivery, IP routing and application. Compare a working baseline with one controlled change so you can explain which evidence supports your conclusion.",
    everydayComparison: {
      familiarSituation: "Imagine checking a parcel delivery: you read the destination, check the local sorting office and ask whether a reply reached the sender. Different jobs help organize your questions.",
      networkMeaning: "Switch handles local Ethernet frames. Router selects an IP path and builds an outgoing frame. PC2 is the recipient; its reply also needs a working return path. Our example tests an ICMP exchange, not a website.",
      whereItStops: "This is a memory aid, not a literal network rule or fault detector. A device can silently drop a packet. Neither a parcel story nor one ping result proves where a network failed; delivery of ICMP does not prove an application works."
    },
    walkthrough: [
      { action: "On paper, draw PC1 - Switch - Router - PC2 and the reverse reply path.", whatHappens: "PC1 at 192.168.1.10/24 sends toward PC2 at 192.168.2.10/24. They are different IP networks. PC1 therefore uses its local gateway, Router at 192.168.1.1.", why: "The destination is PC2, not PC1's own address or the gateway. A self-ping would not test this path." },
      { action: "Label Router's Switch-facing cable LAN1 and its PC2-facing cable LAN2 on your drawing.", whatHappens: "These are role names, not commands. Before configuration, Lab Step 2 requires Router's actual interface inventory and cable mapping in your baseline notes. GigabitEthernet0/0 is only the example LAN1 name.", why: "Record the actual two interface names before any changes. Every configuration and rollback command must use that recorded mapping." },
      { action: "Trace PC1's frame to Switch and Router, then trace the new frame from Router to PC2.", whatHappens: "Switch handles the local frame. Router reads the packet's destination IP and selects its directly connected PC2 network. Router creates an outgoing frame for PC2; it does not forward the incoming frame unchanged.", why: "The four-layer TCP/IP model groups ICMP with IP at the internet layer. Ethernet delivery belongs to link; some teaching conventions split link into two layers." },
      { action: "Trace the reply from PC2 through Router and Switch back to PC1.", whatHappens: "PC2 uses gateway 192.168.2.1 for the return path. In the real lab, repeated peer replies establish a baseline only after both endpoints and mapped router ports are configured.", why: "A reply supports this ICMP round trip. It does not test TCP/UDP ports or an application. Initial ARP delay is possible, but intermittent or persistent loss needs investigation." },
      { action: "Mark a prediction that the lab-only ACL blocks PC1's echo request at Router; do not configure it during this paper exercise.", whatHappens: "Lab Steps 7-10 first require a clean baseline with ACL 199 unused, then attach the complete new list to mapped LAN1. Expected peer loss must agree with the exact deny counter and attachment; the gateway test is not the full peer path.", why: "An ACL number identifies a rule list. Never append into an existing 199, replace an existing binding or claim a cause from one timeout." },
      { action: "Draw the restored path and write the cleanup order: detach our binding, delete our list, repeat peer tests, compare the baseline.", whatHappens: "Lab Step 11 provides the full Router console sequence; Steps 12-14 verify both peers and the saved configuration. This paper prediction does not establish that an actual router was repaired.", why: "Remove only the changes you own. Never erase all configuration or use a startup-to-running merge as a substitute for rollback." }
    ],
    firstPractice: {
      task: "Using paper only, write PC1's own address and PC2's destination address beside your drawing. Trace both directions. Circle the point where the planned ACL blocks the request and write two other possible causes of a timeout. Do not change a live network.",
      expected: "PC1 is 192.168.1.10 and PC2 is 192.168.2.10. The planned filter is at Router. Missing replies can also involve endpoint settings, either route direction, ARP/link trouble or ICMP filtering. These are predictions, not captured results.",
      hint: "Compare your drawing with the visual's node labels and addressing table. Follow the reply as well as the request. Use the later lab to measure results only after recording a stable baseline."
    },
    checkUnderstanding: {
      question: "After rollback, PC1 repeatedly receives ping replies from PC2. Does this prove PC2's web application works?",
      hint: "Separate the internet-layer ICMP exchange from transport ports and the application. Neither a self-ping nor a gateway-only test reaches PC2.",
      answer: "No. Repeated peer replies support the tested IP/ICMP exchange and its underlying path at that time. They do not establish TCP/UDP service availability or application health. A web application needs its own authorized test; this lab contains no web-server test."
    }
  };
}

export const ccnaLayeredReviewBoundary = "DAY 4 REVIEW: Evaluate the complete assembled lesson in displayed order: teachingPrelude, visualStory, beginnerGuide, sections, scenario, lab, practice and quiz. The prelude is visible teaching before every exercise, not a hidden glossary. Count its actual definitions; do not require them to be repeated in every field. The beginner guide is a labelled paper prediction; only the lab contains executable commands. Check that these scopes remain distinct. Inspect every quiz answer/explanation and practice answer before asserting that coverage is missing. Identify the exact field and quote the problematic wording for each finding. For an omission, verify it across the full lesson first. Do not require redundant disclaimers in every field or invent extra objectives. Reject actual contradictions, unsafe steps, missing required evidence or unclear instructions; do not approve just because maintained content is supplied.";

export function applyCcnaLayeredContract(content: CcnaLessonContent): CcnaLessonContent {
  const sources = [...content.sources];
  for (const source of ccnaLayeredSources) if (!sources.some((item) => item.url === source.url)) sources.push({ ...source });
  return { ...content, sources, teachingPrelude: structuredClone(ccnaLayeredPrelude), beginnerGuide: ccnaLayeredBeginnerGuide(), visualStory: ccnaLayeredVisual(), lab: ccnaLayeredLab() };
}

export function ccnaLayeredIssues(content: CcnaLessonContent): string[] {
  const issues: string[] = [];
  if (ccnaContentDigest(content.visualStory ?? null) !== ccnaContentDigest(ccnaLayeredVisual())) issues.push("Use the complete Day 4 PC1-Switch-Router-PC2 visual: short labels, full role phrases, all links, peer destination and bounded stage titles.");
  if (ccnaContentDigest(content.lab) !== ccnaContentDigest(ccnaLayeredLab())) issues.push("Use the complete Day 4 isolated lab: exact console sequences, interface mapping, no self-pings, clean baseline, lab-only ACL 199, detach-before-delete rollback and peer retests.");
  if (ccnaContentDigest(content.teachingPrelude ?? null) !== ccnaContentDigest(ccnaLayeredPrelude)) issues.push("Define Day 4 layers, frames, packets, consoles, command modes, ACL identifiers, baselines and ping limitations in the teaching prelude before use.");
  if (ccnaContentDigest(content.beginnerGuide ?? null) !== ccnaContentDigest(ccnaLayeredBeginnerGuide())) issues.push("Use Day 4's complete paper walkthrough before the executable lab; do not invite configuration or pings before setup and baseline mapping.");
  return issues;
}

export const ccnaLayeredWritingBoundary = [
  "DAY FOUR: Teach OSI and TCP/IP as diagnostic models, not layer-name memorization. Explain the seven OSI jobs and four-layer TCP/IP mapping; some sources split the link layer into two, so name the convention. ICMP belongs with IP, not TCP/UDP transport. No ping result alone identifies a faulty layer or proves application health.",
  "The application supplies the following full lab, visual and prelude BEFORE independent review. Do not rewrite those fields. Keep all body text, worked examples, objectives, quiz answers and glossary consistent with this exact scope. Packet Journey is the visual TITLE, never another device. Router's complete label is Router; its two full interface addresses belong in the table and visual stages, not a clipped label.",
  `TEACHING PRELUDE (rendered before visual, guide and body): ${JSON.stringify(ccnaLayeredPrelude)}`,
  `FIXED LAB: ${JSON.stringify(ccnaLayeredLab())}`,
  `FIXED VISUAL: ${JSON.stringify(ccnaLayeredVisual())}`,
  `FIXED BEGINNER GUIDE: ${JSON.stringify(ccnaLayeredBeginnerGuide())}`,
  "Use exactly PC1-Switch-Router-PC2, the two 192.168.1.0/24 and 192.168.2.0/24 networks and the stated gateways. Explain every new word at first use. The built-in Switch has no IOS CLI. Do not invent a firewall node, wireless path, Layer 4 port test, browser or DNS server in the live lab. A labelled paper/application comparison is acceptable but not an executed test.",
  "Explain ACL names and numbers from the actual running-config examples. Use only lab-owned unused numbered ACL 199; no pre-existing binding may be replaced. Step 11 supplies enable, configure terminal, mapped interface, no ip access-group 199 in, exit, no access-list 199, end and verification. Never instruct remove all ACLs or erase configuration. Baselines are recorded before changes; startup-config merge is not rollback.",
  "The quiz AND practice set must each contain an explained ping-limit question: missing replies can involve either path direction, ICMP filtering, host/firewall behavior or ARP/link conditions. Distinguish an initial ARP delay from an established stable baseline; never promise a successful ping despite a wrong gateway. A self-ping proves no peer path. Successful ICMP says nothing conclusive about TCP/UDP ports or application health.",
  "Reviewer: inspect the FULL assembled lesson including maintained lab/visual/prelude, not only generated prose. Check supported commands, ownership/baseline safety, actual console for every command, route and reply destinations, mapping when interface names differ, first-use definitions, source evidence and all correct quiz answers. Report all concrete inconsistencies together. Never approve a revision merely because its maintained fields pass schema."
].join("\n\n");
