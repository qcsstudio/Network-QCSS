# Envato Growth Asset System

Last updated: 2026-07-15

## Goal

Use Envato as a controlled asset supply chain for the QCSS network administration, network security, managed services, cloud networking, training, penetration testing, and troubleshooting platform.

The target is not a theme swap. The target is a premium public website that quietly powers a private marketing command center: lead capture, source attribution, tool usage, service interest, funnel stage, follow-up priority, SEO/AIO content, sales collateral, and campaigns.

## Verified Envato Context

- Envato Elements currently presents itself as an all-in-one creative asset toolkit with AI tools, stock, fonts, videos, music, templates, graphics, 3D, and more: https://elements.envato.com/
- Elements exposes useful categories for this project: video templates, stock video, audio, graphics, design templates, social media, UX/UI toolkits, infographics, presentations, photos, 3D, fonts, web templates, admin templates, email templates, site templates, and landing pages: https://elements.envato.com/
- Envato Elements licenses each downloaded item for a single specified project/end use, and a new license is needed for a different project: https://help.elements.envato.com/hc/en-us/articles/360000628966-Envato-Elements-License
- Envato Elements and Envato Market are separate. ThemeForest and CodeCanyon purchases must be tracked separately from Elements downloads: https://help.elements.envato.com/hc/en-us/articles/5348875382809-What-is-the-difference-between-Envato-Elements-subscription-and-Envato-Market
- CodeCanyon is useful for scripts/plugins/libraries, but third-party app code should be treated as reference or isolated tooling until it passes security and license review: https://codecanyon.net/

## Asset Stack

### 1. Primary Next.js Theme

Purpose: public website visual foundation.

Use for:

- home page structure;
- service landing page patterns;
- online tool page layout;
- animations and interactions;
- visual density and spacing;
- responsive section ideas.

Import method:

- audit dependencies and package quality first;
- extract design tokens, layouts, and component ideas;
- rewrite selected sections into the existing QCSS Next.js app;
- do not replace our app routing, database, lead capture, or tracking logic.

Selection standard:

- Next.js App Router preferred;
- TypeScript preferred;
- Tailwind preferred, Bootstrap acceptable only if visuals are much stronger;
- modern but readable dark/light visual system;
- polished mobile behavior;
- deep section library;
- recent update history and documentation.

### 2. Admin Dashboard Template

Purpose: private operator command center.

Use for:

- lead funnel dashboard;
- campaign/source analytics;
- country/device/consent reporting;
- tool usage tables;
- service-intent pipeline;
- follow-up queue;
- sales forecast and course enrollment views.

Import method:

- keep current auth/server structure;
- extract chart/table/filter/card patterns;
- map visual components to QCSS data models;
- avoid importing demo APIs, fake auth, or unreviewed backend code.

### 3. UX/UI Kit Or Figma Kit

Purpose: consistency across pages and future campaigns.

Use for:

- cards, forms, tabs, filters, tool panels;
- pricing/comparison blocks;
- lead magnet landing pages;
- report/dashboard modules;
- mobile spacing and typography references.

Import method:

- convert to design tokens first;
- use as a component reference;
- do not copy unused screens into production.

### 4. 3D Cyber/Network Graphics

Purpose: make the brand feel premium and category-specific.

Use for:

- hero artwork;
- service-page illustrations;
- online tool page visual cards;
- proposal decks and PDFs;
- social campaigns.

Preferred subjects:

- cloud network mesh;
- SOC/NOC command dashboard;
- firewall and shield systems;
- data center/server rack;
- secure VPN tunnel;
- global node map;
- Wi-Fi heatmap or signal grid;
- penetration testing and vulnerability scan visuals.

Import method:

- convert final web assets to optimized WebP/AVIF/PNG;
- store production-ready images under `public`;
- keep source files local in `envato-assets`;
- document source and license in the register.

### 5. Icons And Infographics

Purpose: fast scanning, SEO page richness, and report quality.

Use for:

- service icons;
- online tools;
- process diagrams;
- course modules;
- audit reports;
- FAQ and comparison blocks.

Selection standard:

- SVG or editable vector source;
- one consistent style;
- works on dark and light backgrounds;
- no generic lock-only cyber visuals as the main system.

### 6. Presentations And Sales Decks

Purpose: turn the website into a sales enablement engine.

Use for:

