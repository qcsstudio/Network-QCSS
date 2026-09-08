import type { CcnaLessonContent } from "./ccna-lesson-schema.ts";
import type { CcnaVisualStory } from "./ccna-visual-story.ts";
import { ccnaImageLicensingNote } from "./ccna-image-licensing.ts";

const refs = {
  first: "https://docs.gns3.com/docs/getting-started/your-first-gns3-topology",
  vpcs: "https://docs.gns3.com/docs/emulators/vpcs",
  switching: "https://docs.gns3.com/docs/using-gns3/advanced/hubs-and-switches",
  campus: "https://www.cisco.com/en/US/docs/solutions/Enterprise/Campus/HA_recovery_DG/campusRecovery.html",
  fabric: "https://www.cisco.com/c/en/us/solutions/collateral/data-center-virtualization/application-centric-infrastructure/white-paper-c11-739609.html",
  cloud: "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-145.pdf",
  license: "https://developer.cisco.com/docs/modeling-labs/vm-images-for-cml-labs/",
  routing: "https://www.rfc-editor.org/rfc/rfc1122"
};

export const ccnaTopologySources = Object.entries(refs).map(([name, url]) => ({
  label: ({ first: "GNS3 first topology", vpcs: "GNS3 VPCS", switching: "GNS3 switch capabilities", campus: "Cisco campus resilience", fabric: "Cisco leaf-spine architecture", cloud: "NIST cloud definition", license: "Cisco image licensing", routing: "RFC 1122 host requirements" })[name]!,
  url,
  supports: ({ first: "Building a local VPCS network with GNS3's built-in Ethernet switch.", vpcs: "VPCS addressing, ping tests and saving the isolated lab configuration.", switching: "The built-in switch's supported port modes, distinct from a routed ECMP fabric.", campus: "Redundant campus designs and failure recovery, beyond the single-switch teaching lab.", fabric: "Leaf-spine connectivity and routed multiple-path design; the teaching example is conceptual.", cloud: "Cloud service characteristics, not a claim that GNS3 reproduces a public provider.", license: "CML reference images are licensed for CML unless a separate license permits outside use.", routing: "Local and remote host communication and use of gateways across networks." })[name]!
}));

type Node = CcnaVisualStory["nodes"][number];
type Stage = CcnaVisualStory["stages"][number];
function node(id: string, kind: Node["kind"], label: string, detail: string): Node { return { id, kind, label, detail }; }
function pathEdges(ids: string[]) { return ids.slice(1).map((to, index) => ({ id: `link-${index + 1}`, from: ids[index], to })); }
function stage(title: string, explanation: string, activeNodes: string[], activeConnections: string[], sourceUrls: string[], direction: Stage["direction"] = "forward"): Stage {
  return { title, explanation, activeNodes, activeConnections, sourceUrls, direction };
}
function selection(subject: string): CcnaVisualStory["conceptSelection"] {
  return {
    candidates: [
      { name: `${subject} traffic trace`, scene: `Named devices and arrows trace one ${subject} request to its destination, then identify a failed part.`, teachingValue: "Separate the working traffic path from the scope of one failure.", limitation: "This simplified example does not show every production design." },
      { name: "Geographic site map", scene: "Place offices and data centres on a map with their geographical distances.", teachingValue: "Relate the size of a network to the sites it connects.", limitation: "Geography alone cannot explain forwarding or redundancy." },
      { name: "Service dependency list", scene: "Arrange the application and the systems it needs into an ordered checklist.", teachingValue: "Identify dependencies that a connectivity test does not validate.", limitation: "A checklist does not show the actual connections between devices." }
    ], selectedIndex: 0,
    selectionReason: `The ${subject} traffic trace names the source, every depicted forwarding role and the destination. Its separate failure step distinguishes the example from a universal topology rule.`
  };
}

