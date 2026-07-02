# Frontend Theme Adaptation

Reference reviewed:

```text
https://github.com/qcsstudio/New-Qcs-UI.git
```

## What Was Reused

The current product does not import the full reference SCSS, Bootstrap, GSAP, Swiper, or animation stack. Instead, it ports the strongest design patterns into the lean Next.js product:

- Network-support style section navigation
- Old model vs QuantumCrafters model comparison
- Multi-vendor pill cloud
- Industry/use-case pill cloud
- Diagnose, stabilise, secure, support delivery timeline
- Dark technical topology feel in the hero visual
- Orange-led accent system aligned with the QCS theme and the supplied logo

## Why Not Copy The Full Theme

The reference repository is a larger agency website with many routes, animation libraries, plugins, legacy JavaScript, PDFs, and dashboard features. This product is intentionally lighter because it also contains lead capture, audit logging, consent-aware tracking, PostgreSQL readiness, and admin operations. Pulling the entire theme would increase bundle size and maintenance risk.

## Design Direction

Keep future frontend changes close to this direction:

- Exact QuantumCrafters Studio logo as the brand anchor
- Dark hero and technical command surfaces
- White operational sections for readability
- Orange, magenta, violet, and blue accents from the logo
- Concrete support model, vendor coverage, process, and service proof
- Public page simple enough for buyers, private/admin layer powerful enough for marketing operations
