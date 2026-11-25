# Network Configuration Analyzer — Release 1

Approved scope: 25 November 2026. Canonical entry retains `/network-tools/network-configuration-explainer` so existing links and the private-document security policy continue to work. Directory display name: Network Configuration Analyzer; legacy search alias: Config Lens.

## Delivery boundary

This change implements the input and validation workflow and connects it to the existing local explanation engine. Before/After inputs receive independent validation and can be opened individually. It does not yet implement the approved baseline evaluation pack, semantic change assessment or the PDF/HTML/JSON/CSV report suite. Readiness and explanation coverage never represent a baseline Pass.

## Agreed assessment requirements

- Eight profiles: IOS/IOS XE routers; Catalyst; Nexus 9000; ASA; diagnostic-only FTD; FortiGate; standalone FortiSwitch; FortiWeb.
- Fortinet 8.0 is preview-only across all three Fortinet profiles, including reports and comparisons.
- QCS Network Configuration Security Baseline v1.0 — Production. Controls are version/model/context dependent. Results: Pass, Fail, Review, Unknown, Not applicable. Overall: Pass, Fail, Incomplete or Preview. Accepted risk preserves the original failure and has an owner, reason and expiry.
- Primary target trains: IOS XE 17.12/17.15/17.18; NX-OS 10.4/10.5/10.6; ASA 9.18/9.20/9.22; FTD 7.4/7.6/10.0 diagnostic only; Fortinet 7.4/7.6. Compatibility coverage remains limited. Targets describe analyzer coverage, not vendor upgrade recommendations or completed validation of every model/build.
- Reports: executive summary; assessment details; coverage; finding register and evidence; explanation/relationships; before/after comparison; remediation plan; appendix.
- Planned exports: PDF, standalone HTML, versioned JSON, spreadsheet-oriented CSV and redacted text diff. Filtered extracts retain full-assessment status and limitations. Known secrets stay masked; sharing mode uses consistent identifier aliases.
- Remediation: expected outcome, prerequisites, supported candidate changes or templates, impact, sequence, verification, rollback and closure evidence. Unsupported or missing evidence cannot establish resolution.
- Each of the 15 agreed Toolkit utilities receives its own named/searchable directory entry as its individual scope is implemented. This change updates the existing configuration-tool entry and directory keyword indexing, without duplicating the card.

## Implemented input policy

Paste or select plaintext CLI configuration files. Picker extensions: `.txt`, `.cfg`, `.conf`, `.log`, plus the existing `.config` compatibility extension. Content, not the extension or MIME type, determines acceptance. No encrypted backup decryption, archives, binary files, images, office documents, controller/API JSON/XML/YAML or remote collection.

UTF-8/ASCII, optional UTF-8 BOM and BOM-identified UTF-16 LE/BE are accepted. Invalid sequences fail rather than receiving replacement characters. UTF-16 conversion is disclosed. CRLF, LF and CR normalize with physical source-line positions retained.

Limits per configuration:

- Original file: 10 MiB (10,485,760 bytes).
- Decoded UTF-8 text: 10 MiB, before line-ending normalization.
- Physical lines: 100,000, including blank lines.
- Individual physical line: 64 KiB in UTF-8.
- One input or one Before/After pair; each side must independently satisfy every limit.
- One active worker job. Main-thread deadline: 30 seconds for one input; 60 seconds for a pair.
- Parser reference budget: 100,000 references. Exceeding it stops the job with an incomplete assessment; graphs are never silently truncated.

These are bounded engineering limits, not a guarantee that every maximum-size input will finish on every device. Test the actual parser and responsive cancellation using synthetic boundary fixtures before release.

Independent metadata: running/saved/candidate/unknown; entire/fragment/unknown; device/global/named VDOM/single context/unknown; defaults included/omitted/unknown. Record a device alias, model, purpose and exact version/build when available. User declarations are not independent verification.

Detected vendor, recognized header model and software version appear beside declared model/version values. Header/declared version conflicts block version-dependent interpretation; differing model labels require review. Header facts are not live hardware inventory or proof of export authenticity.

Flow: choose one input or a pair → import → identify profile/version → declare scope → bounded decode/parse/masking → review Ready / Ready with limitations / Blocked / Preview → open an explanation. A blocked input is not a device-security Fail.

Comparisons require the same profile, declared device alias and administrative scope/name. Different running/saved/candidate states produce a visible notice. Missing information remains unknown. Every edit, profile change, mode switch or cancellation invalidates previous results and closes export review. Clear removes both inputs and current results. No configuration is stored in localStorage, IndexedDB, cookies or a backend.

The worker only returns masked explanations and controlled diagnostics. Source filenames and raw values do not appear in failure messages. Quoted Fortinet values, Cisco banners and PEM contents are not treated as configuration commands for input identification. Malformed block structure is rejected by the existing parser.

## Operator SOP for the implemented workflow

1. Obtain an authorized plaintext export for one device and record its origin/time outside this tool as required by the engagement.
2. Open the dedicated Configuration Analyzer page through the Network Tools directory. Confirm the on-device/read-only indicator.
3. Select the correct profile and OS train. Add the exact build and model when available; avoid guessing.
4. Declare capture completeness, configuration state, administrative scope/name and default visibility independently. For a pair, label and identify Before and After correctly.
5. Select the file or paste text. Run Validate configuration. Resolve blocked inputs by obtaining a clean export; do not edit away findings or bypass limits.
6. Review every readiness limitation. FTD remains diagnostic-only; Fortinet 8.0 remains Preview. Open the relevant explanation only after reviewing these limits.
7. Inspect unsupported statements and source references. The relationship view identifies configured references, not physical links or verified traffic.
8. Review the masked text before using the current explanation download. It is not a restorable backup. Keep confidential identifiers within the engagement's handling requirements.
9. Use independently approved change procedures for any device remediation. Clear the workspace when finished.

