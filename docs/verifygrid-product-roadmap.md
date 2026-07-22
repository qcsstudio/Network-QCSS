# QCS VerifyGrid Product Roadmap

Status: Phase 2 production baseline with governed Phase 4 sensor execution, 22 July 2026. The working product name requires brand and trademark review before public launch.

## Product position

VerifyGrid is a network-first security assurance platform. It joins authorized VAPT delivery, asset and exposure context, evidence-led remediation, retesting, and continuous control validation in one operating record. It does not pretend that an automated scan is a penetration test and it does not run intrusive actions without explicit scope and approval.

The primary customer outcome is simple: know which network paths and controls create material risk, see the proof, assign the fix, and verify that the fix worked.

## Operating principles

1. Authorization precedes execution. Every test window is bound to a hashed scope and accountable approver.
2. Scope changes invalidate approval. Automation remains blocked until the revised scope is authorized.
3. Read-only discovery is distinct from controlled validation. Each target carries an explicit permission level.
4. Evidence is durable. Finding evidence is classified, integrity-hashed, timestamped, and retained separately from transient worker logs.
5. Human judgment remains visible. Scanner observations, analyst validation, accepted risk, and successful retest are different states.
6. The control plane never executes untrusted tooling. Scans run in isolated workers or customer sensors with short-lived credentials.
7. Every material action is attributable. Product activity and the existing administrative audit trail are both written.

## Delivery sequence

### Phase 1: Authorized PTaaS control plane

- Client workspaces and accountable contacts
- Engagement lifecycle and rules of engagement
- Typed in-scope targets and explicit exclusions
- Authorization versions bound to a deterministic scope hash
- Asset register and normalized finding records
- Evidence metadata, remediation ownership, due dates, and retest requests
- Portfolio and engagement operations in the existing QCS admin dashboard
- Report-ready data model and immutable activity history

Exit criteria: QCS can manage a real engagement from intake through remediation and retest without spreadsheets, while the system refuses to mark a changed or incomplete scope as authorized.

### Phase 2: Exposure intelligence

- Connectors for Nessus/Tenable, Qualys, Rapid7, Greenbone, Burp, Nmap XML, and vendor configuration exports
- Advisory correlation using CISA KEV, EPSS, CVSS, NVD, and QCS vendor feeds
- Finding deduplication by asset, control, source, and observation signature
- Risk prioritization using exploitability, asset criticality, exposure, reachability, and compensating controls
- Event-triggered checks for new assets, critical advisories, firewall changes, identity changes, and cloud drift

Exit criteria: imported observations become a stable remediation queue instead of duplicate scanner tickets.

Implemented baseline:

- Integrity-hashed import batches for Nmap XML, Nessus XML, Burp issue XML, Qualys CSV, Rapid7 CSV, Greenbone CSV, and VerifyGrid normalized JSON
- XML entity rejection, 2 MB direct-import limit, 5,000-observation ceiling, and omission of raw Burp request/response material
- Exclusion-first scope reconciliation for exact hosts, URLs, IPv4/IPv6 CIDRs, and named targets
- Optional NVD CPE/CVSS, CISA KEV, and FIRST EPSS enrichment with bounded requests and partial-failure recording
- Observation staging, analyst promotion, cross-batch finding deduplication, asset refresh, and evidence integrity metadata
- Credentialed Tenable, Qualys, and Rapid7 connector profiles with scheduled differential runs, leases, retries, failure state, and environment-backed secrets
- Greenbone sensor-side connector contract so private GMP endpoints are never contacted by the Vercel control plane
- Authorization-bound execution manifests with capability and target permission checks; no Vercel-side scanner execution
- Outbound-only Node.js sensor for asset, DNS, TLS, explicit TCP, and HTTP-header checks with signed manifests and result integrity hashes
- Workspace-scoped client portal with one-time fragment links, signed sessions, role records, immediate revocation, and final-report isolation
- Operator controls for connector sync, sensor enrollment/revocation, job dispatch, portal access, and emergency stop
- Versioned executive, technical, and retest report snapshots with SHA-256 integrity

Still required before the Phase 2 exit gate: customer-authorized production connector credentials, Greenbone deployment certification against the customer GMP version, broader scanner fixture certification, and external alerting for repeated queue failures.

### Phase 3: Network and identity graph

- Multivendor configuration ingestion with secret removal and provenance
- Batfish-backed reachability and policy analysis
- Cloud network path projection for AWS, Azure, and GCP
- BloodHound-compatible identity relationships where authorized
- Attack-path explanations that connect external exposure, network reachability, identity privilege, and business assets

Exit criteria: each priority finding explains a plausible path and the smallest useful control change.

### Phase 4: Governed validation

