# Envato Asset Audit

Last updated: 2026-07-16

## Import Strategy

The project should not become a pasted template. The stable path is to keep the current Next.js 16 product architecture, import only selected visual assets, and rebuild sections in the QuantumCrafters design system.

Raw Envato downloads stay in `envato-assets/` and are ignored by git. Curated web assets can be copied into `public/brand/envato/` when they are part of the finished website experience.

## Accepted Assets

| Asset | Decision | Use |
| --- | --- | --- |
| Cybal - Cyber Security Next js Template | Partial import | Selected security/network imagery for trust and service sections |
| Cloud Network Outline Icon Set | Partial import | Primary custom icon system for network, cloud, router, server, Wi-Fi, and security visuals |
| Dashtrans - Next.js 16 & ShadCN UI Admin Dashboard | Reference | Future dashboard layout, charts, data tables, cards, theme system |
| 3D network/router/security models | Deferred | Render or optimize into web-safe derivatives before public use |
| Dynamic Cybersecurity Social Media Reels | Deferred | Social launch and retargeting creative after positioning stabilizes |

## Rejected Or Held

Skywave was the strongest public-theme candidate during research, but the local extracted folder does not contain a usable `src`, `app`, or `public` implementation tree. It is blocked until a complete package is available.

Tecch is useful as a service-structure reference, but the extract is Bootstrap-heavy and visually less aligned with the QuantumCrafters logo palette.

The flat icon sets are useful backups, but the current website should use one consistent outline icon family to avoid a mixed visual language.

## Current Web Imports

Curated files now live under `public/brand/envato/`:

| File | Source | Use |
| --- | --- | --- |
| `cyber/network-service-operator.jpg` | Cybal `service_details.jpg` | Asset-led trust section |
| `cyber/security-shield-network.png` | Cybal `home.png` | Supporting cyber visual |
| `cyber/data-access-cloud.png` | Cybal `computer.png` | Supporting data access visual |
| `icons/global-cloud-network.svg` | Cloud Network Outline Icon Set | Global network and cloud pages |
| `icons/router-cloud-network.svg` | Cloud Network Outline Icon Set | Managed network and routing pages |
| `icons/server-cloud-network.svg` | Cloud Network Outline Icon Set | NOC and hosting pages |
| `icons/security-cloud-network.svg` | Cloud Network Outline Icon Set | Network security pages |
| `icons/protected-cloud-network.svg` | Cloud Network Outline Icon Set | Pentest and assurance pages |
| `icons/multicloud-network.svg` | Cloud Network Outline Icon Set | Cloud network services |
| `icons/wifi-cloud-network.svg` | Cloud Network Outline Icon Set | Managed Wi-Fi and LAN |

## Next Import Phases

1. Dashboard phase: adapt Dashtrans patterns into the existing `/admin` dashboard without wholesale template replacement.
2. Service-page visual phase: add Envato icons and selected imagery to individual service pages.
3. 3D phase: render or optimize GLB assets into controlled web visuals. Do not publish raw source models directly.
4. Social phase: turn the cybersecurity reels pack into LinkedIn, Instagram, YouTube Shorts, and retargeting sequences.