export function ccnaTopologyVisual(): CcnaVisualStory {
  const campus: CcnaVisualStory = {
    conceptSelection: selection("Campus"), title: "Campus access", layout: "sequence",
    takeaway: "This small access-network example has one switch. Real campus designs can add redundant switches and paths.",
    altText: "CampusPC1 sends through CampusSwitch to CampusPC2. The path ends at CampusPC2; losing the only switch breaks this example's connection.",
    boundary: "This lab models one campus access segment. It omits redundant campus switches and paths to isolate one failure; their recovery behaviour is not tested.",
    nodes: [node("campus-pc1", "computer", "CampusPC1", "Sends the test"), node("campus-switch", "switch", "CampusSwitch", "Joins local devices"), node("campus-pc2", "computer", "CampusPC2", "Receives and replies")],
    connections: pathEdges(["campus-pc1", "campus-switch", "campus-pc2"]),
    stages: [
      stage("Trace the local request", "CampusPC1 sends the test through CampusSwitch to CampusPC2. Both computers are in one local network, so this path needs no router.", ["campus-pc1", "campus-switch", "campus-pc2"], ["link-1", "link-2"], [refs.first]),
      stage("Observe the reply", "CampusPC2 replies through CampusSwitch to CampusPC1. A reply verifies this test path, not every application or every campus service.", ["campus-pc1", "campus-switch", "campus-pc2"], ["link-1", "link-2"], [refs.vpcs], "reverse"),
      stage("Limit the failure claim", "Removing the CampusPC2 cable breaks this sole path. A real campus may use redundant switches and links; this small lab cannot demonstrate their recovery.", ["campus-pc2"], [], [refs.campus, refs.first], "none")
    ]
  };
  const wan: CcnaVisualStory = {
    conceptSelection: selection("WAN"), title: "WAN between sites", layout: "sequence",
    takeaway: "A wide area network joins sites. Losing the only inter-site path stops this example's remote traffic.",
    altText: "BranchPC sends through BranchRouter and RemoteRouter to RemoteServer. The diagram ends at RemoteServer; the middle link represents an inter-site WAN service.",
    boundary: "This paper model omits the provider's internal routers, latency and failover. The WAN service is one logical link, not a measured or emulated carrier network.",
    nodes: [node("branch-pc", "computer", "BranchPC", "Starts the request"), node("branch-router", "router", "BranchRouter", "Leaves the local site"), node("remote-router", "router", "RemoteRouter", "Enters the remote site"), node("remote-server", "server", "RemoteServer", "Final destination")],
    connections: pathEdges(["branch-pc", "branch-router", "remote-router", "remote-server"]),
    stages: [
      stage("Follow the remote path", "BranchPC sends through BranchRouter, the logical WAN link and RemoteRouter to RemoteServer. The return route must also work for a reply.", ["branch-pc", "branch-router", "remote-router", "remote-server"], ["link-1", "link-2", "link-3"], [refs.routing]),
      stage("Separate local and remote", "Cover the middle link on paper. BranchPC cannot reach RemoteServer along this path, but that does not prove that every device at the branch has stopped working.", ["branch-router", "remote-router"], [], [refs.routing], "none"),
      stage("Restore the connection", "Uncover the middle link and trace BranchPC to RemoteServer again. This restores the drawn path only; it is not a carrier failover or latency measurement.", ["branch-pc", "branch-router", "remote-router", "remote-server"], ["link-1", "link-2", "link-3"], [refs.routing])
    ]
  };
  const soho: CcnaVisualStory = {
    conceptSelection: selection("SOHO"), title: "SOHO gateway", layout: "sequence",
    takeaway: "A small office or home office often depends on one gateway. Its bundled services are separate functions.",
    altText: "SOHO PC sends through SOHORouter to SOHO Server on another network. The diagram ends at SOHO Server and shows only the gateway's routing role.",
    boundary: "This paper example omits Wi-Fi, NAT, DHCP and firewall policy to focus on routing. SOHORouter is a conceptual role, not an installed GNS3 template.",
    nodes: [node("soho-pc", "computer", "SOHO PC", "Local client"), node("soho-router", "router", "SOHORouter", "Routes to another LAN"), node("soho-server", "server", "SOHO Server", "Remote destination")],
    connections: pathEdges(["soho-pc", "soho-router", "soho-server"]),
    stages: [
      stage("Follow the gateway", "SOHO PC sends through SOHORouter to SOHO Server on another network. A gateway is the next router a host uses to reach a remote network.", ["soho-pc", "soho-router", "soho-server"], ["link-1", "link-2"], [refs.routing]),
      stage("Find the dependency", "Cover SOHORouter on paper. This example loses its only route to SOHO Server. Do not infer that every real small-office design lacks a backup gateway.", ["soho-router"], [], [refs.routing], "none"),
      stage("Separate bundled roles", "Uncover SOHORouter and trace the route to SOHO Server. This drawing tests no wireless or firewall feature, even if a real home appliance includes both.", ["soho-pc", "soho-router", "soho-server"], ["link-1", "link-2"], [refs.routing])
    ]
  };
  const cloud: CcnaVisualStory = {
    conceptSelection: selection("Cloud"), title: "Cloud service", layout: "sequence",
    takeaway: "Cloud services are reached over networks. Provider-managed availability is a separate design question.",
    altText: "CloudDevice sends through CloudGateway to Cloud Server. The logical service path ends at Cloud Server; the provider's internal network is not depicted.",
    boundary: "This paper model omits provider failover and logical isolation because GNS3 does not reproduce a public cloud. Its Cloud node connects networks; it does not create provider services.",
    nodes: [node("cloud-device", "computer", "CloudDevice", "Client endpoint"), node("cloud-gateway", "cloud", "CloudGateway", "Logical service entry"), node("cloud-server", "server", "Cloud Server", "Service destination")],
    connections: pathEdges(["cloud-device", "cloud-gateway", "cloud-server"]),
    stages: [
      stage("Trace the service path", "CloudDevice reaches Cloud Server through CloudGateway, a logical entry in this paper example. The arrows are dependencies, not an inventory of a provider's routers.", ["cloud-device", "cloud-gateway", "cloud-server"], ["link-1", "link-2"], [refs.cloud]),
      stage("Distinguish the failures", "Cover the client link, then cover Cloud Server separately. Either interrupts this drawn service path; neither observation proves whether a provider has failover or tenant isolation.", ["cloud-device", "cloud-server"], [], [refs.cloud], "none"),
      stage("Compare a local test", "Uncover the path to Cloud Server. Compare it with the campus cable-removal lab: that lab tests local connectivity, not cloud availability, scaling or logical isolation.", ["cloud-device", "cloud-gateway", "cloud-server"], ["link-1", "link-2"], [refs.cloud, refs.first])
    ]
  };
  const fabric: CcnaVisualStory = {
    conceptSelection: selection("Spine-leaf"), title: "Spine-leaf fabric", layout: "fabric",
    takeaway: "Each leaf connects to both spines. Equal-cost multipath can use eligible routed alternatives, not duplicate every packet.",
    altText: "Spine PC reaches LeafSwitch1, SpineSwitch1 or SpineSwitch2, LeafSwitch2, then Spine Server. Both alternatives are drawn; the destination is Spine Server.",
    boundary: "This paper fabric omits routing setup and convergence timing. Built-in GNS3 Ethernet switches can have multiple links but do not demonstrate routed ECMP; a capable, licensed platform is required.",
    nodes: [node("spine-pc", "computer", "Spine PC", "Source endpoint"), node("leaf-1", "switch", "LeafSwitch1", "Connects the client"), node("spine-1", "switch", "SpineSwitch1", "First routed path"), node("spine-2", "switch", "SpineSwitch2", "Second routed path"), node("leaf-2", "switch", "LeafSwitch2", "Connects the server"), node("spine-server", "server", "Spine Server", "Final destination")],
    connections: [{ id: "pc-leaf", from: "spine-pc", to: "leaf-1" }, { id: "leaf-spine1", from: "leaf-1", to: "spine-1" }, { id: "spine1-leaf", from: "spine-1", to: "leaf-2" }, { id: "leaf-spine2", from: "leaf-1", to: "spine-2" }, { id: "spine2-leaf", from: "spine-2", to: "leaf-2" }, { id: "leaf-server", from: "leaf-2", to: "spine-server" }],
    stages: [
      stage("Trace the first path", "Spine PC reaches LeafSwitch1, SpineSwitch1, LeafSwitch2 and Spine Server. ECMP means equal-cost multipath: eligible routes can share traffic, commonly by flow.", ["spine-pc", "leaf-1", "spine-1", "leaf-2", "spine-server"], ["pc-leaf", "leaf-spine1", "spine1-leaf", "leaf-server"], [refs.fabric]),
      stage("Trace the alternative", "Spine PC can instead reach Spine Server through LeafSwitch1, SpineSwitch2 and LeafSwitch2 when routing permits. Two drawn uplinks alone do not enable ECMP.", ["spine-pc", "leaf-1", "spine-2", "leaf-2", "spine-server"], ["pc-leaf", "leaf-spine2", "spine2-leaf", "leaf-server"], [refs.fabric]),
      stage("Compare failure domains", "Cover SpineSwitch1 and trace the surviving route to Spine Server through SpineSwitch2. Cover LeafSwitch2 instead: this single-attached server loses both paths. Recovery timing is not simulated.", ["spine-pc", "leaf-1", "spine-2", "leaf-2", "spine-server"], ["pc-leaf", "leaf-spine2", "spine2-leaf", "leaf-server"], [refs.fabric])
    ]
  };
  return { ...campus, comparisons: [wan, soho, cloud, fabric] };
}

