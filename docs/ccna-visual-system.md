# CCNA teaching visuals

## Generation contract

New lesson generations include three distinct visual concepts, a selection rationale, a small diagram and three teaching stages. The plan is grounded in the completed lesson and verified bibliography. An independent instructor reviews the labels, connections, addresses, direction and stated simplifications. Invalid references, repeated concepts and overlong labels hold the lesson at its existing quality gate. These checks reduce errors; they do not prove technical accuracy without review.

The website exposes learner-controlled stages, keyboard-accessible controls, text explanations and source links. No animation or paid generation runs when a learner changes a stage. Social and Open Graph exports use the same lesson plan, exact code-rendered text and the original QCS logo. Vertical layers unfold left-to-right in wide exports without changing their order or connections.

The first lesson has a specifically reviewed fallback for its two-PC, one-switch /24 lab. Other legacy lessons do not borrow this illustration. New lesson plans take precedence. Existing LinkedIn posts are not edited or reposted by this change.

The premium blog image director also compares three concepts before selecting one; its existing render budget and independent visual critic remain in effect. It reads complete article sections without overriding the locked editorial focus. This release does not replace the separate procedural advisory renderer or generate all 60 course illustrations in advance. Existing editorial images retain the existing hash-based refresh behavior and cost limits.

## Rendering checks

- `npm run test:ccna`: visual schema, exact address matching, source mapping, concept distinction, contrast and source resolution.
- `npx tsx scripts/qa-ccna-visuals.mjs`: render all supported layouts and the first-lesson illustration at 1920x1080 and 1200x630; verify dimensions and nonblank pixels. Inspect the exported PNGs, because nonblank checks alone cannot detect clipping.
- Browser checks: 320px, 390px, 768px and desktop widths; no horizontal overflow; forward/reverse/reset controls; visible text, usable touch targets and loaded images.
- TypeScript, scoped ESLint and production build must pass before release.

The bitmap is 1672x941, displayed at no more than 800 CSS pixels wide: genuine 2x source resolution, not an upscaled 4K claim. Diagrams are vector-based. Small social previews cannot guarantee the same reading comfort as the full lesson, so the complete explanation remains accessible on the course page.

## First illustration provenance

Asset: `public/brand/ccna/first-network-tabletop-v1.jpg`. Generated with the built-in image generation tool, then encoded to JPEG at quality 90 with 4:4:4 chroma and no resizing. Generated artwork contains no branding or technical labels; those are added separately in the application.

Prompt:

> Use case: scientific-educational. Asset type: a wide, high-resolution editorial teaching illustration for the first QCS CCNA lesson, for adults who have never studied computers. Primary request: make a beautifully simple physical model of a first local computer network, with exactly TWO unbranded open laptops and ONE small unbranded Ethernet switch between them, joined by exactly TWO clearly traceable Ethernet cables, one from each laptop to a separate port of the switch. Three-quarter overhead studio photograph blended with precise architectural model craft, luminous white/light grey tabletop, tactile silver hardware, one teal cable and one coral cable, natural soft daylight and crisp realistic connector details. Give each laptop a blank pale screen with a single simple geometric message rectangle, no characters. The switch is a modest flat silver eight-port desktop Ethernet switch, not a router, no antennas, no Internet globe, no server rack, no extra equipment, no people. Make the two cable paths separate and visibly terminate in ports; don't merge cables or invent wireless paths. The complete three objects fit comfortably in the central 80 percent of a 16:9 landscape composition. Generous uncluttered breathing space around all edges and an especially calm top-left corner for later exact QCS logo placement. No visible text, letters, numbers, symbols resembling text, arrows, branding, watermarks, captions, callout boxes or borders. This scene establishes only physical connectivity, not proof of a working configuration. We add technically exact explanations separately in code. Original polished educational image, calm and inviting, not a stock cybersecurity picture, not a dark neon scene. Aim for 2560 by 1440 or larger landscape resolution.

The generator returned 1672x941. The photograph-like illustration is a teaching model, not a vendor hardware photograph or GNS3 screenshot. Cable placement should not be treated as a port-location guide for a particular laptop.

References: [W3C complex images](https://www.w3.org/WAI/tutorials/images/complex/), [Next.js ImageResponse](https://nextjs.org/docs/app/api-reference/functions/image-response).
