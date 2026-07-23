# QCS VerifyGrid Scanner Node

The scanner node polls VerifyGrid over HTTPS and requires no inbound listener. Version 2 packages the built-in posture checks with Nmap safe service assessment, OWASP ZAP Baseline, and bounded signed-template Nuclei validation. It never expands CIDRs and does not accept operator-supplied commands or arguments.

## Requirements

- Docker Engine with Compose for the complete scanner runtime, or Node.js 22 for built-in checks only
- Outbound HTTPS access to `https://www.qcsstudio.com`
- DNS and target connectivity required by the explicitly authorized check
- A sensor bearer token displayed once in the VerifyGrid administration workspace

## Run

Set these environment variables in the customer-managed runtime:

```text
VERIFYGRID_BASE_URL=https://www.qcsstudio.com
VERIFYGRID_SENSOR_TOKEN=<sensor bearer token displayed at enrollment>
VERIFYGRID_SENSOR_REGION=customer-site-name
VERIFYGRID_POLL_SECONDS=30
```

For the complete runtime, copy `.env.example` to a protected deployment environment, set the one-time token, and run:

```text
docker compose pull
docker compose up --detach --no-build
```

The published image is `ghcr.io/qcsstudio/network-qcss-verifygrid-sensor:latest`. For a local verification build, use `docker compose build --pull` and then `docker compose up --detach`. Production scanner nodes should pin a reviewed `sha-*` tag or image digest instead of tracking `latest`.

The container runs as the non-root ZAP user, drops Linux capabilities, uses a read-only root filesystem, and reports its installed capabilities to the control plane. The image contains the signed Nuclei template snapshot available at build time and disables template updates while scanning. Use a host egress policy that permits only the VerifyGrid control plane, explicitly authorized targets, and DNS. Pin reviewed image digests before a production rollout. Rotate a node by revoking it in VerifyGrid and enrolling a replacement; tokens are displayed only at enrollment.

## Built-in capabilities

- Asset identity reconciliation
- DNS posture collection
- TLS certificate and negotiated-protocol posture
- Explicit TCP service validation
- HTTP security-header validation using `HEAD` with redirects disabled
- Nmap TCP connect scan of the top 100 ports with light version detection and `safe` NSE scripts, excluding external and broadcast scripts
- OWASP ZAP Baseline spider and passive alert collection with no active attacks
- Nuclei signed-template validation with rate limits and fuzzing, DoS, brute-force, code, file, headless, JavaScript, intrusive, and out-of-band checks disabled

The control plane revalidates authorization and scope before claim. The node independently validates the manifest SHA-256, HMAC signature, time window, target count, request ceiling, non-destructive controls, and any required controlled-validation approval before connecting to a target. A failed heartbeat terminates the active scanner process so the emergency stop is effective during execution.
