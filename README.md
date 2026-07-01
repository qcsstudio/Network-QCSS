# Network QCSS - Network Command Growth OS

Production-grade Next.js rebuild for a network administration, network security, managed services, cloud networking, penetration testing, troubleshooting, and training website-tool.

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
- CRM and WhatsApp integration hooks

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

## Key Routes

- `/` - public diagnostic homepage
- `/services/[slug]` - service landing pages
- `/tools/[slug]` - assessment tools and lead magnets
- `/institute` - network and network security institute funnel
- `/resources` - resource and content engine
- `/admin` - operator dashboard
- `/admin/login` - protected admin login
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
- CSV export
- Prisma/PostgreSQL production schema
- File-store and PostgreSQL-store adapter architecture
- Lead integration dispatch for webhook, HubSpot, Zoho, and WhatsApp
- Security headers
- SEO metadata, sitemap, and robots

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
npm run prisma:migrate
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

Do not use the fallback credentials in production.

The dashboard and lead export are protected by signed admin cookies. Server-to-server admin API access can use:

```text
x-admin-token: ADMIN_API_TOKEN
```

## Integration Hooks

The lead API dispatches integrations after a lead is saved. These stay skipped until credentials are configured.

Generic webhook:

```text
LEAD_WEBHOOK_URL=https://your-automation-endpoint.example/leads
```

HubSpot:

```text
HUBSPOT_PRIVATE_APP_TOKEN=
```

Zoho CRM:

```text
ZOHO_ACCESS_TOKEN=
ZOHO_CRM_LEADS_URL=
```

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
npm run typecheck
npx prisma generate
npm run build
npm run smoke
npm audit --audit-level=moderate
```

## Next Production Integrations

- Production PostgreSQL migration deployment
- Zoho CRM or HubSpot field mapping hardening
- WhatsApp template approval and message QA
- Email automation
- Google Tag Manager and GA4 Consent Mode
- Google Ads enhanced conversions
- LinkedIn Insight Tag
- PDF report generation
- Role-based admin users beyond the current single-admin session model
- Admin audit logs
