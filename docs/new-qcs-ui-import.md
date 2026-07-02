# New QCS UI Full Import

Reference repository:

```text
https://github.com/qcsstudio/New-Qcs-UI.git
```

Imported source commit:

```text
6cb0427 Merge pull request #109 from qcsstudio/codex/review-linkedin-profile-makeover-page-s60rge
```

Imported location:

```text
vendor/new-qcs-ui
```

## Import Scope

The full reference source was imported into `vendor/new-qcs-ui`, including:

- `src`
- `public`
- `chrome-extension`
- `scripts`
- root configuration files
- package manifests
- PDFs, videos, images, fonts, CSS, SCSS, and plugin assets

The import excludes only runtime/repository/build folders and local secrets:

- `.git`
- `node_modules`
- `.next`
- `out`
- `.vercel`
- `.env`
- `.env.local`

## Why It Is Isolated

The reference repository is a complete Next.js application with its own routes, APIs, MongoDB models, payment routes, SCSS stack, Bootstrap, GSAP, Swiper, and legacy JavaScript. Directly merging those files into the active app would overwrite or conflict with the current production website-tool.

For now, the full theme is kept as a vendored source reference. The active app excludes `vendor/**` from ESLint and TypeScript checks so Vercel builds the production Network QCSS/QuantumCrafters product without typechecking the imported reference app.

## Activation Path

Use this order when migrating more of the theme into production:

1. Copy only the needed component or asset into active `src` or `public`.
2. Convert imports to the active app conventions.
3. Replace Bootstrap/GSAP dependencies with native CSS unless animation is essential.
4. Keep admin, Prisma, consent, audit logging, and lead APIs from the active app.
5. Run `npm run lint`, `npm run typecheck`, `npm run build`, and `npm run smoke`.