export const ccnaTopologyPrelude: NonNullable<CcnaLessonContent["teachingPrelude"]> = {
  terms: [
    { term: "Topology", meaning: "A topology is a plan of network devices and the connections between them. A physical plan shows cables; a logical plan shows communication relationships." },
    { term: "Campus, WAN and SOHO", meaning: "A campus connects a site's buildings or work areas. Its access layer connects user devices; distribution joins access networks; a core joins distribution areas. Smaller designs can combine the last two roles. A wide area network, or WAN, joins separate sites. SOHO means small office or home office, where fewer users share a smaller network." },
    { term: "Cloud", meaning: "Cloud computing provides computing services, such as servers, over a network. A provider manages underlying resources; a cloud symbol alone does not prove that a service has backup capacity or isolation." },
    { term: "Spine and leaf", meaning: "A leaf switch connects endpoint devices. A spine switch connects leaves to one another. Each leaf connects to both spines in this drawing. Between its two leaves, a path crosses one spine and two fabric links. Devices on the same leaf need not cross a spine; this is not an always-two-hops rule for every design." },
    { term: "Traffic path", meaning: "A traffic path is the ordered route that a message follows from its sending device to its receiving device." },
    { term: "Failure domain", meaning: "A failure domain is the set of devices or services affected when a particular component stops working. Its size depends on the design." },
    { term: "Redundancy", meaning: "Redundancy means providing another component or path for the same job. Recovery also needs working configuration; an extra cable alone is not a guarantee." },
    { term: "Gateway", meaning: "A gateway is the router a computer uses to reach another IP network. Local traffic does not need to pass through that router." },
    { term: "ECMP", meaning: "Equal-cost multipath, or ECMP, lets a router use multiple eligible routes with the same routing cost. A flow is related traffic, such as one download. Its packets commonly use one selected path instead of being copied onto every path." },
    { term: "VPCS", meaning: "Virtual PC Simulator, or VPCS, is a small computer simulator included with the network-lab application GNS3. It supports address settings and connectivity tests without a Cisco software image." },
    { term: "Interface and console", meaning: "An interface is a device's network connection, such as the Ethernet0 cable port in this lab. A console is a text window for a named device. Type a command there and press Enter to ask that device to perform an action." },
    { term: "Ping and ICMP", meaning: "Ping tests whether a destination replies. It sends an echo request, a message asking for a response, using Internet Control Message Protocol (ICMP). An echo reply is the destination's response. Replies show that the tested exchange worked, not that every application works or that the network uses a particular topology." }
  ],
  explanation: "We compare five designs using separate drawings. Only the campus access example is a live GNS3 exercise. WAN, SOHO, cloud and spine-leaf are paper models with named destinations and limits. A paper prediction is not measured device output. Everyday comparisons are memory aids, not literal network rules: roads do not select routes using device addresses and routing configuration.",
  labBoundary: "Lab boundary: Only CampusPC1, CampusSwitch and CampusPC2 run in GNS3. WAN, SOHO, cloud and spine-leaf are paper comparisons; provider services and routed ECMP are not simulated."
};

