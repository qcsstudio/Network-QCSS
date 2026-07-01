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
- Zod validation
- Lucide icons
- JSON local store for development fallback
- API routes for leads, events, assessments, resources, dashboard, health, and CSV export

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
- CSV export
- Prisma/PostgreSQL production schema
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
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/network_qcss?schema=public
```

Then use Prisma migrations:

```powershell
npm run prisma:generate
npm run prisma:migrate
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

- Admin authentication
- PostgreSQL repository implementation behind the current store interface
- Zoho CRM or HubSpot sync
- WhatsApp Business API lead notifications
- Email automation
- Google Tag Manager and GA4 Consent Mode
- Google Ads enhanced conversions
- LinkedIn Insight Tag
- PDF report generation
- Role-based admin users and audit logs
