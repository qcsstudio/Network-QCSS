import net from "node:net";

type DetailValue = string | number | boolean | string[] | Record<string, string | number | boolean>[];

type ScriptDetail = {
  label: string;
  value: DetailValue;
};

export type VendorTaskScriptResult = {
  target: string;
  status: "ok" | "warning";
  summary: string;
  details: ScriptDetail[];
};

const vendorLabels: Record<string, string> = {
  "cisco-ios-xe": "Cisco IOS XE router or switch",
  "cisco-asa": "Cisco ASA firewall",
  fortigate: "FortiGate FortiOS firewall",
  "juniper-junos": "Juniper Junos / SRX"
};

const taskLabels: Record<string, string> = {
  "packet-capture": "Packet capture",
  "interface-health": "Interface health evidence",
  "route-neighbor": "Route and neighbor evidence",
  "vpn-evidence": "VPN tunnel evidence"
};

function textValue(params: Record<string, unknown>, key: string, fallback = "") {
  const value = params[key];
  if (typeof value === "number") return String(value);
  return typeof value === "string" ? value.trim() : fallback;
}

function selectValue(params: Record<string, unknown>, key: string, allowed: string[], fallback: string) {
  const value = textValue(params, key, fallback);
  return allowed.includes(value) ? value : fallback;
}

function boundedInt(params: Record<string, unknown>, key: string, fallback: number, min: number, max: number) {
  const raw = params[key];
  const parsed = typeof raw === "number" ? raw : Number(textValue(params, key));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function optionalPort(params: Record<string, unknown>) {
  const raw = textValue(params, "port");
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("Port must be a number between 1 and 65535.");
  }
  return parsed;
}

function optionalIp(params: Record<string, unknown>, key: string) {
  const value = textValue(params, key);
  if (!value) return "";
  if (!net.isIP(value)) throw new Error(`${key === "sourceIp" ? "Source" : "Destination"} IP must be a valid IPv4 or IPv6 address.`);
  return value;
}

function safeInterface(params: Record<string, unknown>) {
  const value = textValue(params, "interfaceName");
  if (!value) return "<interface-name>";
  if (!/^[a-zA-Z0-9_./: -]{1,64}$/.test(value)) {
    throw new Error("Interface name contains unsupported characters.");
  }
  return value;
}

function safeCaptureName(params: Record<string, unknown>) {
  const value = textValue(params, "captureName", "qcs_cap") || "qcs_cap";
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
  return normalized || "qcs_cap";
}

function aclLine(protocol: string, sourceIp: string, destinationIp: string, port?: number) {
  const src = sourceIp ? `host ${sourceIp}` : "any";
  const dst = destinationIp ? `host ${destinationIp}` : "any";
  if ((protocol === "tcp" || protocol === "udp") && port) return `permit ${protocol} ${src} ${dst} eq ${port}`;
  return `permit ${protocol} ${src} ${dst}`;
}

function bpfFilter(protocol: string, sourceIp: string, destinationIp: string, port?: number) {
  const parts: string[] = [];
  if (protocol !== "ip") parts.push(protocol);
  if (sourceIp && destinationIp) parts.push(`host ${sourceIp} and host ${destinationIp}`);
  else if (sourceIp) parts.push(`host ${sourceIp}`);
  else if (destinationIp) parts.push(`host ${destinationIp}`);
  if ((protocol === "tcp" || protocol === "udp") && port) parts.push(`port ${port}`);
  return parts.length ? parts.join(" and ") : "ip";
}