type LabStep = CcnaLessonContent["lab"]["steps"][number];
function consoleStep(title: string, device: string, instruction: string, commands: string[], commandExplanations: string[], expectedResult: string, why: string): LabStep {
  return { title, instruction: `In GNS3, right-click ${device} and choose Console before typing. ${instruction} Press Enter after each command.`, commands, commandExplanations, expectedResult, why };
}
function observation(title: string, instruction: string, expectedResult: string, why: string): LabStep {
  return { title, instruction, commands: [], commandExplanations: [], expectedResult, why };
}

export function ccnaTopologyLab(): CcnaLessonContent["lab"] {
  return {
    title: "One live access network, four paper comparisons",
    goal: "Build a small local network, record a working test, remove one cable and observe the failure, then restore it. Compare that measured result with four separate paper designs without claiming to emulate their advanced features.",
    topology: "CampusPC1 Ethernet0 connects to CampusSwitch Ethernet0. CampusPC2 Ethernet0 connects to CampusSwitch Ethernet1. No other node is installed. WAN, SOHO, cloud and spine-leaf use the separate labelled paper diagrams.",
    devices: ["CampusPC1: built-in VPCS", "CampusSwitch: built-in Ethernet switch", "CampusPC2: a second, separate built-in VPCS"],
    addressing: [
      { device: "CampusPC1", interface: "Ethernet0", address: "192.168.1.10/24", purpose: "First local host; no default gateway is required." },
      { device: "CampusPC2", interface: "Ethernet0", address: "192.168.1.20/24", purpose: "Second local host; no default gateway is required." }
    ],
    setup: [
      "Install and open GNS3, then create a new, isolated project named Day3-Topologies. Use an available local or GNS3 VM server for the built-in nodes; do not attach this project to a real network.",
      "In the device list, choose VPCS under End devices and drag two separate copies into the workspace. Use the built-in Ethernet switch under Switches for CampusSwitch. These are included node types, not Cisco IOS templates.",
      "Right-click each node, open Configure, and set its Name to the exact label in the topology. Keep the Ethernet switch ports in their default shared access mode. Do not add extra uplinks or type Cisco commands into the built-in switch.",
      "SOHORouter, CloudDevice, the WAN routers and the spine-leaf devices exist only in the paper comparisons. There is no SOHORouter or CloudDevice template to install. In particular, GNS3's Cloud node connects to external networks; it does not supply public-cloud services.",
      "Use one address per VPCS instance. CampusPC1 and CampusPC2 are different computers, each with Ethernet0; do not assign a SOHO subnet to either. The /24 suffix means subnet mask 255.255.255.0. Both hosts belong to the same local network."
    ],
    steps: [
      observation("Build the named nodes", "Create the isolated project and add the three built-in nodes from Setup. Check each visible label against CampusPC1, CampusSwitch and CampusPC2 before adding links.", "The workspace contains exactly two separate VPCS instances and one built-in Ethernet switch, with no cloud or physical-network connection.", "Stable names let you match the diagram to the console and prevent configuring a different computer by mistake."),
      observation("Connect and start", "Select Add a link. Connect CampusPC1 Ethernet0 to CampusSwitch Ethernet0, then CampusPC2 Ethernet0 to CampusSwitch Ethernet1. Leave link mode and click Start all devices.", "Two links connect the three named nodes. The running endpoints show green link indicators; no link leaves the isolated project.", "Each endpoint has its own switch connection. Link indicators show device or link state, not proof of successful IP communication."),
      consoleStep("Address CampusPC1", "CampusPC1", "Enter the address command, then inspect and save this host's settings.", ["ip 192.168.1.10/24", "show ip", "save"], ["ip sets CampusPC1 to host address 192.168.1.10; /24 selects mask 255.255.255.0 on its only Ethernet interface.", "show ip displays this VPCS instance's address settings so you can check the exact host and mask.", "save writes this VPCS instance's settings to its startup file; it does not save another device."], "CampusPC1 reports 192.168.1.10 and mask 255.255.255.0. No remote-network gateway is needed for this local test.", "Reading the settings immediately catches a wrong host address before it can be mistaken for a network failure."),
      consoleStep("Address CampusPC2", "CampusPC2", "Set the second host's different address, then inspect and save its settings.", ["ip 192.168.1.20/24", "show ip", "save"], ["ip sets CampusPC2, not CampusPC1, to 192.168.1.20 with mask 255.255.255.0.", "show ip lets you confirm the destination host's settings in its own console.", "save preserves CampusPC2's settings for a later start of this isolated project."], "CampusPC2 reports 192.168.1.20 and mask 255.255.255.0. The two computers have different host addresses on the same subnet.", "A destination address must identify the other host; configuring both computers identically would invalidate the test."),
      consoleStep("Record a working baseline", "CampusPC1", "Test the other host, not this computer's own address. Record the destination and whether replies arrive.", ["ping 192.168.1.20"], ["ping sends test requests from CampusPC1 to CampusPC2 at 192.168.1.20 and reports the replies it receives."], "Replies from 192.168.1.20 establish a working baseline. If there are none, check both addresses and links before introducing the fault.", "You need evidence that this exact path worked before attributing a later failure to the cable you remove."),
      observation("Remove one known cable", "In the workspace, right-click only the link between CampusSwitch Ethernet1 and CampusPC2 Ethernet0, then choose Delete. Leave both computers running and do not change their addresses.", "The CampusPC2 cable is absent. CampusPC1 remains linked to CampusSwitch, with no alternate cable to CampusPC2.", "Changing only one component makes the experiment interpretable. This demonstrates the example's single path, not every campus architecture."),
      consoleStep("Observe the broken path", "CampusPC1", "Repeat the exact baseline test while the CampusPC2 cable is absent.", ["ping 192.168.1.20"], ["The same ping destination keeps the experiment comparable; only the connection to CampusPC2 has changed."], "No echo replies arrive from 192.168.1.20. A timeout or unreachable result is expected because the destination's only cable is absent.", "A failed test shows this path is broken; it does not show that unrelated campus devices or all applications have failed."),
      observation("Restore the original cable", "Use Add a link to reconnect CampusSwitch Ethernet1 to CampusPC2 Ethernet0. Leave link mode, confirm the two original links, and keep both hosts running with their original addresses.", "The drawing again matches the initial topology. The restored cable uses the same two interface endpoints as before.", "Restoring the original change makes the recovery test meaningful; adding an unrelated path would test a different design."),
      consoleStep("Verify recovery", "CampusPC1", "Retest the same destination after restoring the cable. Compare this result with the baseline and the failed test.", ["ping 192.168.1.20"], ["ping again checks CampusPC2 at the same address, so restored replies can be compared with the recorded failure."], "Replies from 192.168.1.20 resume. If they do not, verify the restored cable endpoints, running nodes and saved host settings.", "Failure followed by recovery supports the cable explanation; it is not a measurement of automatic campus failover."),
      observation("Compare WAN, SOHO and cloud", "On paper, copy the three corresponding diagrams with every labelled endpoint. Trace each complete route, cover its middle link or gateway, and record which destination becomes unreachable. For cloud, cover the server separately too.", "The paths end at RemoteServer, SOHO Server and Cloud Server. The cloud exercise distinguishes client access from service failure but cannot observe provider failover or isolation.", "Compare these predictions with the campus cable experiment. Only the campus result is measured in GNS3; the other observations describe the drawn models."),
      observation("Compare both spine paths", "Copy the six-node spine-leaf diagram on paper. Trace the route through each spine to Spine Server. Cover SpineSwitch1 and trace the remaining route; then uncover it and cover LeafSwitch2 instead.", "With one spine covered, another drawn route remains. With LeafSwitch2 covered, this single-attached server has none. ECMP eligibility and recovery timing are not measured.", "The built-in switch can connect multiple links but is not a routed ECMP appliance. Do not wire a loop of built-in switches to claim ECMP; a later routed lab needs a suitable, licensed platform."),
      observation("Record and close safely", "Write down the baseline, failed and recovered ping results. Label the other four exercises as paper predictions. Click Stop all devices and save the isolated project before closing GNS3.", "Your notes distinguish measured local connectivity from the untested WAN, SOHO, cloud and spine-leaf properties.", "An honest record states what each experiment proves and avoids presenting a classroom prediction as a production guarantee.")
    ],
    verification: [
      "Confirm each computer has its own address and one Ethernet0 connection. No host has both a campus and SOHO address.",
      "Record replies before cable removal, no replies while it is absent, and replies after the exact cable is restored.",
      "For each paper design, name the source, every drawn forwarding role, the destination and the component you cover.",
      "State that the single-switch campus example lacks redundancy; real campuses may have multiple switches and redundant paths.",
      "Do not report cloud failover, tenant isolation or routed ECMP as a GNS3 observation. Those features are not tested here."
    ],
    troubleshooting: [
      "If the baseline fails, check that both VPCS instances are running, have different addresses with the same /24 mask, and connect to the specified default access switch ports.",
      "If a console will not open, verify that you right-clicked CampusPC1 or CampusPC2 and started that VPCS instance. CampusSwitch is a built-in switch, not a Cisco IOS console.",
      "If the failure test still replies, confirm that you removed the cable to CampusPC2 and are pinging 192.168.1.20, not CampusPC1's own address.",
      "If recovery fails, reconnect the original interfaces and inspect each host's settings in its own console. Do not add a cloud node or change the addressing to hide the fault."
    ],
    cleanup: ["Stop all devices and retain the isolated project with the original two links restored.", "Keep paper diagrams separate from test results. Never attach this teaching project to an employer's or public network."],
    licensingNote: ccnaImageLicensingNote
  };
}