## Acceptance checks

Boundary tests cover exact bytes/lines, multibyte line length, UTF BOMs/chunk boundaries, malformed text, short/oversized streams, wrong vendor/family, mixed captures, version conflicts, embedded-text spoofing, eight profile targets, preview/FTD limits and mismatched comparison identity/context.

Browser tests cover review-before-explanation, secret canaries in worker/report output and network requests, stale results, local files, both input slots, cancellation/deadlines, search aliases, 1440/390/320-pixel layouts, reduced motion and serious/critical accessibility violations. Existing parser/security/relationship tests remain regression requirements.

After `npm run build`, run `npm run test:config-analyzer-ui`. The runner starts a loopback-only production-mode server, generates an independent session secret in memory, gives the same value to the local server and test process, and stops the server on completion. It disables database URLs and the admin API token for this local run. No secret is written to a file or taken from production. Additional Playwright selections can be passed directly to the runner.

## Approved baseline contract for the next implementation phase

The Production default requires restricted management sources; SSHv2/HTTPS; named least-privilege administrators and applicable AAA/accounting/MFA; administrative idle timeout at most 10 minutes; supported login throttling; supported strong credential storage; SNMPv3 authPriv with scoped permissions; remote security logging and approved time sources; declared traffic boundaries; TLS minimum 1.2 and applicable IKEv2; resolved configuration dependencies. Each control remains model/version/mode/context dependent. External enforcement and live effectiveness require separate evidence.

Profile overlays:

| Profile | Required assessment areas |
| --- | --- |
| IOS/IOS XE routers | VTY/source restrictions, AAA/fallback/accounting, interface ACLs, declared routing authentication/prefix policies, applicable control-plane protection and supported VPN settings. |
| Catalyst | Access/trunk/VLAN roles, edge/STP protections, DHCP trust, applicable DAI/IPSG dependencies, declared endpoint authentication and unused-port policy. |
| Nexus 9000 | Management/VRF boundaries, AAA/RBAC, SSH/NX-API, supported default/custom CoPP, switching/routing policy and supported vPC declarations. |
| ASA | Administrative sources, context isolation, ordered/bound ACLs, objects, NAT sections/order, supported VPN settings, logging and inspection declarations. |
| FTD diagnostics | Supported visible interfaces, ACLs, NAT, objects, routes and VPN declarations. Authoritative FMC/FDM security policy remains outside this input. |
| FortiGate | Global/VDOM separation; combined allowaccess/trusted-host/local-in analysis; administrator profiles; firewall/NAT/VIP/VPN declarations; applicable protection-profile attachment and logging. |
| Standalone FortiSwitch | Mode, management, VLAN/port/STP roles, DHCP trust and applicable DAI/IPSG/endpoint-authentication/storm-control/unused-port controls. |
| FortiWeb | Operating mode, administration, server/pool/profile references, declared enforcement intent, frontend TLS, applicable backend verification, exceptions and logging. |

Severity is separate from evidence quality. Critical is reserved for supported evidence of direct privileged control or defeat of a declared critical boundary. High indicates substantial access-control/management/cryptographic weakness; Medium a meaningful protection/accountability gap; Low a limited hardening weakness; Informational an observation without an established violation. Do not infer Internet reachability from an address or invent CVSS scores.

Pass requires applicable supported semantics and sufficient evidence satisfying a rule. Fail requires supported evidence of an applicable violation. Review requires unresolved policy intent. Unknown means insufficient evidence or semantic support. Not applicable requires positive applicability evidence. Overall Fail takes precedence when a mandatory rule fails; otherwise unresolved mandatory Review/Unknown produces Incomplete; overall Pass requires all mandatory applicable rules to pass. Preview profiles receive no overall verdict. FTD diagnostics never establish a full-device Pass. Accepted risk retains its failure and requires owner, reason and expiry.

## Approved reporting/remediation contract for the next phase

Each finding has a stable rule ID and finding-instance ID, severity/result/evidence basis, affected scoped object, redacted source/line references, observed/expected setting, impact/assumptions, remediation/dependencies/change risks, validation/rollback, vendor reference and rule version. Track Open, Planned, Accepted risk and Verified resolved independently of check results.

Provide PDF executive/full reports, self-contained offline HTML, versioned JSON with all outcomes, spreadsheet-oriented CSV findings/all-check options and redacted TXT diffs. Default to the full assessment; filtered extracts retain full-assessment status and coverage. Keep known secrets masked and offer consistent sharing aliases. Include report/export identity, time, baseline/engine/schema/redaction versions and a digest identifying the redacted snapshot, without claiming authentication of the original device. CSV needs formula-injection protection; JSON retains exact redacted values for automation.

Remediation specifies target outcome, prerequisites, sufficiently supported candidate changes or explicit parameterized templates, impact/order, verification, rollback and closure evidence. Unknown semantics require investigation guidance. Never invent site-specific management networks, authentication servers, peers or allowed business flows. A fresh supported Pass establishes configuration remediation; operational validation stays separate. Missing/unsupported replacement evidence is No longer assessable rather than Resolved. Identify rule-pack changes separately from device changes.