- managed network service proposal;
- network security assessment deck;
- VAPT scoping deck;
- cloud networking migration deck;
- institute/course deck;
- webinar slides.

Import method:

- create QCSS-branded variants;
- connect deck CTAs back to tracked URLs;
- use the same content claims and visual system as the website.

### 7. Lead Magnet PDF Templates

Purpose: gated resources and trust-building content.

First PDFs to create:

- Network Security Audit Checklist;
- Cloud Network Readiness Checklist;
- Firewall Hardening Checklist;
- SMB Network Troubleshooting Guide;
- VAPT Scope Planning Template;
- Wi-Fi Performance Checklist;
- Network Security Course Prospectus.

Import method:

- adapt templates into QCSS-branded PDFs;
- publish each through a tracked landing page;
- connect every download to lead scoring and follow-up stage.

### 8. Social And Video Campaign Assets

Purpose: feed the site with campaigns and retargeting loops.

Use for:

- LinkedIn carousels;
- short vertical security tips;
- webinar promos;
- service explainers;
- course enrollment campaigns;
- audit offer campaigns.

Import method:

- produce reusable campaign families;
- match each campaign to a landing page and UTM structure;
- keep editable sources local.

### 9. Email Templates

Purpose: automate follow-up after downloads, forms, and tool usage.

Sequences:

- audit request confirmation;
- lead magnet delivery;
- network tool result follow-up;
- VAPT consultation nurture;
- course enrollment nurture;
- monthly security bulletin;
- reactivation campaign.

Import method:

- extract the cleanest responsive HTML patterns;
- convert content to QCSS copy;
- wire into the future email provider with tracked links.

### 10. CodeCanyon Review Bucket

Purpose: feature inspiration or isolated utilities only.

Possible areas:

- helpdesk/ticketing;
- CRM/lead management;
- appointment booking;
- LMS/course portal;
- live chat;
- knowledge base.

Rule:

Do not merge a purchased script into the QCSS application until we review licensing, dependencies, security posture, data model, auth, build process, and long-term maintenance risk.

## Scoring Matrix

Score each candidate out of 100 before importing:

- Visual/futuristic quality: 15
- QCSS domain fit: 12
- Architecture and framework quality: 15
- Responsiveness and accessibility: 10
- Content/page depth: 10
- Dashboard or component usefulness: 10
- SEO/AIO friendliness: 8
- Documentation and license clarity: 8
- Update history, reviews, and sales confidence: 7
- Safe extraction into current app: 5

Reject any asset with:

- unclear license;
- broken demo;
- heavy unmaintained dependency stack;
- hardcoded demo backend;
- inaccessible source files;
- generic visuals that do not support network/security positioning;
- poor mobile behavior.

## QCSS Integration Roadmap

### Phase 1: Intake

Create the Envato project registration, download assets into `envato-assets`, and fill `asset-register.csv`.

### Phase 2: Audit

For each package:

- inspect package structure;
- inspect dependencies;
- preview demo if included;
- check license files and third-party assets;
- classify import decision as `use`, `partial`, `reference`, or `reject`.

### Phase 3: Design System

Extract:

- colors based on QCSS logo gradient;
- typography scale;
- spacing scale;
- button/input/card systems;
- dark and light section styles;
- icons and illustration rules;
- animation rules.

### Phase 4: Public Site

Rebuild:

- homepage;
- services hub;
- service detail pages;
- network tools hub;
- tool detail pages;
- institute/course pages;
- resources hub;
- lead magnet landing pages;
- contact and consultation pages.

### Phase 5: Private Dashboard

Implement dashboard views:

- overview;
- leads;
- funnel;
- traffic sources;
- online tool usage;
- downloads;
- service interest;
- campaign performance;
- follow-up queue;
- exports.

### Phase 6: Campaign Engine

Create:

- PDF lead magnets;
- email sequences;
- social carousel templates;
- short video templates;
- proposal decks;
- webinar decks.

### Phase 7: Measurement And SEO/AIO

Add:

- schema per page type;
- Open Graph image templates;
- FAQ blocks;
- internal linking;
- city/India/global landing pages;
- UTM tracking;
- cookie consent-aware analytics;
- event tracking for forms, downloads, tool usage, and CTAs.

## Working Rule

Envato supplies the polish. QCSS supplies the product intelligence. Every imported asset must either improve conversion, trust, clarity, SEO/AIO visibility, lead capture, sales enablement, or the owner dashboard.
