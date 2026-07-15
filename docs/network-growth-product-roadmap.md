# Network Growth Product Roadmap

## Product Thesis

QuantumCrafters Studio should look simple to visitors and behave like a marketing and operations system for the owner.

The public site should attract four kinds of intent:

- Buyers looking for managed network services, NOC, firewall, SD-WAN, SASE, cloud networking, and troubleshooting.
- Security buyers looking for penetration testing, firewall hardening, email/domain security, and exposure review.
- Learners looking for practical network and network security institute programs.
- Operators looking for quick online DNS, SSL, email, header, and port tools.

The private layer should track the path from visit to utility use, assessment, lead magnet, lead, and hot lead.

## Research-Informed Positioning

Large competitors lead with scale, global NOC, SD-WAN/SASE platforms, lifecycle services, and enterprise SLAs. Public references reviewed during this phase included Google Search Central, Tata Communications, Sify Technologies, NTT DATA, Cisco, Palo Alto Networks, MXToolbox, and DNSChecker.

The differentiated QCS position:

- "Network command studio" instead of generic IT support.
- Integrated service model: operate, secure, monitor, test, and train.
- Practical bridge between enterprise MSP and individual consultant.
- Security testing connected to remediation, not just reporting.
- Institute powered by real operations problems.
- Public tools used as useful utilities and intent capture.

## Recommended Website Structure

1. Home
   - Clear positioning.
   - Service paths.
   - Support model comparison.
   - Vendor and industry coverage.
   - Diagnostic assessments.
   - Free network utility tools.
   - Resource downloads.
   - Lead capture.

2. Service Pages
   - Managed Network Services.
   - Network Security Services.
   - Cloud Network Services.
   - Penetration Testing.
   - Network Troubleshooting.
   - NOC as a Service.
   - Firewall Management.
   - Managed Wi-Fi and LAN.

3. Assessment Tools
   - Network Risk Score.
   - Firewall Hygiene Checker.
   - Pentest Readiness.
   - Cloud Network Readiness.
   - Career Path Finder.
   - Troubleshooting Triage.

4. Utility Tools
   - DNS Lookup.
   - MX Lookup.
   - SPF and DMARC Checker.
   - SSL Certificate Checker.
   - HTTP Security Header Checker.
   - Port Reachability Checker.

5. Institute
   - Network engineering career paths.
   - Network security labs.
   - Corporate training.
   - Course-specific landing pages as the next phase.

6. Resources
   - Checklists.
   - Scope templates.
   - Readiness guides.
   - Career roadmaps.

7. Admin Dashboard
   - Leads.
   - Hot leads.
   - Utility runs.
   - Assessments.
   - Resources.
   - Funnel conversion.
   - Pipeline mix.
   - Country and attribution signals.
   - Deployment readiness.

## SEO and AIO Implementation Principles

Implemented now:

- Unique title and description metadata for service, assessment, and network utility pages.
- Canonical URLs for network utility pages.
- Sitemap coverage for services, assessments, and utility tools.
- Organization and Website JSON-LD at the site level.
- Service JSON-LD on service pages.
- WebApplication JSON-LD on assessment and utility pages.
- BreadcrumbList JSON-LD on service, assessment, and utility pages.
- `llms.txt` endpoint to summarize the site for AI agents and crawlers.
- Helpful, task-focused content instead of keyword-stuffed pages.

Next SEO/AIO phase:

- Add author/reviewer pages for E-E-A-T signals.
- Add real case studies and anonymized incident stories.
- Add city and country landing pages only where the business can genuinely serve and support the market.
- Add course pages with Course structured data once course details are final.
- Add original benchmark content from anonymized tool usage and assessment patterns.
- Connect Google Search Console and analytics exports into the dashboard.

## Utility Tool Safety Rules

Public utility tools should be useful without becoming unsafe infrastructure.

Current safety model:

- Reject localhost, `.local`, `.internal`, private, loopback, multicast, and reserved IP targets.
- Use short timeouts.
- Run one bounded check at a time.
- Store utility-run events only when analytics consent allows it.
- Do not store raw visitor IPs; store only hashed IP context through the existing request context.

## Backend Dashboard Roadmap

Implemented now:

- Funnel metrics: sessions, utility runs, assessments, resources, leads, hot leads.
- Lead conversion rate.
- Top utility tools.
- Pipeline mix.
- Latest leads, assessments, events, and audit logs.

Next backend phase:

- Add pageview capture after consent.
- Add source and landing-page attribution rollups.
- Add lead stages: new, contacted, qualified, proposal, won, lost.
- Add manual notes and next follow-up date.
- Add WhatsApp/call click tracking.
- Add Search Console import when credentials are available.
- Add CRM/webhook sync for leads and assessment completions.
