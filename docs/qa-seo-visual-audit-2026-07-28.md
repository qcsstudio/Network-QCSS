# QCS Website QA, SEO, Content, and Visual Audit

Date: 28 July 2026  
Production baseline: https://www.qcsstudio.com

## Executive finding

The website had strong route coverage, metadata, structured data, accessibility, and responsive layout checks. Its main weaknesses were not missing pages. They were experience quality: stale internal links, internal marketing language exposed in public copy, an unnecessarily long home page, optional tracking loaded before consent, a malformed robots directive, and limited external proof.

## Defects and resolution

| Severity | Finding | Evidence | Resolution |
| --- | --- | --- | --- |
| Critical | Ten public internal links returned 404 | Blog tool links referenced retired slugs for DNS, BGP, VPN, firewall, cloud, traceroute, headers, port, and reputation tools | Repointed every link to a current tool or assessment and added link-graph regression checks |
| High | Public copy exposed internal strategy | Phrases included "QCS should sell", "buyer triggers", "lead-ready", and "problems people actually search for" | Rewrote the affected home, service, solution, assessment, resource, and illustration copy around customer decisions and deliverables |
| High | Home page was excessively long | 21,699 px at 1440 px; 56 utility cards, 18 H2 headings, and 84 main links | Limited home to six priority tools, added one library CTA, and removed two redundant navigation/process sections |
| High | Optional Google code loaded before consent | GTM contributed about 67 KiB unused JavaScript in the mobile Lighthouse run while optional consent was denied | Tags now load only after analytics or marketing consent; direct GA is a fallback when GTM is absent |
| High | Generated editorial images could fail intermittently in production | Vercel runtime telemetry showed resource and advisory visual requests entering a missing Next image-optimizer module | Dynamic 1920 x 1080 visual routes now bypass redundant optimization, with a browser regression check |
| High | Mobile performance lagged the visual quality | Lighthouse performance: home 74, penetration testing 81, network tools 77; home LCP 4.8 s | Prioritized and compressed the hero LCP request, reduced home DOM/content volume, right-sized the header logo, and deferred tracking |
| Medium | Home SEO audit was reduced by invalid robots syntax | `Host` contained a full URL including scheme | Removed the non-standard Host directive; sitemap and crawl exclusions remain |
| Medium | Opening proof used quantity claims that were difficult to substantiate on-page | 24x7, 30+, and a numerical operating-model strip lacked linked evidence | Replaced them with verifiable delivery controls: vendor-neutral, authorized, evidence-led, India plus global |
| Medium | Existing QA gave a misleading 100 despite broken journeys | It checked sitemap pages but did not crawl links or detect strategy copy | Added link health, duplicate metadata, robots validity, public-language, consent, and home-density assertions |
| Residual | Authority proof is weaker than established competitors | No approved customer logos, quantified case studies, analyst recognition, accreditation, or testimonials are available in the repository | Do not invent proof. Add only after QCS supplies approved names, outcomes, credentials, and permission to publish |

## Competitor visual benchmark

The benchmark used current official pages, not marketplace templates.

- [Cato Networks](https://www.catonetworks.com/platform/) communicates one platform through a compact capability model and a single primary action.
- [Cloudflare One](https://www.cloudflare.com/zero-trust/) introduces customer proof, analyst recognition, architecture, measurable outcomes, and FAQs in a disciplined sequence.
- [NCC Group](https://www.nccgroup.com/penetration-testing-services/) makes methodology, service coverage, benefits, and accreditations explicit.
- [Tata Communications IZO](https://www.tatacommunications.com/izo) supports its story with operating scale, analyst recognition, and named case studies.
- [Microland](https://www.microland.com/) uses concise service architecture, global operating facts, and independent recognition.
- [Sify Managed Network Services](https://www.sifytechnologies.com/network-services/managed-network-services/) explains NOC, security, transformation, OEM support, and FAQs in a practical service hierarchy.
- [INE Security](https://learn.ine.com/ine-security) and [OffSec Enterprise](https://help.offsec.com/hc/en-us/articles/14315739880724-Learn-Enterprise-Subscription-FAQ) differentiate training through labs, ranges, assessments, and observable skill progression.

## QCS visual and positioning direction

QCS should not imitate the scale claims of a carrier or the monochrome product story of a single-platform vendor. Its defensible position is an evidence-led network command studio: diagnose the issue, authorize the work, connect findings to owners, remediate, retest, and build internal capability.

The visual system should therefore favor:

1. Operational views and evidence states over decorative cyber imagery.
2. One clear decision per section, with six or fewer repeated items on the home page.
3. Customer problem language instead of SEO, funnel, or sales terminology.
4. Real deliverables, authorization controls, and retest states as trust signals.
5. Restrained brand accents, readable body typography, and compact technical labels.
6. Approved case evidence as the next trust layer when it becomes available.

## Release gates

- All sitemap routes return success and retain unique title, description, canonical, H1, Open Graph, Twitter, and valid JSON-LD.
- Every internal link resolves.
- No serious or critical accessibility violations on representative page families.
- No horizontal overflow, clipped controls, failed images, low-resolution media, misaligned card rows, or inadequate section gutters at 390, 768, 1024, 1440, and 1920 px.
- Optional analytics and marketing scripts remain absent before consent.
- Production Lighthouse, browser, and runtime-log checks run after deployment.

## Local validation result

- Production build, TypeScript, and ESLint: passed.
- Expanded SEO/content/link crawl: 100/100 across 94 sitemap routes.
- Production crawl after deployment: 100/100 across the same 94 routes, including live internal-link resolution.
- Browser QA: eight suites passed, including every sitemap route at 1440, 1024, 768, and 390 px plus representative 1920 px checks.
- Accessibility: no serious or critical Axe violations on representative page families.
- Lighthouse after the change: accessibility 100, best practices 100, SEO 100, CLS 0.
- Mobile lab FCP improved from 1.91 s to 1.38-1.64 s and LCP from 4.77 s to 4.02-4.29 s in local production runs. TBT remained lab-variable at 0.53-1.51 s, so production field data should be the performance source of truth.