export function ccnaSpineLeafSection(): CcnaLessonContent["sections"][number] {
  return {
    heading: "Spine-leaf topology: equal-cost paths on paper",
    explanation: [
      "Leaf switches connect endpoint devices. Spine switches connect the leaves to one another. In this drawing, each leaf connects to both spines. Equal-cost multipath (ECMP) allows a routing device to use multiple eligible routes to the same destination when those routes have the same routing cost. Cost is a route-selection value, not a money price. Traffic is commonly assigned by flow, meaning related packets such as one download. ECMP does not duplicate each packet across every spine or guarantee an even split of traffic.",
      "Lab boundary: This spine-leaf comparison is a paper exercise. It does not measure routed ECMP in GNS3, load distribution, failure-detection time or routing convergence. Convergence means updating forwarding choices after the network changes. GNS3's built-in Ethernet switch provides switching, not the routed ECMP implementation needed for this experiment. A routed test needs capable, properly licensed devices and a separate configuration. The live campus ping exercise tests only its local path."
    ].join("\n\n"),
    example: "On paper, trace Spine PC to LeafSwitch1, SpineSwitch1, LeafSwitch2 and Spine Server. Trace the alternative through SpineSwitch2 using the same source, leaves and destination. Cover SpineSwitch1: the second drawn route remains. Restore it, then cover LeafSwitch2: this drawn, single-attached Spine Server has no remaining path. Single-attached means the server connects to only one leaf. These observations identify path dependencies; they do not demonstrate automatic or loss-free recovery. In a configured network, recovery depends on failure detection, routing updates and an eligible surviving route; packets may be lost during the change.",
    keyPoints: [
      "Equal-cost routes are eligible routes to the same destination with the same routing cost; extra cables alone do not enable ECMP.",
      "A flow commonly uses one selected path. Multiple eligible paths do not guarantee equal traffic shares or copy every packet to every spine.",
      "Both drawn paths end at Spine Server. Losing its only leaf removes this server's paths, not necessarily those of every server in a real fabric.",
      "The illustrated inter-leaf path crosses one spine and two fabric links. Same-leaf traffic need not cross a spine; this is not a universal IP hop-count rule.",
      "This paper comparison does not measure routed ECMP in GNS3. Load balancing, routing convergence and recovery timing remain untested."
    ],
    sourceUrls: [refs.fabric, refs.switching]
  };
}