function packetCaptureCommands(input: ScriptInput) {
  const aclName = `${input.captureName.toUpperCase()}_ACL`;
  const filter = bpfFilter(input.protocol, input.sourceIp, input.destinationIp, input.port);
  const acl = aclLine(input.protocol, input.sourceIp, input.destinationIp, input.port);

  if (input.vendor === "cisco-ios-xe") {
    return {
      prepare: [
        "terminal length 0",
        "configure terminal",
        `ip access-list extended ${aclName}`,
        ` ${acl}`,
        "end"
      ],
      run: [
        `monitor capture ${input.captureName} access-list ${aclName}`,
        `monitor capture ${input.captureName} interface ${input.interfaceName} both`,
        `monitor capture ${input.captureName} buffer circular size 10`,
        `monitor capture ${input.captureName} limit duration ${input.durationSeconds}`,
        `monitor capture ${input.captureName} limit packets ${input.packetCount}`,
        `monitor capture ${input.captureName} start`
      ],
      validate: [
        `show monitor capture ${input.captureName} parameter`,
        `show monitor capture ${input.captureName} buffer brief`
      ],
      stop: [
        `monitor capture ${input.captureName} stop`,
        `monitor capture ${input.captureName} export bootflash:${input.captureName}.pcap`,
        `no monitor capture ${input.captureName}`,
        "configure terminal",
        `no ip access-list extended ${aclName}`,
        "end"
      ]
    };
  }

  if (input.vendor === "cisco-asa") {
    return {
      prepare: [
        "terminal pager 0",
        `access-list ${aclName} extended ${acl}`,
        `show access-list ${aclName}`
      ],
      run: [
        `capture ${input.captureName} interface ${input.interfaceName} access-list ${aclName} packet-length 1518 circular-buffer buffer 10485760`
      ],
      validate: [
        `show capture ${input.captureName}`,
        `show capture ${input.captureName} detail`
      ],
      stop: [
        `copy /pcap capture:${input.captureName} disk0:/${input.captureName}.pcap`,
        `no capture ${input.captureName}`,
        `clear configure access-list ${aclName}`
      ]
    };
  }

  if (input.vendor === "fortigate") {
    return {
      prepare: ["config system console", "set output standard", "end"],
      run: [`diagnose sniffer packet ${input.interfaceName} '${filter}' 4 ${input.packetCount} a`],
      validate: [
        "Confirm packets show the expected source, destination, port, and direction.",
        "If no packets appear, verify interface selection, policy route, NAT, and session table."
      ],
      stop: ["The sniffer stops automatically after the packet count. Use Ctrl+C if you used an unlimited count."]
    };
  }

  return {
    prepare: ["set cli screen-length 0"],
    run: [`monitor traffic interface ${input.interfaceName} matching "${filter}" size 1500 count ${input.packetCount} detail`],
    validate: [
      "Confirm packets show the expected source, destination, protocol, and port.",
      "For transit traffic on SRX, verify whether the platform requires flow trace, sampling, or port mirroring instead."
    ],
    stop: ["The monitor stops automatically after the count. Use Ctrl+C if you started an unlimited capture."]
  };
}

function interfaceCommands(input: ScriptInput) {
  if (input.vendor === "cisco-ios-xe") {
    return [
      "terminal length 0",
      `show interfaces ${input.interfaceName}`,
      `show interfaces ${input.interfaceName} counters errors`,
      `show logging | include ${input.interfaceName}`,
      "show ip interface brief"
    ];
  }
  if (input.vendor === "cisco-asa") {
    return [
      "terminal pager 0",
      `show interface ${input.interfaceName}`,
      "show interface ip brief",
      "show traffic",
      `show logging | include ${input.interfaceName}`
    ];
  }
  if (input.vendor === "fortigate") {
    return [
      "config system console",
      "set output standard",
      "end",
      "get system interface physical",
      `diagnose hardware deviceinfo nic ${input.interfaceName}`,
      `diagnose netlink interface list ${input.interfaceName}`
    ];
  }
  return [
    "set cli screen-length 0",
    `show interfaces ${input.interfaceName} extensive`,
    `show interfaces diagnostics optics ${input.interfaceName}`,
    `show log messages | match ${input.interfaceName}`
  ];
}

function routeCommands(input: ScriptInput) {
  const destination = input.destinationIp || "<destination-ip>";
  const source = input.sourceIp || "<source-ip>";
  const port = input.port || 443;

  if (input.vendor === "cisco-ios-xe") {
    return [
      "terminal length 0",
      `show ip route ${destination}`,
      `show ip cef ${destination} detail`,
      `show arp | include ${destination}`,
      "show ip interface brief"
    ];
  }
  if (input.vendor === "cisco-asa") {
    return [
      "terminal pager 0",
      `show route ${destination}`,
      `packet-tracer input ${input.interfaceName} ${input.protocol === "ip" ? "tcp" : input.protocol} ${source} 12345 ${destination} ${port} detailed`,
      `show arp | include ${destination}`,
      `show conn address ${destination}`
    ];
  }
  if (input.vendor === "fortigate") {
    return [
      "config system console",
      "set output standard",
      "end",
      `diagnose ip route get ${destination}`,
      `get router info routing-table details ${destination}`,
      `get system arp | grep ${destination}`,
      `diagnose sys session filter dst ${destination}`,
      "diagnose sys session list"
    ];
  }
  return [
    "set cli screen-length 0",
    `show route ${destination} extensive`,
    `show route forwarding-table destination ${destination}`,
    `show arp no-resolve | match ${destination}`,
    `show security flow session source-prefix ${source} destination-prefix ${destination}`
  ];
}