- Outbound-only customer sensor with bearer identity in the baseline and mTLS rotation for enterprise deployments
- Isolated worker pools with per-engagement network policy and egress restrictions
- Signed job manifests, approval gates, kill switch, concurrency ceilings, and time windows
- Safe control checks by default; intrusive validation requires a separate approval event
- Credential leases from a KMS-backed secret broker; no long-lived secrets in the control plane
- Evidence sealing, worker attestation, and deterministic cleanup

Exit criteria: approved checks can run repeatedly without broad standing access or ambiguous authority.

### Phase 5: Continuous assurance and AI assistance

- Control validation mapped to NIST CSF 2.0, ISO 27001, CIS Controls, PCI DSS, and relevant CERT-In expectations
- Change-risk previews before firewall, route, VPN, and cloud policy deployment
- AI-assisted evidence summaries and remediation plans with source citations and analyst approval
- MCP/agent security tests, prompt-injection resistance, tool authorization, and data-flow review
- Cryptographic inventory and post-quantum migration readiness
- Executive assurance trends, security debt, SLA performance, and verified risk reduction

## Technical architecture

### Control plane

- Next.js App Router on Vercel for administrative and customer experiences
- PostgreSQL and Prisma as the transactional source of truth
- Object storage for encrypted evidence, reports, and signed artifacts
- Durable workflow execution for imports, enrichment, notifications, and retests
- Append-only product activity plus the existing cross-product `AuditLog`

### Execution plane

- Separate regional workers in isolated VPC/Kubernetes namespaces
- Customer sensors initiate outbound mTLS sessions; no unsolicited inbound management channel
- Jobs contain engagement ID, scope hash, target set, approved capability, validity window, and resource limits
- Workers verify the current authorization immediately before execution
- Raw outputs are normalized, malware-scanned where applicable, hashed, encrypted, and then detached from the worker

### Data boundary

- Every operational record belongs to a client workspace
- API queries derive workspace membership from the authenticated session, never from a trusted client parameter
- Administrative routes use server-side admin authorization; portal queries derive workspace identity from a signed, revocable membership session and never accept a workspace ID from the browser
- PostgreSQL row-level security remains an additional defense-in-depth gate for multi-tenant enterprise rollout
- Evidence URLs are short-lived and logged; secrets and credential material are never stored as finding evidence

## Core state machines

Engagement: `draft -> authorization_pending -> authorized -> scheduled -> active -> remediation -> closed`.

Safety transitions: any scope mutation from `authorized`, `scheduled`, or `active` revokes active authorization and returns the engagement to `authorization_pending`. `paused` and `cancelled` are operator-controlled terminal safety states for execution.

Finding: `open -> validated -> remediation_in_progress -> resolved -> retest_requested -> closed`.

Exception states: `accepted_risk`, `false_positive`, and `duplicate` require actor, reason, and timestamp. A retest can pass, fail, or remain inconclusive; only a passed retest closes a validated technical finding automatically.

## First-release API boundaries

- `GET/POST /api/admin/verifygrid/engagements`
- `GET/PATCH /api/admin/verifygrid/engagements/:id`
- `POST/DELETE /api/admin/verifygrid/engagements/:id/scope`
- `POST /api/admin/verifygrid/engagements/:id/authorize`
- `POST /api/admin/verifygrid/engagements/:id/findings`
- `PATCH /api/admin/verifygrid/findings/:id`
- `POST /api/admin/verifygrid/findings/:id/retests`
- `GET /api/admin/verifygrid/workspaces/:id/automation`
- `POST /api/admin/verifygrid/workspaces/:id/connectors`
- `POST /api/admin/verifygrid/connectors/:id/runs`
- `POST /api/admin/verifygrid/workspaces/:id/sensors`
- `POST /api/admin/verifygrid/execution-jobs/:id/queue`
- `POST /api/admin/verifygrid/engagements/:id/kill-switch`
- `POST /api/admin/verifygrid/workspaces/:id/memberships`
- `POST /api/verifygrid/sensor/jobs/claim`
- `POST /api/verifygrid/sensor/jobs/:state`
- `POST /api/portal/access`

All routes use the existing signed admin session or admin API token, rate limiting, schema validation, no-store responses, and audit logging.

## Release gates

- No active engagement without at least one owned in-scope target and one explicit exclusion or a recorded no-exclusion statement
- No authorization with an expired or zero-length window
- No automated job when authorization scope hash differs from the current scope hash
- No high-impact capability in `safe_checks` mode
- No evidence artifact without classification and integrity metadata
- No customer portal until membership authorization and row-level isolation tests exist
- No autonomous exploitation, persistence, credential harvesting, denial of service, destructive action, or third-party target testing

## Measurement

- Time from intake to authorized scope
- Percentage of assets with verified ownership and criticality
- Duplicate reduction after normalization
- Median time to validate, assign, remediate, and retest
- Findings reopened after a failed retest
- Critical exposure dwell time and KEV remediation time
- Percentage of material findings with path evidence and a verified fix
- Authorization exceptions, blocked execution attempts, and emergency stops