function isSpineLeafSection(section: CcnaLessonContent["sections"][number]) {
  return /\bspines?\b/i.test(section.heading) && /\b(?:leaf|leaves)\b/i.test(section.heading);
}

export function applyCcnaTopologyContract(content: CcnaLessonContent): CcnaLessonContent {
  const sources = [...content.sources];
  for (const source of ccnaTopologySources) if (!sources.some((item) => item.url === source.url)) sources.push(source);
  // Replace the complete section before review, rather than adding a disclaimer
  // beneath generated claims of guaranteed recovery. Ambiguous sections stay held.
  const spineSections = content.sections.filter(isSpineLeafSection);
  const sections = spineSections.length === 1
    ? content.sections.map((section) => isSpineLeafSection(section) ? ccnaSpineLeafSection() : section)
    : content.sections;
  // Citation reconciliation follows composition and retains all actually cited evidence.
  return { ...content, sections, sources, visualStory: ccnaTopologyVisual(), lab: ccnaTopologyLab(), teachingPrelude: structuredClone(ccnaTopologyPrelude) };
}

export function ccnaTopologyIssues(content: CcnaLessonContent): string[] {
  const issues: string[] = [];
  function ordered(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)]));
    return value;
  }
  const equal = (a: unknown, b: unknown) => JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));
  const expected = ccnaTopologyVisual();
  if (!equal(content.visualStory, expected)) issues.push("Day 3 requires the complete five-diagram comparison, including both spine paths, all endpoints, full text and source-backed boundaries.");
  if (!equal(content.lab, ccnaTopologyLab())) issues.push("Use the Day 3 reproducible campus lab: two separate VPCS addresses, exact cable endpoints, baseline/fault/recovery tests and four clearly labelled paper comparisons.");
  if (!equal(content.teachingPrelude, ccnaTopologyPrelude)) issues.push("Use the complete Day 3 prelude before teaching: define campus layers, spine and leaf, paths, failures, redundancy, gateway, ECMP, VPCS, interface, console, ping and ICMP; state the analogy and lab limits.");
  const teaching = [...content.sections.flatMap((s) => [s.heading, s.explanation, s.example, ...s.keyPoints]), content.plainAnswer, ...content.realWorldScenario.walkthrough, ...content.practiceQuestions.flatMap((q) => [q.question, q.answer, q.explanation]), ...content.quiz.flatMap((q) => [q.question, q.options[q.correctIndex], q.explanation])].join("\n");
  if (/172\.16\.0\.10|\bPC1\b/.test(teaching)) issues.push("Match the Day 3 body and assessments to CampusPC1 192.168.1.10/24 and CampusPC2 192.168.1.20/24. Do not reuse PC1 on a second SOHO subnet.");
  if (/\b(?:add|install|drag|configure)\b[^.\n]{0,65}\b(?:SOHORouter|CloudDevice|SpineSwitch[12]|LeafSwitch[12])\b/i.test(teaching)) issues.push("Treat WAN, SOHO, cloud and spine-leaf as named paper models, not invented GNS3 templates or configured appliances.");
  if (!content.sections.some((s) => /campus/i.test(s.heading) && /redundan|backup/i.test(`${s.explanation} ${s.example} ${s.keyPoints.join(" ")}`))) issues.push("Explain redundant campus switches and paths in the campus section; the single-switch failure result applies only to this lab.");
  if (!content.sections.some((s) => /cloud/i.test(s.heading) && /paper/i.test(`${s.explanation} ${s.example}`) && /not|cannot/i.test(`${s.explanation} ${s.example}`))) issues.push("The cloud section must explicitly separate its paper comparison from untested provider failover and logical isolation.");
  const spineSections = content.sections.filter(isSpineLeafSection);
  if (spineSections.length !== 1) {
    issues.push("Include one clearly named spine-leaf teaching section with the ECMP definition and paper-only GNS3 boundary.");
  } else {
    const section = spineSections[0];
    const text = [section.explanation, section.example, ...section.keyPoints].join("\n").normalize("NFKC").replace(/[\u2010-\u2015\u2212]/g, "-");
    if (!/equal[-\s]+cost\s+multi[-\s]?path/i.test(text)) issues.push("Define equal-cost multipath (ECMP) in the spine-leaf section's explanation, worked example or key points, not only its heading or glossary.");
    if (!/paper/i.test(text) || !/GNS3/i.test(text) || !/(?:does not|do not|cannot)\s+(?:measure|test|simulate|demonstrate)\s+(?:routed\s+)?ECMP|(?:routed\s+)?ECMP\s+(?:is\s+)?not\s+(?:measured|tested|simulated|demonstrated)/i.test(text)) {
      issues.push("State in the spine-leaf section: This paper comparison does not measure routed ECMP in GNS3; load distribution and routing convergence remain untested.");
    }
  }
  return issues;
}

