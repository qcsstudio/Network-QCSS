# VerifyGrid priority enhancements

This change starts the platform roadmap with execution safety and an evidence-led operator overview. It builds on the existing VerifyGrid control plane and scanner node.

## Execution behavior

- Paused engagements cannot prepare, queue, claim or renew execution through the shared boundary validator. Resume still checks authority against the prospective active state.
- Authorization and job windows use an exclusive end timestamp. Invalid, backwards, expired and oversized job windows fail closed even when the domain validator is called without schema parsing.
- Scope changes revoke authority and cancel unfinished execution records inside the same transaction. A previously prepared manifest must be recreated for the newly authorized scope.
- Heartbeats recheck authority, scope, manifest integrity, scanner availability and lease freshness. Renewal cannot revive an expired lease or extend past job or authorization expiry. The original execution start time is retained.
- A sensor enforces a local hard deadline derived from both signed windows, independently of heartbeat availability. Its container includes the policy module.
- Report quality review remains blocked while results are processing or execution is waiting to retry.

## Operator experience

The Control view adds a responsive assurance overview with a vector scope diagram, authorization posture, window and scope fingerprint, concluded test cases, incomplete coverage, recent execution exceptions and observations awaiting review. Its actions open the existing workspace tabs.

The diagram groups actual scoped target records by environment. It does not infer network paths. Coverage separates passing cases, cases with findings, non-applicable cases and incomplete cases. The lifecycle no longer labels mixed completed/failed execution as complete or treats test status alone as collected evidence.

Authority expiry is reevaluated locally every 15 seconds; server checks remain authoritative. The loaded snapshot still requires refresh to observe changes made by another operator. Motion is limited to entry transitions, meter updates and connectors when a recorded job is active and the execution gate is open. Reduced-motion preferences disable animation and transitions. Buttons retain visible keyboard focus and textual status labels.

## Validation

Run:

```text
npm run test:verifygrid
node --test sensor/test/*.test.mjs
npm run typecheck
npm run build
```

The added tests cover paused and invalid execution windows, exact expiry, revoked scope, unsettled report jobs, cached authority expiry, unknown ownership, mixed outcomes, missing result evidence and worker deadlines. UI inspection uses synthetic fixtures rather than customer data.

## Staging handoff

Repository access is already connected. No staging environment or test identities currently exist; initial validation therefore uses local synthetic fixtures. The recommended next environment is an isolated Vercel preview with its own PostgreSQL database and synthetic identities. Full integration validation additionally requires:

1. The designated Vercel staging project and preview URL. Both `network-qcs` and `network-qcss` exist, so identify the intended deployment target before linking or promoting.
2. An isolated PostgreSQL development or staging database with the current Prisma migrations, supplied through the approved environment mechanism.
3. Non-production operator identities and passkeys for owner/lead, analyst, reviewer and observer, plus two separate synthetic client workspaces and portal memberships.
4. Correct WebAuthn RP ID and origin, staging session/signing secrets, and a test email destination/provider configured in the environment. Do not place secret values in chat, source or PR comments.
5. A customer-controlled lab sensor and explicit test targets, source zone, allowed methods, time window, emergency contact and stop conditions before any real scanner dispatch.

No database migration is introduced by this patch. The production build and policy tests do not establish live database concurrency, real passkey ceremonies, tenant isolation, packet containment or scanner process-stop timing. Exercise those flows in staging before production release, including scope mutation during a running job, authorization supersession, exact expiry, lease loss and emergency stop.
