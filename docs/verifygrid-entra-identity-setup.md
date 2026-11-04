# VerifyGrid operator identity: Microsoft Entra ID

Status: integration prepared; no Microsoft tenant has been created or connected by this session. Live sign-in remains unvalidated until an authorized administrator supplies the isolated test tenant, app registration and users. SSO is disabled by default and production release remains held.

## Chosen design

Use a separate **Microsoft Entra workforce test tenant**, a single-tenant confidential web application, and the authorization-code flow with PKCE S256, one-time state and nonce. The OIDC client validates the token signature, issuer, audience and nonce. The application additionally pins tenant ID, object ID, token version and exactly one assigned VerifyGrid role. UPN/email is display/audit data, not the account-binding key. Existing accounts are never linked by email automatically.

The dedicated console is `/operator/verifygrid`. Its opaque, database-backed identity session expires after at most 15 minutes and is bound to the browser user agent. A separate user-verified WebAuthn passkey remains required to read or operate engagements. Entra sign-in never creates the shared site-administrator cookie or grants publishing/content access. Local role/status changes revoke or invalidate identity and passkey sessions. Entra-side removal/disable must be tested at reauthentication; without directory events, an existing identity session can remain usable until its fixed 15-minute expiry.

The implementation uses `openid-client` and does not request Graph, mailbox, directory-read or offline/refresh-token access. PKCE verifiers and nonces are encrypted in five-minute, single-use sign-in records. Access/refresh/ID tokens are not stored in browser storage or database sessions. Sign-out revokes the local identity session and current passkey session; it does not promise to sign out every Microsoft application.

## Access and information required

1. **Tenant creation:** an authorized Entra/Azure administrator who can create an isolated workforce tenant. Suggested display name: `QCS VerifyGrid Test`; choose an available `onmicrosoft.com` prefix and confirm the tenant country/region. Microsoft restricts creation of additional workforce tenants for free/trial customers. An eligible administrator must provision it or provide a suitable existing isolated test tenant. No subscription purchase has been made.
2. **Application setup:** the administrator can perform the steps below, or delegate ownership of this test app registration and enterprise application. Application Developer is sufficient for registering an app; user creation, app assignments and authentication policies require their corresponding administrative permissions. Tenant-wide production administrator access is not required by the application.
3. **Non-secret identifiers:** directory/tenant ID, application/client ID, app-registration object ID, enterprise-application/service-principal object ID, test domain, and the six test users' UPNs/object IDs and assigned roles.
4. **Credential:** a short-lived client credential for this test application, entered directly in encrypted staging environment variables. The application session-encryption key can be generated locally. Do not put credentials in issues, source, setup JSON or shared validation evidence.
5. **Test identities:** five independent accounts for owner, lead, analyst, reviewer and observer, plus an unassigned account for denial tests. An administrator must be able to remove an assignment or disable an account for revocation tests. Keep these identities separate from customer and production staff accounts.
6. **Native acceptance:** a human operator with Windows Hello, a platform passkey, or an approved FIDO2 key for enrollment and recovery testing. Conditional Access/authentication-strength policy tests require applicable Entra licensing and policy-administration access; confirm available P1 licensing before enabling that part of acceptance. No license purchase has been authorized.

GitHub, Vercel staging, PostgreSQL and the approved capture-only mail service are already available. Microsoft tenant administration is the missing external access.

## App registration

Configure the following in the isolated tenant, checking the tenant ID before every administrative change:

- Name: `QCS VerifyGrid Test`.
- Supported account type: accounts in this organizational directory only (`AzureADMyOrg`).
- Platform: confidential **Web**, not SPA/public client.
- Exact redirect URI: `https://qcs-verifygrid-staging-git-codex-verifygrid-p-635107-qcsstudios.vercel.app/api/verifygrid/identity/callback`.
- Application home: `https://qcs-verifygrid-staging-git-codex-verifygrid-p-635107-qcsstudios.vercel.app/operator/verifygrid`.
- OIDC scopes: `openid profile email`; no Microsoft Graph API permissions are required by the runtime. Remove any automatically added Graph `User.Read` permission if it is unused.
- Implicit/hybrid token issuance: disabled. Public-client fallback: disabled.
- Enterprise application: set **Assignment required = Yes** and assign each test user exactly one application role.

| Entra app role | VerifyGrid role | Acceptance responsibility |
|---|---|---|
| `VerifyGrid.Owner` | `owner` | Access, authority, safety and release ownership |
| `VerifyGrid.Lead` | `lead` | Scope and approved dispatch |
| `VerifyGrid.Analyst` | `analyst` | Evidence and findings; no scope approval or report release |
| `VerifyGrid.Reviewer` | `reviewer` | Independent review/release; no test operation |
| `VerifyGrid.Observer` | `observer` | Read-only access |

The setup package contains a Microsoft Graph application-create JSON body and a separate service-principal patch. `appRoleAssignmentRequired` belongs to the enterprise application, not the application-registration object. The JSON files contain no secrets and do not create a tenant when opened. A tenant administrator must apply or reproduce these settings.