export const ccnaTopologyWritingBoundary = [
  "DAY THREE CONTRACT: Compare campus, WAN, SOHO, cloud and spine-leaf by traffic path and failure domain. Each has its own diagram; do not squeeze all five into three stages or claim a single packet traverses all five designs.",
  "The application supplies visualStory with four additional comparison scenes, the teachingPrelude and a fixed 12-step lab BEFORE independent review. Do not generate visualStory, lab, comparisons or teachingPrelude; those fields are excluded from your writing schema. All body text, scenarios and correct quiz answers must agree with this contract.",
  "The only executable lab is CampusPC1 Ethernet0 - CampusSwitch Ethernet0, with CampusSwitch Ethernet1 - CampusPC2 Ethernet0. Both computers are separate built-in VPCS instances: 192.168.1.10/24 and 192.168.1.20/24 respectively. No gateway is needed. Use only the built-in Ethernet switch in default access mode. No Cisco image is needed for this lab.",
  "Lab sequence: build nodes; connect/start; configure/show/save CampusPC1; configure/show/save CampusPC2; baseline ping from CampusPC1 to 192.168.1.20; delete only the CampusPC2 cable; same ping fails; restore exact cable; same ping replies; paper WAN/SOHO/cloud comparison; paper spine-leaf path/failure comparison; record and stop. Each console step names its actual VPCS console and explains every command.",
  "The prelude defines interface, console, ping, ICMP, echo request and echo reply before commands. Explain that successful replies verify this tested exchange, not an application or hub-and-spoke WAN design. There is no Cisco IOS console in this lab: do not add privileged EXEC, enable, configure terminal, shutdown or show interfaces tasks. Do not copy command explanations between different devices or tests.",
  "WAN: BranchPC - BranchRouter - RemoteRouter - RemoteServer. SOHO: SOHO PC - SOHORouter - SOHO Server on another network. Cloud: CloudDevice - CloudGateway - Cloud Server. These are paper device roles, NOT GNS3 appliance templates. Provider routers, public-cloud failover and logical isolation are not emulated. Offer the campus cable fault as a local-connectivity comparison, never as proof of cloud resilience.",
  "Spine-leaf: Spine PC - LeafSwitch1 - either SpineSwitch1 or SpineSwitch2 - LeafSwitch2 - Spine Server. Every leaf connects to both spines. Define equal-cost multipath (ECMP) before use. Cover a spine on paper to trace the alternative; cover LeafSwitch2 to show loss of this single-attached server. These are not emulator results. Built-in GNS3 switches can connect multiple links but do not provide routed ECMP; do not create loops to pretend otherwise.",
  `The application replaces the single spine-leaf teaching section with this maintained content BEFORE independent review. Include one clearly named spine-leaf section in the sections array. Keep every other teaching field and assessment consistent with it; never promise even load sharing, automatic loss-free recovery or measured routed ECMP in this paper exercise. Section: ${JSON.stringify(ccnaSpineLeafSection())}`,
  "Scope spine-leaf questions to the illustrated fabric. The path between these leaves crosses one spine and two fabric links, not an unconditional two-hop rule for all endpoint traffic or all fabrics. Same-leaf traffic need not cross a spine. Distinguish physical links from IP hop counts. ECMP supplies eligible alternatives; it does not require every packet to visit every spine or be duplicated.",
  "The campus lab is a deliberately nonredundant access segment, not a claim that campuses have only one switch. Explain that real campuses can have redundant switches, uplinks and routing. Scope every failure question to the drawn example; never assert that one switch failure disables every campus.",
  "Write one clearly named teaching section for each of the five topologies, with an optional sixth synthesis section. Include full paths, failure reasoning and explicit exercise boundaries in the body, not only in a glossary. Use the prelude's definitions, including access, distribution, core, spine, leaf, interface, ping and ICMP. Define any extra term directly before its first teaching use; quiz answers may not depend on untaught concepts.",
  "Everyday comparisons must state their limits in beginnerGuide.everydayComparison.whereItStops and remain limited throughout the body. City roads are memory aids for connectivity, not literal routing or forwarding rules. Do not infer network behaviour from a metaphor.",
  `Reserve these ${ccnaTopologySources.length} verified references within the shared ten-source bibliography. Add no more than two other complementary references. Citations must support the specific claims. Contract references: ${JSON.stringify(ccnaTopologySources)}`,
  `Teaching prelude: ${JSON.stringify(ccnaTopologyPrelude)}`
].join(" ");
