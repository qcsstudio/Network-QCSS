# VerifyGrid Access and Security Operations Model

Status: implementation baseline, 21 August 2026.

## Product promise

VerifyGrid is the governed operating record for a QCS security engagement. It connects client authority, exact scope, controlled testing, evidence, remediation, retesting, and signed reporting. It must never imply that logging in, launching a scanner, or importing a vulnerability report is equivalent to authorizing or completing a penetration test.

The operating rule is: identity proves who is acting; role determines what they may do; client authority determines what QCS may test; the current scope and time window determine what can execute; evidence determines what can be reported; retesting determines what can be closed.

## Assurance position

The current operator ceremony uses user-verified WebAuthn passkeys and is aligned to the phishing-resistant option at NIST AAL2. It is not described as AAL3 because synced passkeys may be exportable and the current registration ceremony does not require enterprise attestation or a hardware-bound authenticator.

Current controls:

- Admin authentication is followed by a separate WebAuthn operator step-up.
- The passkey is scoped to the VerifyGrid relying-party domain and requires user verification.
- Operator sessions are revocable, user-agent bound, limited to 120 minutes, and expire after 15 minutes of inactivity.
- Scope, approval, dispatch, access, review, and release actions require a passkey ceremony no more than 10 minutes old. The emergency stop remains available throughout a valid session.
- Every API request derives its operator role and permission on the server.
- The first owner can bootstrap only when no VerifyGrid operator exists and the email matches `ADMIN_EMAIL`.
- A second passkey is recommended before production dependency; adding one requires an already authenticated owner session.
- There is no password, OTP, or email fallback for operator step-up.

Required next control for high-impact actions:

- Add transaction-bound WebAuthn confirmation for scope authorization, controlled-validation approval, execution dispatch, access changes, emergency stop, and signed report release.
- The confirmation must display and bind the significant values: client, engagement, scope hash, target count, capability, manifest or report digest, validity window, and intended action.
- A general operator session must not be accepted as a substitute for this transaction approval.

## Operator roles

| Role | Purpose | Change scope | Approve | Dispatch | Stop | Review | Release | Access |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Platform owner | Service and access accountability | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Engagement lead | Scope, readiness, delivery, client coordination | Yes | Yes | Yes | Yes | No | No | Yes |
| Security analyst | Testing, evidence, findings, remediation support | No | No | No | Yes | No | No | No |
| Independent reviewer | Quality and release control | No | No | No | Yes | Yes | Yes | No |
| Read-only observer | Oversight and audit visibility | No | No | No | No | No | No | No |

The owner role is a continuity exception, not the normal delivery pattern. When another active reviewer exists, the operator who generated or operated the work must not independently satisfy report review and release gates.

## Admin journey

1. Authenticate to the QCS admin dashboard.
2. Enter VerifyGrid with a registered WebAuthn passkey.
3. Confirm the displayed operator role, passkey count, and session boundary.
4. Review intake requests without treating an intake as test authority.
5. Open an engagement with the legal client identity, service, accountable contacts, emergency route, objective, and operating window.
6. Record exact in-scope targets and explicit exclusions. Confirm ownership and the maximum permission level for each target.
7. Attach written authority from a person who can authorize testing. Bind it to the deterministic scope hash and validity window.
8. Prepare the methodology, safety ceilings, prohibited actions, stop conditions, evidence expectations, and owners.
9. Prepare a signed execution manifest. Controlled validation requires a separate accountable approval; dispatch requires an authorized scanner with matching runtime capabilities.
10. Monitor execution and keep the emergency stop available to operating and reviewing roles.
11. Reconcile observations to scope. Preserve provenance and custody before promoting an observation to a finding.
12. Validate findings, assign remediation owners and dates, collect fix evidence, and request a retest.
13. Close only after a successful retest or an accountable exception decision.
14. Generate an immutable report draft, complete independent review, sign, and release the final snapshot.
15. Schedule the next validation or close the engagement and revoke unneeded access and sensors.

## Client journey