## Staging activation

Apply migration `20261103170000_verifygrid_entra_identity` to the isolated PostgreSQL database before deploying this code. It adds nullable identity bindings and new login/session tables; it does not rewrite legacy operators or customer evidence. The migration was applied to staging; no production database migration was run.

Set these variables on **qcs-verifygrid-staging only**, then redeploy:

```text
VERIFYGRID_SSO_ENABLED=1
VERIFYGRID_SSO_REQUIRED=1
VERIFYGRID_SSO_ORIGIN=https://qcs-verifygrid-staging-git-codex-verifygrid-p-635107-qcsstudios.vercel.app
VERIFYGRID_ENTRA_TENANT_ID=<isolated tenant GUID>
VERIFYGRID_ENTRA_CLIENT_ID=<test application client GUID>
VERIFYGRID_ENTRA_CLIENT_SECRET=<encrypted test credential>
VERIFYGRID_SSO_SESSION_SECRET=<independent random secret, at least 32 characters>
```

Keep the existing WebAuthn origin/RP ID pinned to that same exact branch alias. `SSO_REQUIRED=1` rejects the legacy shared administrator login at VerifyGrid APIs; that login continues to serve the separate administration product. Do not use `common`, `organizations`, wildcard callbacks, an unrelated preview hostname, or a production tenant for this acceptance run.

Until all values and assignments are ready, leave `VERIFYGRID_SSO_ENABLED=0` and `VERIFYGRID_SSO_REQUIRED=0`. Setting `REQUIRED=1` with missing configuration intentionally fails closed. Roll back activation by restoring the explicitly approved staging configuration; do not weaken the production authentication boundary as a troubleshooting step.

## Validation gate

Protocol/policy fixtures test tenant/audience mismatch, missing/ambiguous roles, expired identity claims, encrypted transaction tampering, state/nonce mismatch, PKCE forwarding and RSA signature rejection. They are not evidence of a Microsoft tenant sign-in.

Live acceptance must demonstrate: assigned user sign-in; denial for unassigned/wrong-tenant accounts; immutable account binding; native passkey enrollment/authentication and recovery; five-role permission separation; denial of wider administration access; parent/passkey identity mismatch rejection; local logout and replay rejection; fixed identity expiry; role downgrade and disabled-user behavior; independent report review; and an authorized sensor dispatch after both identity and passkey gates pass. Preserve sanitized application and Entra sign-in results. Revoke temporary test access and sessions after validation.

## Completed fixture validation (4 November 2026, Asia/Calcutta)

The production build, TypeScript compilation, focused ESLint and 53 policy/protocol tests passed. All 33 local compatibility scenarios passed: 18 engagement/security/report checks, 9 actual sensor-worker checks and 6 onboarding/email checks. Eight new identity application-boundary checks passed against the real production build served at an exact local HTTPS origin. They cover private/noindex entry headers and the pinned Microsoft form redirect, mandatory passkeys, denial of wider administration, parent/operator and user-agent mismatch, required-SSO legacy-cookie rejection, expiry/status/role invalidation, single-use tampered callbacks and origin-bound logout/replay denial.

These eight checks seed opaque primary identity records directly in the pinned isolated database. No live Microsoft sign-in is simulated or claimed. The separately signed OIDC fixtures exercise the library's state/nonce/PKCE/signature verification. Native passkeys, actual Entra assignments/policies and Entra-side disabled-user behavior remain acceptance gates.

For reproducibility, build first with no running Next servers. Prepare an ignored `.env.identity-qa.local` from the isolated staging profile; retain the database fingerprint safeguards, set `NODE_ENV=production`, both SSO flags to `1`, SSO and WebAuthn origins to `https://localhost:3443`, and WebAuthn RP ID to `localhost`. Use local synthetic GUIDs and a fake client credential only in this fixture profile, with a random session secret. Supply `.vercel/staging-key.pem` and `.vercel/staging-cert.pem` for localhost and trust that certificate only in the child test process through `NODE_EXTRA_CA_CERTS`. Run `npm run test:verifygrid:identity`; it starts and stops its own HTTPS Next server on port 3443 and cleans up its operator/session fixtures. Never upload the synthetic identity profile or disable TLS verification to run this check.

## Primary references

- [Microsoft tenant creation and eligibility](https://learn.microsoft.com/en-us/entra/fundamentals/create-new-tenant)
- [Microsoft app registration prerequisites](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [Application roles and assignments](https://learn.microsoft.com/en-us/entra/identity-platform/howto-add-app-roles-in-apps)
- [Immutable identity claims and mutable user names](https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference)
- [Conditional Access authentication strengths and licensing](https://learn.microsoft.com/en-us/entra/identity/authentication/concept-authentication-strengths)
- [OIDC code-flow validation library](https://github.com/panva/openid-client)
