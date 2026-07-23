# VerifyGrid Production Operations Runbook

## Safety boundary

VerifyGrid executes only after a real engagement contains owned in-scope targets, explicit exclusions or a recorded no-exclusion statement, and a current written authorization bound to the scope hash. The bundled sensor refuses configuration analysis, exploit validation, CIDR expansion, shell commands, persistence, credential harvesting, destructive changes, and denial-of-service actions.

## First client activation

1. Sign in at `/admin` and open VerifyGrid.
2. Create the real client engagement and record its emergency owner and operating window.
3. Add exact targets and exclusions. Confirm ownership only from client-supplied evidence.
4. Record the written authorization and its validity window. Any later scope change revokes it.
5. Open Automation and enroll a scanner node for the client workspace with only the capabilities approved in the rules of engagement.
6. Store the displayed sensor token in the client-managed runtime; it is not recoverable from QCS.
7. Start `sensor/compose.yaml` on a dedicated QCS or client-managed scanner host with outbound policy restricted to the control plane and approved targets.
8. Confirm that the node reports `connected` and that Installed capabilities match Authorized capabilities.
9. Prepare a non-destructive execution manifest. Nmap and Nuclei controlled validation require a second accountable approval that reseals the manifest.
10. Select the connected capable node and queue the manifest.
11. Review normalized evidence before promoting observations into findings.
12. Assign remediation, record evidence, request a retest, and generate the final report.

## Sensor environment

```text
VERIFYGRID_BASE_URL=https://www.qcsstudio.com
VERIFYGRID_SENSOR_TOKEN=<token displayed at enrollment>
VERIFYGRID_SENSOR_REGION=<client site or region>
VERIFYGRID_POLL_SECONDS=30
```

Run the full scanner node from the `sensor` directory:

```text
docker compose up --detach --build
```

Revoke the node in the Automation tab before rotating or decommissioning it. Revocation also cancels every active job assigned to that node. The control plane marks a node offline after ten minutes without a heartbeat.

## Scanner profiles

- Nmap uses TCP connect, the top 100 ports, light version detection, `safe` NSE scripts, a ten-minute host timeout, and the engagement request ceiling. It does not run raw SYN, UDP, exploit, brute-force, DoS, broadcast, or external scripts.
- OWASP ZAP Baseline spiders an explicit URL for one minute and waits for passive scanning. It does not run active attacks.
- Nuclei accepts an explicit URL, disables unsigned templates and Interactsh, excludes fuzzing, DoS, brute-force, intrusive, code, file, headless, and JavaScript templates, and applies the engagement request ceiling.
- Configuration review and bespoke exploit validation remain supervised analyst activities and are never translated into sensor commands.

## Cloud scanner connectors

Create the profile in the Automation tab. The database stores only an uppercase credential prefix. Add the matching secrets to Vercel Production and redeploy:

```text
<PREFIX>_ACCESS_KEY=<Tenable access key>
<PREFIX>_SECRET_KEY=<Tenable secret key>

<PREFIX>_USERNAME=<Qualys or Rapid7 API user>
<PREFIX>_PASSWORD=<Qualys or Rapid7 API password>
```

Use a dedicated read-only account restricted to the required asset and vulnerability export APIs. Greenbone stays sensor-side because GMP is normally private; do not expose GMP publicly for VerifyGrid.

## NVD enrichment

`NVD_API_KEY` is optional. Without it, each import intentionally enriches only a small bounded CVE set to respect public NVD limits. With a key, the bounded throughput increases. Scanner evidence remains usable when NVD, CISA KEV, or FIRST EPSS is temporarily unavailable; partial failures are recorded on the import batch.

## Client portal

`VERIFYGRID_PORTAL_SESSION_SECRET` must be a dedicated random production secret. Issue access from Automation. The access token is placed after `#` in the invite link, removed from browser history before submission, used once, and stored only as a hash. Portal sessions last eight hours and are checked against the active workspace membership on every request.

## Scheduling and recovery

`/api/cron/verifygrid-operations` schedules due connector runs, advances bounded connector retries, expires execution windows, and recovers stale sensor leases. The repository workflow `.github/workflows/verifygrid-operations.yml` invokes it every 15 minutes with `Authorization: Bearer $CRON_SECRET`, stored in GitHub as `VERIFYGRID_CRON_SECRET`. This external scheduler preserves the two available Vercel Hobby cron slots for the content radar and advisory desk. All work uses database leases so overlapping invocations do not claim the same record.

Use the engagement emergency stop when authorization, ownership, stability, or target identity becomes uncertain. It pauses the engagement and cancels queued, claimed, running, and retrying jobs.

## Inputs QCS must receive from each client

- Written authorization and authorized signatory details
- Exact targets, exclusions, ownership evidence, and operating windows
- Emergency contact and stop conditions
- A client-managed host or container for the outbound sensor when internal checks are required
- Read-only scanner API credentials when automated vendor evidence import is required
- An approved secure channel for portal links and sensor tokens

These are activation inputs, not values that should be synthesized during deployment or testing. A functioning platform does not itself constitute authorization to test any external system.