function vpnCommands(input: ScriptInput) {
  const peer = input.destinationIp || "<vpn-peer-ip>";

  if (input.vendor === "cisco-ios-xe") {
    return [
      "terminal length 0",
      "show crypto ikev2 sa detail",
      "show crypto ipsec sa",
      `show crypto session remote ${peer} detail`,
      "show logging | include IKE|IPSEC|CRYPTO"
    ];
  }
  if (input.vendor === "cisco-asa") {
    return [
      "terminal pager 0",
      "show vpn-sessiondb l2l",
      "show crypto ikev1 sa",
      "show crypto ikev2 sa",
      "show crypto ipsec sa",
      `show logging | include ${peer}`
    ];
  }
  if (input.vendor === "fortigate") {
    return [
      "config system console",
      "set output standard",
      "end",
      "get vpn ipsec tunnel summary",
      "diagnose vpn tunnel list",
      "diagnose vpn ike gateway list",
      `diagnose vpn tunnel list | grep -f ${peer}`
    ];
  }
  return [
    "set cli screen-length 0",
    "show security ike security-associations",
    "show security ipsec security-associations",
    `show security ike security-associations | match ${peer}`,
    `show security flow session destination-prefix ${peer}`
  ];
}

type ScriptInput = {
  vendor: string;
  task: string;
  interfaceName: string;
  sourceIp: string;
  destinationIp: string;
  protocol: string;
  port?: number;
  packetCount: number;
  durationSeconds: number;
  captureName: string;
};

function normalizeInput(params: Record<string, unknown>): ScriptInput {
  const vendor = selectValue(params, "vendor", Object.keys(vendorLabels), "cisco-ios-xe");
  const task = selectValue(params, "task", Object.keys(taskLabels), "packet-capture");
  const protocol = selectValue(params, "protocol", ["tcp", "udp", "icmp", "ip"], "tcp");

  return {
    vendor,
    task,
    interfaceName: safeInterface(params),
    sourceIp: optionalIp(params, "sourceIp"),
    destinationIp: optionalIp(params, "destinationIp"),
    protocol,
    port: optionalPort(params),
    packetCount: boundedInt(params, "packetCount", 100, 1, 5000),
    durationSeconds: boundedInt(params, "durationSeconds", 120, 10, 3600),
    captureName: safeCaptureName(params)
  };
}

function safetyNotes(input: ScriptInput) {
  const notes = [
    "Use during an approved change or incident bridge and confirm device CPU, memory, and storage before capture.",
    "Prefer narrow source, destination, protocol, and port filters. Avoid broad captures on high-throughput interfaces.",
    "Capture only the minimum traffic needed and handle packet data as sensitive evidence.",
    "Confirm exact platform, software release, VDOM/context/routing-instance, and interface naming before running."
  ];

  if (input.interfaceName === "<interface-name>") notes.unshift("Interface is a placeholder. Replace it with the exact production interface before use.");
  if (!input.sourceIp && !input.destinationIp) notes.unshift("No endpoint filter was provided, so packet-capture commands may be broad.");
  if (input.protocol === "ip" && !input.port) notes.unshift("Any-IP capture is broad. Add protocol, source, destination, or port when possible.");
  return notes;
}

export function generateVendorTaskScript(params: Record<string, unknown>): VendorTaskScriptResult {
  const input = normalizeInput(params);
  const scenario = `${vendorLabels[input.vendor]} - ${taskLabels[input.task]}`;
  const warnings = safetyNotes(input);
  const hasWarning = warnings.length > 4;

  if (input.task === "packet-capture") {
    const commands = packetCaptureCommands(input);
    return {
      target: scenario,
      status: hasWarning ? "warning" : "ok",
      summary: `Generated a controlled packet-capture plan for ${vendorLabels[input.vendor]}.`,
      details: [
        {
          label: "Scenario",
          value: [
            {
              vendor: vendorLabels[input.vendor],
              task: taskLabels[input.task],
              interface: input.interfaceName,
              filter: bpfFilter(input.protocol, input.sourceIp, input.destinationIp, input.port)
            }
          ]
        },
        { label: "Prepare commands", value: commands.prepare },
        { label: "Run commands", value: commands.run },
        { label: "Validate commands", value: commands.validate },
        { label: "Stop and cleanup", value: commands.stop },
        { label: "Safety notes", value: warnings }
      ]
    };
  }

  const commandList =
    input.task === "interface-health"
      ? interfaceCommands(input)
      : input.task === "route-neighbor"
        ? routeCommands(input)
        : vpnCommands(input);

  return {
    target: scenario,
    status: hasWarning ? "warning" : "ok",
    summary: `Generated an evidence-collection plan for ${vendorLabels[input.vendor]}.`,
    details: [
      {
        label: "Scenario",
        value: [
          {
            vendor: vendorLabels[input.vendor],
            task: taskLabels[input.task],
            interface: input.interfaceName,
            source: input.sourceIp || "Not specified",
            destination: input.destinationIp || "Not specified"
          }
        ]
      },
      { label: "Evidence commands", value: commandList },
      {
        label: "How to use the output",
        value: [
          "Run show/diagnose commands first and save raw output before making changes.",
          "Compare control-plane evidence, forwarding path, logs, and packet/session evidence.",
          "Escalate with timestamps, topology context, command output, and affected user/application examples."
        ]
      },
      { label: "Safety notes", value: warnings }
    ]
  };
}
