# VerifyGrid Connector Contract

## Trust boundary

Scanner files are evidence, not instructions. The Next.js control plane parses supported exports, removes unnecessary raw material, computes an import SHA-256, classifies each observation against the current scope, and stores normalized records. It never executes commands found in an imported file.

Direct imports are limited to 2 MB and 5,000 unique observations. Larger and credentialed integrations belong in the future durable connector worker.

## Supported direct imports

| Connector | Input | Primary identity |
| --- | --- | --- |
| Nmap | XML (`-oX`) | Host plus protocol/port/service |
| Tenable Nessus | `.nessus` XML | Plugin ID, host, and port |
| Burp Suite | Issue XML | Issue serial/type and URL |
| Qualys VMDR | CSV | QID/finding, asset, and port |
| Rapid7 InsightVM | CSV | Vulnerability ID, asset, and port |
| Greenbone | CSV | NVT/result ID, asset, and port |
| VerifyGrid | Normalized JSON v1 | Source reference and asset |

Nmap documents XML as its preferred programmatic format: https://nmap.org/book/output-formats-xml-output.html

Tenable documents `.nessus` as an XML import/export format: https://docs.tenable.com/quick-reference/nessus-file-format/Nessus-File-Format.pdf

PortSwigger documents Burp issue XML and its internal DTD: https://portswigger.net/burp/documentation/desktop/running-scans/reporting/report-settings

## Normalized JSON v1

The root may be an array or an object with an `observations` array. Each observation requires `assetIdentifier` and `title`.

```json
{
  "observations": [
    {
      "assetIdentifier": "203.0.113.10",
      "assetName": "edge.example.com",
      "assetKind": "host",
      "title": "Example security observation",
      "description": "Technical observation with enough context for analyst validation.",
      "severity": "high",
      "confidence": "likely",
      "sourceReference": "scanner:plugin:12345",
      "cve": "CVE-2026-12345",
      "cvssScore": 8.8,
      "port": 443,
      "protocol": "tcp",
      "service": "https",
      "evidenceSummary": "Sanitized evidence summary.",
      "remediation": "Apply the vendor-supported correction and verify the control.",
      "lastObservedAt": "2026-07-22T10:00:00.000Z"
    }
  ]
}
```

## Promotion policy

1. Explicit exclusions win over inclusions.
2. Unmatched assets remain observations and are never promoted automatically.
3. Informational observations remain staged unless an operator explicitly includes them.
4. Promotion creates or refreshes the workspace asset before creating a finding.
5. Repeated observations update the existing finding instead of creating scanner-ticket duplicates.
6. CISA KEV and FIRST EPSS are prioritization inputs, not a replacement for business impact and analyst validation.

CISA KEV: https://www.cisa.gov/known-exploited-vulnerabilities-catalog

FIRST EPSS API: https://api.first.org/epss/

## Execution records

An execution record contains the engagement and workspace IDs, current scope hash, active authorization ID and window, selected target snapshot, capability level, request ceiling, prohibited actions, stop conditions, and a deterministic manifest SHA-256.

The current release does not dispatch scanner jobs. Safe capabilities are marked `validated`; configuration analysis and controlled exploit validation are marked `manual_approval_required`. A future customer sensor must verify the manifest and current authorization again immediately before any action.
