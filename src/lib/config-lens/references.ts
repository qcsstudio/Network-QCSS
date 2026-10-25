export const RULES_REVIEWED = "2026-10-26";
export const commandReferences = {
  ciscoDhcp: { title: "Cisco IOS XE 17.x: DHCP server", url: "https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/ip-addressing/b-ip-addressing/m_config-dhcp-server-xe.html" },
  ciscoDns: { title: "Cisco IOS XE 17.x: DNS", url: "https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/ip-addressing/b-ip-addressing/m_configuring_dns.html" },
  ciscoStp: { title: "Catalyst IOS XE 17.15: spanning-tree protections", url: "https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9200/software/release/17-15/configuration_guide/lyr2/b_1715_lyr2_9200_cg/configuring_optional_spanning_tree_features.html" },
  ciscoOspf: { title: "Cisco IOS XE 17.x: OSPF interfaces", url: "https://www.cisco.com/c/en/us/td/docs/routers/ios/config/17-x/ip-routing/b-ip-routing/m_iro-cfg-0.html" },
  fortiPolicy: { title: "FortiOS 7.4.7: firewall policy options", url: "https://docs.fortinet.com/document/fortigate/7.4.7/administration-guide/656084" },
  fortiDhcp: { title: "FortiOS 7.4.9: DHCP server", url: "https://docs.fortinet.com/document/fortigate/7.4.9/cli-reference/121865377/config-system-dhcp-server" },
  fortiDns: { title: "FortiOS 7.4.7: DNS commands", url: "https://docs.fortinet.com/document/fortigate/7.4.7/administration-guide/903162/important-dns-cli-commands" },
  fortiNtp: { title: "FortiOS 7.4.4: system time", url: "https://docs.fortinet.com/document/fortigate/7.4.4/administration-guide/512210/setting-the-system-time" },
  fortiSdwan: { title: "FortiOS 7.4.5: SD-WAN members and zones", url: "https://docs.fortinet.com/document/fortigate/7.4.5/administration-guide/942095" },
  fortiHealth: { title: "FortiOS 7.4.9: link health monitor", url: "https://docs.fortinet.com/document/fortigate/7.4.9/administration-guide/580649/link-health-monitor" },
  fortiLogs: { title: "FortiOS 7.4.9: log targets and filters", url: "https://docs.fortinet.com/document/fortigate/7.4.9/administration-guide/250999/log-settings-and-targets" },
  fortiPickup: { title: "FortiOS 7.4.7: HA session pickup", url: "https://docs.fortinet.com/document/fortigate/7.4.7/administration-guide/955521/session-pickup" },
} as const;
export type CommandReference = keyof typeof commandReferences;
