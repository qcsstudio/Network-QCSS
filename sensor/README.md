# QCS VerifyGrid Outbound Sensor

The sensor polls VerifyGrid over HTTPS. It requires no inbound listener, does not expand CIDRs, does not invoke shell commands, and refuses configuration analysis or controlled exploit validation.

## Requirements

- Node.js 22 or later
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

Then run:

```text
npm start
```

Use a dedicated non-privileged operating-system account, an egress allowlist, and a service manager such as systemd or a hardened container runtime. Rotate a sensor by revoking it in VerifyGrid and enrolling a replacement; tokens are displayed only at enrollment.

## Built-in capabilities

- Asset identity reconciliation
- DNS posture collection
- TLS certificate and negotiated-protocol posture
- Explicit TCP service validation
- HTTP security-header validation using `HEAD` with redirects disabled

The control plane revalidates authorization and scope before claim. The sensor independently validates the manifest SHA-256, HMAC signature, time window, target count, request ceiling, and non-destructive flags before connecting to a target.
