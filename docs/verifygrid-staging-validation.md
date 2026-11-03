# VerifyGrid isolated staging SOP

## Environment boundary

- Source: `codex/verifygrid-priority-foundations`, PR #1, based on `main`.
- Team: `qcsstudios`, `team_bktHjuK3PRNFKiK0EmFNmNL8`.
- Dedicated app: `qcs-verifygrid-staging`, `prj_SgYzBFIYySFXfpMlW89hBUzZkquX`.
- Dedicated PostgreSQL resource: `qcs-verifygrid-staging-db`, `store_IDuvvPceHQ6nkCFU`, Neon Free, Singapore.
- Production `network-qcs` and its database are separate. Never copy production data or credentials into this environment.
- All 14 migrations were applied to the newly provisioned database. No schema change is required by this enhancement.
- Vercel Authentication protects staging. Temporary automation access requires explicit authorization and immediate revocation after the test session.
- Only the feature branch is allowed by the staging ignored-build command. Preview deployments do not activate the repository's production cron schedules.

## Configuration and secrets

Use independent administrator credentials, stable administrator and portal session secrets, cron secret, and Ed25519 report keys. Set `STORE_DRIVER=postgres`, the exact staging `NEXT_PUBLIC_SITE_URL`, `VERIFYGRID_WEBAUTHN_ORIGIN`, and `VERIFYGRID_WEBAUTHN_RP_ID`. Pin the origin to the protected branch alias, rather than a production domain.

Keep `.env.staging.local`, `.env.cloud-staging.local`, `.vercel/`, local TLS private keys, cookies, temporary tokens, and test mailbox credentials out of source control and deliverables. The QA scripts require `VERIFYGRID_QA_ISOLATED` and `VERIFYGRID_QA_DATABASE_SHA256`, the SHA-256 of the isolated connection string. They refuse the production domain. These guards do not replace checking the provisioned resource and connection destination before migrations.

For local email tests use a loopback SMTP capture listener on port 2525. It accepts only `@verifygrid-staging.example` recipients and never relays mail. A cloud capture mailbox must be separately authorized before sending synthetic email to a third-party service. Never configure production email credentials for these tests.

## Run sequence

1. Verify Vercel project ID, resource ID, isolated connection destination and pinned database fingerprint. Check there are no production integrations or scheduled workers attached.
2. Apply `prisma migrate deploy` with the staging environment explicitly loaded. Never rely on a default `.env` or shell connection string.
3. Run `npm run test:verifygrid` and the sensor package tests. Run TypeScript, focused ESLint, and a production build. Stop the local server before rebuilding to prevent stale server chunks.
4. Start the finished production build on loopback port 3100 with `.env.staging.local` loaded. Do not rebuild while tests use this process.
5. Run `npm run test:verifygrid:staging`. It creates clearly labeled synthetic Alpha/Beta tenants and owner/reviewer/analyst/observer security fixtures. It tests a real administrator login and real WebAuthn verification using a software authenticator. Secondary parent administrator identities are signed test fixtures, not a test of an enterprise IdP or multi-user sign-in provisioning.
6. Create a short-lived local TLS certificate with SAN `localhost`/`127.0.0.1`; keep its key under `.vercel/`. Run `npm run test:verifygrid:worker`. The worker validates the isolated CA through `NODE_EXTRA_CA_CERTS`, connects to a loopback TLS proxy, and checks only a task-owned HTTP target on port 3199. No certificate validation is disabled. Do not scan shared hosting infrastructure.
7. Use the browser to test password login, the locked passkey boundary, one-time client token submission, workspace visibility, the signed report view, responsive layouts and logout. Exercise native platform/security-key ceremonies with a human operator before production acceptance.
8. For cloud API QA, deploy the tested commit as a preview to the dedicated project. Use `.env.cloud-staging.local` with the exact branch alias and the explicitly approved temporary automation secret. The same worker connects through the local TLS proxy to the protected cloud API; the target remains local. Do not store the automation secret in the repository or synthetic fixtures intended for sharing.
9. Run `npm run test:verifygrid:email` against the local capture server for public onboarding, verification replay, review, and passwordless link reissue. Review JSON evidence under `artifacts/verifygrid-staging-*-results.json`, `artifacts/verifygrid-worker-*-results.json`, and `artifacts/verifygrid-email-*-results.json`. Preserve sanitized results; destroy or expire access tokens and operator sessions after the session. Deactivate unused synthetic identities before sharing staging.
10. Revoke the temporary Vercel automation secret, verify it no longer grants access, remove local copies and stop the loopback test services. Keep staging protected for further acceptance work.

## Required acceptance checks

- Password-only and anonymous operator requests fail; passkey RP, origin, user verification, one-time challenge, concurrent replay, user-agent binding and parent/operator identity binding are enforced.
- Observer/analyst permissions, independent review, freshness and session revocation behave as specified.
- Authority and exact scope are required; expiry is exclusive. Scope mutations cancel pending/running work and cannot be undone by heartbeat, retry or lease recovery.
- A concurrent claim grants one lease. Initial and renewed leases remain within signed deadlines. An emergency stop wins over retry and cancelled jobs reject subsequent messages.
- A real non-destructive sensor result passes integrity checks, reconciles to scope, persists in PostgreSQL and promotes to evidence-backed findings. Altered hashes and replay fail.
- Report quality failures block approval. A changed scope or evidence set invalidates a pending snapshot. A report author cannot approve their own report while an independent operator exists. Concurrent release creates only one final release.
- Snapshot, report-chain and custody hashes survive database null round trips. Historical v1 omission encodings remain verifiable without accepting changed event content. Final Ed25519 signatures verify independently.
- Synthetic invitation email is captured; a one-time link is consumed once. Clients can obtain their own final report, cannot obtain another tenant's report, and lose access on membership revocation.
- Public onboarding verification/replay, review and passwordless link reissue are exercised with the authorized mail sink.

## Production release gate

Do not merge or deploy to production until the intended production feature set passes its required checks. Software WebAuthn tests do not prove a native device ceremony. Synthetic parent sessions do not prove real reviewer/analyst login provisioning. Commercial scanner adapters require licensed, authorized lab endpoints and credentials for live integration acceptance. Record these as untested where unavailable; never present fixture or parser coverage as live engine validation.

Before release, verify production RP/origin and signing identity, database backup/restore and rollback procedures, independent operator access, email delivery, scheduler authentication, sensor outbound connectivity, and the final PR commit. Preserve the release evidence and rollback to the previous verified deployment if the post-release smoke test fails.

## Recorded validation, 3 November 2026

The local production build passed 18 core workflow scenarios, nine real-worker scenarios and six onboarding/email scenarios with the isolated PostgreSQL database. The protected cloud preview passed the same 18 core scenarios with administrator-supplied client tokens and all nine worker scenarios. Cloud mailbox delivery was deliberately deferred and the cloud aggregate remains incomplete. The temporary Vercel automation bypass was revoked after this test session.

Browser checks covered real password login, the locked passkey boundary, client token entry, workspace, released report and logout. The report title contrast defect was fixed and the 390-pixel report viewport had no horizontal overflow. Domain and sensor packages passed 49 and five tests respectively; TypeScript, focused ESLint, and the production build passed.

Remaining acceptance items: authorized cloud capture-mail delivery and public onboarding there; native passkey ceremonies; real independent operator identity provisioning (the current parent login is configured for a single administrator); any commercial scanner adapters intended for production; and production-specific backup, restore, scheduler and rollback checks. None is represented as passed by software fixtures.
