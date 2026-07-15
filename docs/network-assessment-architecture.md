# Network Assessment And CTA Architecture

This product must look like a polished services website to visitors, but behave like a structured marketing and engineering qualification system for QuantumCrafters Studio Pvt. Ltd.

## Methodology Base

The assessment logic is inspired by recognized assessment and security-operation patterns:

- NIST SP 800-115: plan tests, conduct technical examinations, analyze findings, and develop mitigation strategies.
- NIST Cybersecurity Framework 2.0: Govern, Identify, Protect, Detect, Respond, and Recover outcomes.
- CISA Zero Trust Maturity Model: identity, devices, networks, applications/workloads, data, visibility, automation, and governance.
- NIST SP 800-41: firewall design, deployment, management, and policy governance.

References:

- https://csrc.nist.gov/pubs/sp/800/115/final
- https://www.nist.gov/cyberframework
- https://nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.29.pdf
- https://www.cisa.gov/zero-trust-maturity-model
- https://csrc.nist.gov/pubs/sp/800/41/r1/final

## Assessment Products

1. Network Risk Score
   - Domains: asset scope, detection, firewall governance, identity, remote access, resilience.
   - CTA logic: high incident or visibility risk routes to troubleshooting or managed network services.
   - Evidence: topology, device inventory, firewall export, VPN policy, monitoring screenshots, RCA notes.

2. Firewall Hygiene Checker
   - Domains: firewall estate clarity, policy complexity, broad access exposure, logs, backups, privileged access.
   - CTA logic: risky broad rules or missing backups route to firewall management or network security services.
   - Evidence: rule export, NAT/VPN policy, admin list, logging settings, config backup sample.

3. Pentest Readiness
   - Domains: scope complexity, rules of engagement, timeline pressure, business driver, testing history, retesting loop.
   - CTA logic: urgent deadline or unclear scope routes to pentest scoping before testing.
   - Evidence: asset list, authorization contact, previous report, compliance requirement, retest expectations.

4. Cloud Network Readiness
   - Domains: cloud estate scope, hybrid connectivity, segmentation, public exposure, logging, primary pressure.
   - CTA logic: flat segmentation, unknown exposure, or missing logs routes to cloud network review.
   - Evidence: VPC/VNet topology, routes, security groups/NSGs, VPN/direct links, public IP inventory, flow logs.

5. Career Path Finder
   - Domains: current baseline, role target, weekly capacity, delivery fit, lab readiness, enrollment intent.
   - CTA logic: high guidance need routes to career counseling or demo class.
   - Evidence: current level, target role, weekly time, preferred mode, lab exposure, start timeline.

6. Troubleshooting Triage
   - Domains: business impact, incident timeline, likely layer, recent change risk, vendor support, evidence availability.
   - CTA logic: site-down, multi-site, recent-change, or low-evidence cases route to emergency triage.
   - Evidence: affected users, timeline, recent changes, logs, packet captures, ISP/vendor ticket, rollback availability.

## Scoring Model

Each assessment answer maps to a 0 to 5 risk signal. Each question has a weight. The final score is:

`weighted answer risk / maximum weighted risk * 100`

Risk bands:

- 80 to 100: Critical priority.
- 62 to 79: High priority.
- 38 to 61: Medium priority.
- 0 to 37: Low attention.

The score is not a compliance certification. It is a routing and qualification signal used to decide urgency, evidence, pipeline, and follow-up.

## CTA Logic

Every CTA should answer four questions:

1. What is the next action?
2. Who owns it internally?
3. How quickly should QCS respond?
4. What evidence should be requested before the call?

CTA examples:

- Start Emergency Network Triage: used for outage, multi-site impact, weak evidence, or recent change risk.
- Book Firewall Hygiene Sprint: used for broad allow rules, large rulebases, missing logs, weak admin controls, or no backups.
- Create Pentest Scope Today: used for urgent deadlines, unclear scope, no previous testing, or client/compliance pressure.
- Run Cloud Exposure Review: used for flat segmentation, public exposure uncertainty, missing flow logs, or multi-cloud complexity.
- Book Career Counseling: used for learners with weak baseline, unclear target, low lab exposure, or immediate start intent.

## Dashboard Requirements

Each submitted assessment should store:

- raw answers;
- trusted server score;
- risk band and maturity score;
- pipeline;
- recommended CTA;
- CTA owner and response window;
- top risk domains;
- top findings;
- evidence requests;
- next actions;
- attribution and consent state;
- country and hashed IP context from server request metadata.

This turns the website into a funnel intelligence system:

visit -> utility/tool use -> assessment -> evidence profile -> lead form -> CRM/webhook/WhatsApp/email follow-up -> sales stage.

## Privacy Boundary

The website cannot automatically collect a visitor email from the browser. Email, phone, company, and contact permission should come from explicit forms, resource downloads, or booking flows.

The site can log server-side request context such as country and hashed IP where lawful, and can run analytics/marketing tags after consent. Cookie consent must not pretend that hidden personal data is being collected automatically.

## Future Build Phases

1. Add per-assessment landing pages with FAQs, schema, and conversion copy.
2. Add evidence upload or secure checklist capture for qualified leads.
3. Add CRM field mapping for CTA owner, response window, top domain, and evidence request.
4. Add service-specific email and WhatsApp templates.
5. Add dashboard filters by assessment type, risk band, country, source, and CTA.
6. Add content clusters around each assessment domain for SEO and AI answer visibility.
