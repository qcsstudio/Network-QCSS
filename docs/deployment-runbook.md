# Network QCSS Deployment Runbook

This runbook is for taking the product from local file-store mode to production PostgreSQL mode.

## 1. Required Environment

Set these in the hosting provider before production deploy:

```text
NEXT_PUBLIC_SITE_URL=https://your-domain.example
STORE_DRIVER=postgres
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/network_qcss?schema=public
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=
ADMIN_API_TOKEN=
```

Use a long random value for `ADMIN_SESSION_SECRET` and `ADMIN_API_TOKEN`.

## 2. Optional Growth Environment

```text
NEXT_PUBLIC_GTM_ID=
NEXT_PUBLIC_GA_ID=
NEXT_PUBLIC_GOOGLE_ADS_LEAD_SEND_TO=
NEXT_PUBLIC_META_PIXEL_ID=
NEXT_PUBLIC_LINKEDIN_PARTNER_ID=
NEXT_PUBLIC_LINKEDIN_LEAD_CONVERSION_ID=
NEXT_PUBLIC_CONVERSION_CURRENCY=INR
NEXT_PUBLIC_LEAD_CONVERSION_VALUE=0
NEXT_PUBLIC_ASSESSMENT_CONVERSION_VALUE=0
```

Marketing pixels load only after marketing consent. GA4 and GTM run with consent-mode defaults until the visitor updates choices.

## 3. Production Database

Generate Prisma client and deploy migrations:

```powershell
npm run prisma:generate
npm run prisma:deploy
```

For a fresh database, the first migration creates:

- `Lead`
- `InteractionEvent`
- `Assessment`
- `ResourceDownload`
- `AuditLog`

## 4. Predeploy Check

For a non-blocking local report:

```powershell
npm run env:check
```

For a strict production check:

```powershell
$env:REQUIRE_PRODUCTION_ENV="true"
npm run env:check
```

For code and build verification:

```powershell
npm run deploy:check
```

## 5. Postdeploy Smoke

After the app is live:

1. Open `/api/health`.
2. Log in at `/admin/login`.
3. Check the Deployment readiness panel.
4. Submit one internal test lead.
5. Confirm the lead appears in `/admin`.
6. Export `/api/export/leads.csv`.
7. Check the audit log for `lead.created`, `admin.dashboard_view`, and `admin.leads_export`.

## 6. Rollback Notes

The public site can run in `STORE_DRIVER=file` mode for emergency rollback, but production leads will then be stored only in the local JSON store of that runtime. Use PostgreSQL for real traffic.
