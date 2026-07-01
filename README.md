# Network QCSS - Network Command Growth OS

This is the first runnable MVP of the recommended web tool.

## Run Locally

From this folder:

```powershell
node server.js
```

Then open:

- Public site: `http://localhost:4173`
- Operator dashboard: `http://localhost:4173/admin.html`
- Health check: `http://localhost:4173/api/health`

`npm start` is also defined in `package.json`, but direct `node server.js` is the safest command in this workspace because the local npm installation is currently pointing to a missing global npm CLI.

## GitHub Repository

This project is bound to:

```text
https://github.com/qcsstudio/Network-QCSS.git
```

## What Is Built

- Diagnostic homepage with problem-based routing
- Consent-aware tracking prototype
- Command search that routes visitor intent
- Network Risk Score tool
- Firewall Hygiene Checker
- Pentest Readiness tool
- Career Path Finder
- Lead capture form
- Local lead scoring and backend persistence
- Live operator dashboard preview
- Event stream preview
- Resource download triggers
- Responsive layout
- Interactive network topology canvas
- Node.js server with no external dependencies
- JSON-backed local database at `data/store.json`
- API endpoints for leads, events, assessments, resources, dashboard, and CSV export
- Admin dashboard at `admin.html`
- Privacy policy draft at `privacy.html`

## What Is Still Mocked

This MVP stores data locally. The production build should connect these areas to real systems:

- CRM sync: Zoho, HubSpot, or Freshsales
- Production-grade IP/country handling through CDN or hosting headers
- GA4 and Google Tag Manager
- Google Ads enhanced conversions
- LinkedIn Insight Tag
- Meta Pixel and Conversions API if Meta ads are used
- WhatsApp Business app/API
- Email automation
- Booking system
- Admin authentication
- PostgreSQL database storage
- PDF report generation

## Recommended Next Build Step

Convert this prototype into a Next.js application with:

- Server-rendered public pages for SEO
- API routes for form and tool submissions
- PostgreSQL database
- CRM connector
- Consent mode integration
- Admin dashboard authentication
- Real analytics and event dispatch