1. Submit an assessment request and verify the contact email. The request is not authorization.
2. QCS reviews fit, conflicts, timing, and the legal client identity.
3. The client owner confirms exact targets, ownership, exclusions, permitted methods, operating window, emergency contact, and stop conditions.
4. An authorized client representative supplies written approval bound to that scope.
5. Portal members receive workspace-scoped visibility according to role. Email-link sessions provide read access and are not a testing authorization mechanism.
6. The client monitors the shared nine-stage lifecycle: Intake, Scope, Authority, Test plan, Execute, Evidence, Remediate, Retest, Release.
7. For validated findings, the client assigns owners, records remediation, and supplies fix evidence.
8. The client requests or coordinates retesting and reviews the signed final report.
9. Scope changes, client stop requests, ownership disputes, instability, or unexpected sensitive-data exposure immediately block or stop execution.

High-authority client actions such as signing scope, changing access, accepting risk, or requesting production-impacting validation should move to passkey or enterprise SSO authentication before they are made self-service.

## Shared lifecycle and exit proof

| Stage | Primary owner | Exit proof |
| --- | --- | --- |
| Intake | Shared | Engagement record and accountable contacts |
| Scope | Client | Exact targets, exclusions, ownership, permissions, scope hash |
| Authority | Client | Written authorization matching scope and time window |
| Test plan | QCS | Methods, standards, safety limits, evidence plan, assignments |
| Execute | QCS | Approved signed manifest and scanner attestation |
| Evidence | QCS | Normalized evidence with integrity and custody records |
| Remediate | Client | Owner, action, date, and fix evidence |
| Retest | Shared | Passed, failed, or inconclusive retest conclusion |
| Release | QCS | Independent review and signed final report |

## Operational safety gates

Execution remains blocked when any of these is true:

- No owned in-scope target exists.
- Exclusions are missing and there is no explicit no-exclusions statement.
- Written authorization is absent, expired, not yet active, or no longer matches the scope hash.
- The target permission is lower than the requested capability.
- The execution manifest is expired, changed, or outside the authorization window.
- Controlled validation lacks independent approval.
- The sensor is revoked, disconnected, or did not attest the requested runtime capability.
- The engagement is paused, cancelled, closed, or stopped.

The execution plane continues to prohibit denial of service, destructive changes, persistence, credential harvesting, third-party target expansion, arbitrary shell commands, and autonomous exploitation.

## Recovery and access operations

- Every production owner should enroll two independently controlled passkeys, preferably including a device-bound hardware key.
- Recovery must be performed by another active owner after out-of-band identity verification. It must not fall back to email OTP or security questions.
- Passkey addition, removal, role change, and session revocation are high-risk events and require notification and audit records.
- Never remove the last usable owner passkey without a tested second owner or documented break-glass ceremony.
- Client magic links are single use, URL-fragment delivered, hash stored, time limited, and immediately revocable. They are suitable for current read-only portal access, not high-authority client decisions.

## Incident operations

1. Any authorized operator who observes unsafe behavior records a reason and activates the emergency stop.
2. VerifyGrid pauses the engagement and cancels queued, claimed, running, and retrying jobs.
3. The client emergency owner is contacted through the recorded route.
4. QCS preserves logs, manifests, sensor heartbeats, result hashes, and custody records.
5. Resumption requires a documented cause, current authority, validated scope, safe sensor state, and engagement-lead approval.
6. A scope or authority dispute requires a new authorization; it cannot be cleared by a lifecycle status change alone.

## Standards basis

- NIST SP 800-63B-4 for phishing-resistant WebAuthn, AAL2/AAL3 characteristics, and session limits.
- W3C WebAuthn Level 3 for relying-party-bound credentials, user verification, backup state, and authenticator provenance.
- CISA phishing-resistant MFA guidance for FIDO/WebAuthn adoption.
- OWASP Authentication, MFA, Transaction Authorization, Session Management, ASVS 5.0, and WSTG reporting guidance.
- NIST SP 800-115 for assessment planning, rules of engagement, execution, evidence, and reporting.
- NIST CSF 2.0 for Govern, Identify, Protect, Detect, Respond, and Recover outcomes.

## Product references evaluated

Pentera, Horizon3.ai NodeZero, Cobalt PTaaS, and Bishop Fox Cosmos were reviewed for command-center structure, scoped operations, real-time progress, evidence-led prioritization, remediation routing, retesting, and continuous validation. VerifyGrid's differentiator is not a claim of unrestricted autonomous hacking. It is the visible governance chain connecting identity, legal authority, bounded network testing, analyst evidence, remediation, retest, and cryptographically signed proof.
