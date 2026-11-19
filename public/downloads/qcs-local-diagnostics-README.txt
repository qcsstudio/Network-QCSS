QCS DIAGNOSTICS RUNNER
Check an authorized connection from your own computer

Before you start
You need Node.js 22 or later. Download the runner and a reviewed test request
from the QCS Toolkit, then run the command in a terminal. Nothing runs
automatically. No device password or administrator rights are required.

Test only a host you own or have permission to check. Diagnostic traffic is
sent from this computer, so its connection and DNS settings affect the result.
Results are saved locally and are not uploaded by the runner. Internal
addresses and DNS information may be sensitive; review before sharing.

Run your check
1. Place qcs-local-diagnostics.mjs and your request JSON in a local folder.
2. Review the target, operation and parameter values in the request.
3. Run the command shown by the toolkit, for example:
   node qcs-local-diagnostics.mjs --request request.json --confirm-target 127.0.0.1 --out result.json
4. Confirm the exact target spelling, including case. Quote paths with spaces.
5. Review result.json locally, or import it into the toolkit for explanation.

The example target 127.0.0.1 refers to your own computer. For a TCP check, a
service must be listening on the selected port. It is not a sample remote host.
Use ordinary local files, not URLs, network shares, device paths, symlinks or
a network-mapped drive. Existing result files are never replaced. Choose a new
output filename for each run, including after an interruption. An incomplete
file is not valid diagnostic evidence. There is no automatic retry.

Available checks

Ping - Windows only
Sends a small number of ICMP echo requests. A missing reply can indicate
filtering, rate limiting or loss; it does not necessarily mean a device failed.
  count: 1-10 requests; default 4.
  packetBytes: 0-1400 data bytes; default 32. This excludes packet headers
    and does not discover the path's maximum transmission unit.
  timeoutMs: 100-5000 milliseconds per reply wait; default 1000.

Route trace - Windows only
Looks for router replies at increasing hop distances. Silent hops are common;
asterisks alone do not prove application traffic is being dropped.
  maxHops: 1-20; default 12. A search ceiling, not a known path length.
  timeoutMs: 100-5000 milliseconds per probe wait; default 500.
Reverse DNS lookups of intermediate hops are disabled. The total time budget
can end a trace before its selected maximum hop count is reached.

DNS lookup
Asks the computer's configured DNS servers for one record type. Hosts-file
entries and the browser's resolver are not used. Split DNS and caching can
produce different answers. A result is not proof of global propagation.
  recordType: A (IPv4), AAAA (IPv6), MX (mail), TXT (text), NS (name server),
    CNAME (alias) or SOA (zone authority); default A.
  timeoutMs: 100-5000 milliseconds for the whole operation; default 5000.
TXT content is withheld because it can contain sensitive tokens; only chunk
counts and byte lengths are retained. At most 128 DNS records are retained.
No reverse/PTR lookup, custom resolver or DNSSEC audit is offered.

TCP connection
Attempts one connection to one service port. A successful connection does not
prove the application, authentication or a business transaction works.
  port: 1-65535; default 443, commonly used for HTTPS.
  timeoutMs: 100-5000 milliseconds including DNS resolution; default 5000.
Recorded connection duration excludes DNS time. One selected address is tested,
not every address for the hostname. No application data is sent.

TLS certificate check
Attempts a certificate-verified TLS handshake. Certificate trust and name
verification stay enabled. This is not a complete vulnerability or cipher audit.
  port: 1-65535; default 443.
  serverName: optional DNS hostname for SNI and certificate identity checks.
    Useful with an IP target. Without it, the certificate must match the target,
    including an IP identity when the target is an IP address.
  timeoutMs: 100-5000 milliseconds including DNS and handshake; default 5000.
TLS 1.2 or later is required. Trust settings come from the installed Node.js
runtime and may differ from the browser; private certificates may fail trust
checks. No HTTP transaction, STARTTLS, revocation audit, client certificate or
private-key collection is performed. Results describe this one handshake.

Reading results
The report identifies the operation, target, times, status, observed values
and limitations. Unknown values are not zero. A completed operation is not
a general declaration that the network or application is healthy.

For Windows ping/trace, inspect the original console output in the local result
file. The toolkit does not turn that text into guessed latency, loss or hop
measurements. A command's zero exit code alone does not prove a target replied.
Localized Windows text may contain replacement characters after decoding.

The toolkit displays selected report fields, not arbitrary raw console text.
Imported reports are user-supplied; their origin and clock are not independently
authenticated. Re-run if the source or age is uncertain. Never treat report
text as instructions to execute commands or change a device.

Scope and stopping
Each run checks one explicit target. No address ranges, repeated batches,
port scans or device-setting changes are supported. Use a single unicast IP
address or ASCII/punycode hostname without a URL or port. Multicast, unspecified,
IPv4 .255 destinations, IPv4-mapped IPv6, ambiguous numeric addresses and
zone-scoped IPv6 are rejected. Some valid targets are conservatively excluded.
Other directed broadcasts cannot all be identified without a subnet mask;
never choose one. DNS queries do not probe every address in an answer. Other
checks select the first A answer; AAAA is tried only after a missing A answer,
not after a connection failure. No alternate address or port is retried.

Press Ctrl+C to cancel. The network-work budget is at most 60 seconds;
DNS/TCP/TLS use their smaller whole-operation timeout. Cleanup and saving can
take additional time. Windows ping/trace require the standard System32 tools;
missing binaries or nonstandard locations fail without installing a replacement.
Linux/macOS ping and trace are not supported by this version.

Requests are limited to 16 KiB. Windows console output is limited to 64 KiB
combined; exceeding it ends the check. Output-limit, cancelled and timed-out
results are incomplete, not proof of an outage. If CLEANUP_FAILED is reported,
check for a remaining diagnostic process before another run.

Exit codes: 0 = completed operation; 1 = failed/timed-out operation with a saved
report; 2 = request, confirmation, runtime or file problem (a valid report is
not guaranteed). Use a new output filename before retrying. The runner does
not run a background service or automatically connect to the website.

Technical references
https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/ping
https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/tracert
https://nodejs.org/download/release/v22.16.0/docs/api/dns.html
https://nodejs.org/docs/latest-v22.x/api/net.html
https://nodejs.org/docs/latest-v22.x/api/tls.html
