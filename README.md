# QuantumCrafters Studio - Network Command Growth OS

Production-grade Next.js product for QuantumCrafters Studio Pvt. Ltd. covering network administration, network security, managed services, cloud networking, penetration testing, troubleshooting, and training.

Repository:

```text
https://github.com/qcsstudio/Network-QCSS.git
```

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Prisma 7 schema for PostgreSQL
- Prisma PostgreSQL adapter
- Zod validation
- Lucide icons
- JSON local store for development fallback
- API routes for leads, events, assessments, resources, dashboard, health, and CSV export
- Admin session authentication
- Consent-aware analytics and marketing pixels
- CRM, email, and WhatsApp integration hooks
- Deployment readiness checks and Prisma migration deploy scripts

## Run Locally

```powershell
npm install
npm run dev
```

Open:

```text
http://localhost:3000
http://localhost:3000/admin
http://localhost:3000/api/health
```

Production-style local test:

```powershell
npm run build
npm run smoke
```

Production readiness report:

```powershell
npm run env:check
```

## Key Routes

- `/` - public diagnostic homepage
- `/services/[slug]` - service landing pages
- `/tools/[slug]` - assessment tools and lead magnets
- `/institute` - network and network security institute path
- `/resources` - resource and content engine
- `/admin` - operator dashboard
- `/admin/login` - protected admin login
- `/api/admin/readiness` - protected deployment readiness snapshot
- `/privacy` - privacy and consent policy
- `/sitemap.xml` - SEO sitemap
- `/robots.txt` - crawler rules

## Built Product Layers

- Public authority website
- Problem-based visitor routing
- Network Risk Score
- Firewall Hygiene Checker
- Pentest Readiness
- Cloud Network Readiness
- Troubleshooting Triage
- Career Path Finder
- Consent-aware tracking
- Lead capture and scoring
- Assessment persistence
- Resource intent capture
- Admin dashboard
- Admin login, signed session cookies, and admin API token support
- Admin and system audit logs
- Admin deployment readiness panel
- CSV export
- Prisma/PostgreSQL production schema
- Prisma migration for production deploys
- File-store and PostgreSQL-store adapter architecture
- Lead integration dispatch for webhook, HubSpot, Zoho, email, Resend, and WhatsApp
- Privacy-hardened public API responses
- Security headers
- SEO metadata, sitemap, robots, and AI-answer-friendly service structure

## Local Persistence

By default, development submissions are stored in:

```text
data/store.json
```

That file is ignored by Git because it can contain lead/contact data.

For production, configure:

```text
STORE_DRIVER=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/network_qcss?schema=public
```

Then use Prisma migrations:

```powershell
npm run prisma:generate
npm run prisma:deploy
```

## Admin Authentication

Set these before production:

```text
ADMIN_EMAIL=admin@network-qcss.local
ADMIN_PASSWORD=change-this-password
ADMIN_SESSION_SECRET=change-this-long-random-secret
ADMIN_API_TOKEN=change-this-api-token
```

Local development fallback credentials are:

```text
admin@network-qcss.local
admin
```

Do not use the fallback credentials in production. In production, admin login is disabled until `ADMIN_EMAIL` and
`ADMIN_PASSWORD` are configured. Use a long stable `ADMIN_SESSION_SECRET` so admin sessions remain valid across
deployments.

The dashboard and lead export are protected by signed admin cookies. Server-to-server admin API access can use:

```text
x-admin-token: ADMIN_API_TOKEN
```

## Growth Tracking and Consent

The browser layer starts with Google Consent Mode defaults set to denied. Analytics and marketing storage are upgraded
only after the visitor accepts the matching cookie categories.

Configure optional tracking IDs:

```text
NEXT_PUBLIC_GTM_ID=
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_META_PIXEL_ID=
NEXT_PUBLIC_LINKEDIN_PARTNER_ID=
NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO=
NEXT_PUBLIC_LINKEDIN_LEAD_CONVERSION_ID=
NEXT_PUBLIC_CONVERSION_CURRENCY=INR
NEXT_PUBLIC_LEAD_CONVERSION_VALUE=0
NEXT_PUBLIC_ASSESSMENT_CONVERSION_VALUE=0
```

Tracked browser events:

- `consent_updated`
- `generate_lead`
- `assessment_complete`
- `lead_magnet_download`

Meta Pixel and LinkedIn Insight are loaded only after marketing consent. Google Tag Manager and GA4 can run in consent
mode with denied storage until analytics consent is granted. The site does not try to read visitor email from the
browser; email is stored only when a visitor submits it.

## Integration Hooks

The lead API dispatches integrations after a lead is saved. These stay skipped until credentials are configured.

Generic webhook:

```text
LEAD_WEBHOOK_URL=https://your-automation-endpoint.example/leads
```

HubSpot:

```text
HUBSPOT_PRIVATE_APP_TOKEN=
HUBSPOT_FIELD_MAPPING_JSON=
```

Zoho CRM:

```text
ZOHO_ACCESS_TOKEN=
ZOHO_CRM_LEADS_URL=
ZOHO_FIELD_MAPPING_JSON=
```

Email automation:

```text
EMAIL_WEBHOOK_URL=
RESEND_API_KEY=
LEAD_ALERT_EMAIL_FROM=
LEAD_ALERT_EMAIL_TO=
```

Resend email alerts are sent only for hot leads. `EMAIL_WEBHOOK_URL` can be used for Zapier, Make, n8n, or a custom
automation endpoint.

WhatsApp:

```text
WHATSAPP_WEBHOOK_URL=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ALERT_TO=
WHATSAPP_TEMPLATE_NAME=
WHATSAPP_TEMPLATE_LANGUAGE=en_US
WHATSAPP_API_VERSION=v23.0
```

## Verification

Current verification commands:

```powershell
npm run lint
npm run typecheck
npx prisma generate
npm audit --audit-level=moderate
npm run env:check
npm run build
npm run smoke
```

## Operator Docs

- [Deployment runbook](docs/deployment-runbook.md)
- [Conversion and CRM mapping](docs/conversion-and-crm-mapping.md)

## Next Production Integrations

- WhatsApp template approval and message QA
- Google Ads enhanced conversions through GTM after legal review
- PDF report generation
- Role-based admin users beyond the current single-admin session model
- Content cluster expansion for India, global, managed network, cloud network, pentest, and institute search intent
