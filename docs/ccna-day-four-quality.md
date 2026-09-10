# Day 4: Layered Diagnosis

Day 4 previously relied on generic generation for both its lab and diagram. The
reported candidate had clipped device descriptions, a partial router label and
unsafe ambiguity around ACL cleanup. Its instructions also assumed console
knowledge and overinterpreted missing ping replies.

## Maintained Contract

- One path: PC1 - Switch - Router - PC2. Packet Journey is a title, not a node.
- Node role phrases fit 24 characters; stage titles fit 26. Addresses are complete
  in the addressing table and stages, never crammed into the Router label.
- A first-use prelude defines the models, frames, packets, addresses, console
  prompts, command modes, ACL identifiers, baselines and ping limitations.
- Fourteen single-console steps cover isolation, inventory, exact interface
  mapping, addressing, repeated peer tests, a clean saved baseline, a temporary
  ACL, evidence collection, detach-before-delete rollback and verification.
- Numbered ACL 199 must be absent and both selected interfaces unconfigured and
  unfiltered at entry. An existing list or binding is a stop condition. The
  lab must not replace it, append to it or guess its ownership.
- Full rollback is `enable`, `configure terminal`, mapped LAN1 interface,
  `no ip access-group 199 in`, `exit`, `no access-list 199`, `end`, followed by
  independent checks of the list and attachment. This deletes the entire
  lab-owned numbered list, not a rule sequence or a named ACL.
- Only a disconnected disposable project is eligible. Record the original
  state and save a separate clean working baseline before filtering. Do not
  save the fault or treat a startup-to-running merge as a rollback.
- Repeated target checks rule out self-pings. Lost ICMP replies do not identify
  a faulty layer: ARP, links, either path direction, host state and filtering
  all need evidence. Replies do not establish transport/application health.
- Missing router ports require template/adapter inspection and explicit mapping.
  `no shutdown` is applied only to mapped lab interfaces and does not prove that
  the cable or peer is healthy. The built-in Switch has no IOS console.

## Assembly And Review

`ccna-layered-contract.ts` supplies the full lab, visual and prelude before the
combined schema, citation and quality checks and before independent review. The
writer generates the topic teaching, scenarios and assessments against this
same contract. Research queries specifically cover layered diagnosis, ACL
commands, console setup and interface troubleshooting.

The independent reviewer still checks the entire assembled lesson and can reject
contradictory body text, unsafe instructions or inaccurate quiz answers. Passing
the maintained contract is not independent approval or proof of a real lab run.
An old approval cannot authorize revised content; the exact content digest must
match. Day 4 has a new checkpoint scope so old generic drafts are not resumed as
if they were generated under this contract.

No quality threshold, source limit or paid retry limit is relaxed. Deployment
does not rewrite a saved lesson or publish it automatically. Its next explicit
generation must pass the full review process.

## Verification

Regression coverage includes the reported clipped strings, schema lengths,
complete diagram paths, compact/desktop geometry, single-console command blocks,
IOS mode transitions, ACL ownership and rollback order, peer test destinations,
baseline instructions, interface recovery, immutable composition, citation
consolidation and independent-review rejection. Command tests check sequence
structure, not actual Cisco IOS execution or real network forwarding.

Primary references are listed in `ccnaLayeredSources`, including Cisco ACL and
ping documentation, GNS3 router/VPCS setup, RFC 1122 and Cisco image licensing.
