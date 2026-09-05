export type CcnaLabKind =
  | "addressing"
  | "automation"
  | "operations"
  | "routing"
  | "security"
  | "switching"
  | "wireless";

export type CcnaCurriculumTopic = {
  sequence: number;
  week: number;
  day: number;
  moduleId: string;
  moduleTitle: string;
  domain: string;
  title: string;
  slug: string;
  objective: string;
  v11: string;
  v20: string;
  labKind: CcnaLabKind;
};

type TopicSeed = [
  title: string,
  slug: string,
  objective: string,
  v11: string,
  v20: string,
  labKind: CcnaLabKind
];

type ModuleSeed = {
  id: string;
  title: string;
  domain: string;
  topics: TopicSeed[];
};

const modules: ModuleSeed[] = [
  {
    id: "foundations",
    title: "Network Foundations and the Packet Journey",
    domain: "Network fundamentals",
    topics: [
      ["Your first network: a step-by-step CCNA beginner lesson", "ccna-roadmap-and-lab-method", "Connect two practice computers, understand each command, find one wrong address and check the repair.", "Exam orientation", "Practical skills orientation", "operations"],
      ["Routers, switches, firewalls, access points, and endpoints", "network-components-and-their-jobs", "Explain what each common network component decides and forwards.", "1.1", "1.0", "operations"],
      ["Campus, WAN, SOHO, cloud, and spine-leaf topologies", "network-topologies-explained", "Compare common physical and logical designs using traffic paths and failure domains.", "1.2", "1.0", "operations"],
      ["OSI and TCP/IP models without memorization", "osi-and-tcp-ip-models", "Use layered models to locate a fault instead of merely reciting layer names.", "1.0", "1.0", "operations"],
      ["Encapsulation: what changes hop by hop", "encapsulation-and-packet-journey", "Trace frames, packets, segments, addresses, and checksums through a routed path.", "1.0", "1.0", "operations"],
      ["Copper, fiber, speed, duplex, and interface errors", "copper-fiber-speed-and-duplex", "Select media and diagnose physical-interface evidence.", "1.3", "1.1", "operations"],
      ["TCP and UDP through real applications", "tcp-versus-udp", "Choose the transport behavior that matches an application and read port evidence.", "1.4", "1.0", "operations"]
    ]
  },
  {
    id: "addressing",
    title: "IPv4 and IPv6 Addressing",
    domain: "Network fundamentals and connectivity",
    topics: [
      ["IPv4 addresses, masks, networks, and broadcasts", "ipv4-addressing-foundations", "Identify network, host, and broadcast boundaries from an IPv4 prefix.", "1.5", "1.3", "addressing"],
      ["Subnetting in a reliable four-step method", "ipv4-subnetting-four-step-method", "Calculate subnets, ranges, and broadcasts accurately under time pressure.", "1.5", "1.3", "addressing"],
      ["VLSM and an address plan that can grow", "vlsm-address-planning", "Allocate unequal subnets without overlap and leave intentional growth space.", "1.5", "1.3", "addressing"],
      ["Public, private, APIPA, and default gateways", "ipv4-address-types-and-gateways", "Recognize address scope and diagnose wrong-gateway symptoms.", "1.6", "1.3", "addressing"],
      ["IPv6 notation, prefixes, and compression", "ipv6-notation-and-prefixes", "Read, shorten, expand, and compare IPv6 prefixes correctly.", "1.7", "1.4", "addressing"],
      ["IPv6 unicast, multicast, anycast, and link-local", "ipv6-address-types", "Select the correct IPv6 address type and identify its scope.", "1.8", "1.4", "addressing"],
      ["SLAAC, modified EUI-64, and IPv6 neighbor discovery", "slaac-eui64-and-neighbor-discovery", "Explain how a host forms an address and discovers its local gateway.", "1.7-1.8", "1.4", "addressing"]
    ]
  },
  {
    id: "switching",
    title: "Switching and Network Access",
    domain: "Network access",
    topics: [
      ["Cisco IOS CLI and a safe configuration workflow", "cisco-ios-cli-workflow", "Navigate IOS modes, save evidence, change safely, and verify state.", "1.0", "2.4", "switching"],
      ["MAC learning, flooding, forwarding, and aging", "ethernet-switching-and-mac-learning", "Predict a switch decision from source and destination MAC information.", "1.11", "2.0", "switching"],
      ["VLANs and access ports", "vlans-and-access-ports", "Create broadcast boundaries and verify edge-port membership.", "2.1", "2.2", "switching"],
      ["802.1Q trunks and native VLAN behavior", "dot1q-trunks-and-native-vlan", "Carry multiple VLANs between switches and diagnose trunk mismatches.", "2.2", "2.1", "switching"],
      ["Inter-VLAN routing with router-on-a-stick", "router-on-a-stick", "Route between VLANs with tagged router subinterfaces.", "2.1-2.2", "2.1", "switching"],
      ["Inter-VLAN routing with switched virtual interfaces", "svi-inter-vlan-routing", "Use Layer 3 switch interfaces and verify gateway reachability.", "2.1", "2.1", "switching"],
      ["CDP, LLDP, and trustworthy topology documentation", "cdp-lldp-topology-validation", "Validate diagrams against directly observed neighbor evidence.", "2.3", "2.3", "switching"],
      ["EtherChannel and LACP", "etherchannel-and-lacp", "Bundle compatible links and recognize configuration consistency failures.", "2.4", "2.1", "switching"],
      ["Rapid PVST+: root bridge, roles, states, and cost", "rapid-pvst-operation", "Predict the active Layer 2 tree and its blocked paths.", "2.5", "2.5", "switching"],
      ["PortFast, BPDU guard, root guard, and loop guard", "spanning-tree-protection", "Apply Layer 2 protections at the correct trust boundary.", "2.5", "2.5", "security"],
      ["Troubleshooting a switched campus path", "switched-campus-troubleshooting", "Use interface, VLAN, trunk, MAC, LACP, and spanning-tree evidence in order.", "2.1-2.5", "2.1-2.5", "switching"]
    ]
  },
  {
    id: "wireless",
    title: "Wireless Access",
    domain: "Network access and connectivity",
    topics: [
      ["RF, bands, channels, interference, and coverage", "wireless-rf-channels-and-interference", "Explain why signal quality depends on more than visible bars.", "1.9", "1.5", "wireless"],
      ["Access points, controllers, CAPWAP, and roaming", "wireless-architecture-and-capwap", "Trace client, control, and data paths in controller-based wireless.", "2.6-2.8", "2.2", "wireless"],
      ["WLANs, SSIDs, VLANs, WPA2, and authentication", "wlan-configuration-and-security", "Map a secure wireless service from radio to policy and wired VLAN.", "2.9, 5.9-5.10", "1.5, 2.2", "wireless"],
      ["Wireless client troubleshooting", "wireless-client-troubleshooting", "Separate RF, authentication, DHCP, DNS, and upstream routing failures.", "1.9, 2.6-2.9", "1.6", "wireless"]
    ]
  },
  {
    id: "routing",
    title: "IP Routing and Resilient Paths",
    domain: "IP connectivity and routing",
    topics: [
      ["Reading the routing table and choosing a route", "routing-table-and-longest-prefix", "Use prefix length, administrative distance, metric, and next hop correctly.", "3.1-3.2", "3.1", "routing"],
      ["IPv4 static routes", "ipv4-static-routes", "Configure and verify next-hop, exit-interface, and fully specified routes.", "3.3", "3.2", "routing"],
      ["Default, host, and floating static routes", "default-host-and-floating-routes", "Use route specificity and administrative distance for primary and backup paths.", "3.3", "3.2", "routing"],
      ["IPv6 static routes", "ipv6-static-routes", "Build and troubleshoot static IPv6 reachability.", "3.3", "3.2", "routing"],
      ["Single-area OSPFv2 neighbors and router IDs", "ospfv2-neighbors-and-router-id", "Form stable OSPF adjacencies and explain neighbor prerequisites.", "3.4", "3.3", "routing"],
      ["OSPF broadcast networks, DR/BDR, and path cost", "ospf-broadcast-dr-bdr-and-cost", "Interpret multiaccess elections and best-path decisions.", "3.4", "3.3", "routing"],
      ["OSPFv3 for IPv6: the v2.0 bridge", "ospfv3-for-ipv6", "Apply the same link-state reasoning to IPv6 routing.", "Extension", "3.3", "routing"],
      ["HSRP, VRRP, and first-hop resilience", "first-hop-redundancy", "Interpret active gateway state and explain what redundancy does not protect.", "3.5", "3.4", "routing"]
    ]
  },
  {
    id: "services",
    title: "Network Services and Observability",
    domain: "IP services and network operations",
    topics: [
      ["DHCPv4 clients, servers, and relay", "dhcpv4-and-relay", "Trace the lease exchange and configure relay across a router.", "4.3, 4.6", "1.7", "operations"],
      ["DNS records and name-resolution troubleshooting", "dns-records-and-troubleshooting", "Use A, AAAA, CNAME, MX, NS, and PTR evidence to isolate a failure.", "4.3", "4.4", "operations"],
      ["NAT and PAT from inside local to outside global", "nat-and-pat", "Configure address translation and read the translation table.", "4.1", "4.3", "operations"],
      ["NTP and why trustworthy time matters", "ntp-and-network-time", "Configure time synchronization and connect clock accuracy to logs and certificates.", "4.2", "5.0", "operations"],
      ["QoS classification, marking, queuing, and congestion", "qos-foundations", "Explain how delay, jitter, and loss shape application experience.", "4.7", "5.0", "operations"],
      ["SNMP, baselines, and meaningful monitoring", "snmp-and-network-monitoring", "Explain polling, traps, object identifiers, and the limits of availability-only monitoring.", "4.4", "5.4", "operations"],
      ["Syslog severity, facilities, and an incident timeline", "syslog-and-incident-timelines", "Interpret messages in context and preserve time-aligned evidence.", "4.5", "5.6", "operations"],
      ["Secure administration with SSH, SCP, and configuration evidence", "ssh-scp-and-secure-administration", "Protect management access and move files over authenticated encrypted channels.", "4.8-4.9", "4.2", "security"]
    ]
  },
  {
    id: "security",
    title: "Security-First Network Operations",
    domain: "Security fundamentals and services",
    topics: [
      ["Threats, vulnerabilities, exploits, and risk", "threats-vulnerabilities-exploits-and-risk", "Separate the terms and connect them to an actionable network decision.", "5.1-5.2", "4.0", "security"],
      ["Device hardening and management-plane boundaries", "device-hardening-and-management-plane", "Reduce administrative exposure and verify the intended management path.", "5.3-5.4", "4.1-4.2", "security"],
      ["AAA with local users, TACACS+, and RADIUS", "aaa-tacacs-and-radius", "Choose authentication, authorization, and accounting controls for network administration.", "5.3, 5.8", "4.1", "security"],
      ["Standard IPv4 ACLs", "standard-ipv4-acls", "Place and verify source-only access control lists without unintended denial.", "5.6", "4.6", "security"],
      ["Extended IPv4 ACLs", "extended-ipv4-acls", "Filter protocol, source, destination, and port with deliberate placement.", "5.6", "4.6", "security"],
      ["Port security, DHCP snooping, and Dynamic ARP Inspection", "layer2-security-controls", "Build a trusted Layer 2 edge and understand control dependencies.", "5.7", "4.7", "security"],
      ["Storm control and IPv6 RA guard", "storm-control-and-ra-guard", "Limit disruptive Layer 2 traffic and block rogue IPv6 router advertisements.", "5.7", "4.7", "security"],
      ["IPsec site-to-site and remote-access VPNs", "ipsec-vpn-foundations", "Explain the security associations and traffic path without treating a VPN as universal trust.", "5.5", "4.5", "security"]
    ]
  },
  {
    id: "modern-operations",
    title: "Cloud, Automation, AI, and the Capstone",
    domain: "Automation and network operations",
    topics: [
      ["Virtual machines, containers, and cloud network boundaries", "virtualization-containers-and-cloud-networks", "Map virtual workloads to physical paths, policy, and failure domains.", "1.10", "1.2", "operations"],
      ["Controller-based networking, overlays, underlays, and fabrics", "controller-based-networking", "Explain how intent reaches the forwarding plane and where evidence lives.", "6.2-6.3", "5.3", "automation"],
      ["REST APIs, CRUD, authentication, and HTTP evidence", "rest-api-foundations", "Read a request and response safely without guessing from a status code alone.", "6.5", "5.0", "automation"],
      ["JSON for network engineers", "json-for-network-engineers", "Navigate objects, arrays, names, and values in operational API output.", "6.7", "5.0", "automation"],
      ["Ansible and Terraform: configuration versus state", "ansible-and-terraform", "Recognize where each automation approach helps and what must still be validated.", "6.6", "5.5", "automation"],
      ["AI prompts, agentic assistants, and safe network operations", "ai-prompts-and-network-operations", "Use AI to support diagnosis while protecting data and independently verifying recommendations.", "6.4", "5.1-5.2", "automation"],
      ["CCNA capstone: diagnose, repair, verify, and explain", "ccna-capstone-network-recovery", "Recover a small dual-stack campus by connecting physical, switching, routing, services, security, and evidence.", "All domains", "All domains", "operations"]
    ]
  }
];

export const ccnaCurriculum: CcnaCurriculumTopic[] = modules.flatMap((module) =>
  module.topics.map(([title, slug, objective, v11, v20, labKind], index) => {
    const prior = modules.slice(0, modules.indexOf(module)).reduce((count, item) => count + item.topics.length, 0);
    const sequence = prior + index + 1;
    return {
      sequence,
      week: Math.ceil(sequence / 5),
      day: ((sequence - 1) % 5) + 1,
      moduleId: module.id,
      moduleTitle: module.title,
      domain: module.domain,
      title,
      slug,
      objective,
      v11,
      v20,
      labKind
    };
  })
);

export const ccnaModules = modules.map((module) => ({
  id: module.id,
  title: module.title,
  domain: module.domain,
  topics: ccnaCurriculum.filter((topic) => topic.moduleId === module.id)
}));

export const ccnaOfficialSources = [
  {
    label: "Cisco 200-301 CCNA exam overview (current v1.1)",
    url: "https://www.cisco.com/site/us/en/learn/training-certifications/exams/ccna.html"
  },
  {
    label: "Cisco 200-301 CCNA v2.0 exam topics",
    url: "https://learningcontent.cisco.com/documents/marketing/exam-topics/200-301_CCNA_v2.0_Exam_Topics_PDF.pdf"
  },
  {
    label: "Cisco guidance for the February 2027 CCNA transition",
    url: "https://blogs.cisco.com/learning/stay-on-track-get-certified-before-the-ccna-refresh"
  },
  {
    label: "GNS3 first Cisco topology guide",
    url: "https://docs.gns3.com/docs/getting-started/your-first-cisco-topology"
  },
  {
    label: "GNS3 Cisco image licensing guidance",
    url: "https://docs.gns3.com/docs/troubleshooting-faq/where-do-i-get-ios-images"
  },
  {
    label: "Cisco Modeling Labs VM image licensing boundary",
    url: "https://developer.cisco.com/docs/modeling-labs/vm-images-for-cml-labs/"
  }
] as const;

export const ccnaCourseFacts = {
  currentVersion: "200-301 CCNA v1.1",
  currentLastTestDate: "2027-02-02",
  nextVersion: "200-301 CCNA v2.0",
  nextLaunchDate: "2027-02-03",
  durationMinutes: 120,
  weekdayLessons: ccnaCurriculum.length,
  weeks: Math.ceil(ccnaCurriculum.length / 5)
} as const;

export function ccnaTopicBySlug(slug: string) {
  return ccnaCurriculum.find((topic) => topic.slug === slug);
}
