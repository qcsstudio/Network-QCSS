# Advisory-specific image generation

## What changed

Security advisories previously bypassed the image director and always used the
procedural diagram renderer. They now use the same directed render and independent
visual review stages as premium editorial images, with additional advisory gates.
The image must explain the technical relationship without relying on a changed
title, CVE label, colour or vendor name.

## Pipeline

1. Build a brief from the reviewed advisory, retaining the full summary, mechanism,
   impact, remediation and workaround text. Preserve unknown-exploitation and
   other limitations; do not invent an attack path.
2. OpenAI proposes three different visual explanations. It selects one and records
   at least two exact advisory fact excerpts and the visual elements they motivate.
3. Before rendering, validate those excerpts and reject an exact repeat of a recent
   scene or diversity signature. The director and critic also compare the broader
   composition semantically; different colours alone do not count as originality.
4. Render once using configured BFL, or direct OpenAI only when explicitly enabled.
   No Vercel AI Gateway is involved. Do not silently fall back to procedural artwork.
5. An independent image critic examines the actual render for factual accuracy,
   unsupported implications, specificity, repetition and safe framing. Explicit
   approval, passing thresholds and no blocking violations are all required.
6. Produce the website (1440 x 810) and LinkedIn (1200 x 627) derivatives from that
   same approved master, preserving the existing QCS logo overlay and revision
   lineage. Essential subjects must survive both crops and mobile display.

## Failure, cost and rollout

- Existing paid-image defaults remain two image records daily and twelve monthly.
  These are application scheduling limits, not a provider-enforced monetary cap;
  concurrent requests and explicit retries can incur additional charges.
- A missing provider, unavailable budget, failed render or rejected image does not
  become a successful template image. The admin image status records the error.
- After a failed paid advisory render, automation will not request another for the
  same prompt. Review the error and explicitly retry from admin. A changed advisory
  brief can also allow a fresh attempt. Budget/credential preflight failures remain
  eligible for the existing retry schedule because no render was requested.
- LinkedIn's existing image-readiness and revision checks hold delivery until an
  approved image is ready. Advisory text publication is not made dependent on art.
- Web and Open Graph routes use a plainly labelled pending illustration state when
  an asset is missing, not an invented diagram. Pending responses are not cached.
- Existing ready images remain visible until their replacement is requested. The
  changed advisory prompt invalidates the old generation cache on the next job.
  This code change does not itself mass-regenerate images or repost LinkedIn items.

## Verification

Run the focused Node tests in `tests/advisory-image-policy.test.mjs`,
`tests/editorial-image-agents.test.mjs`, `tests/editorial-image-prompt.test.mjs`,
`tests/editorial-image-state.test.mjs` and `tests/editorial-story-lineage.test.mjs`.
Provider runners in policy tests are mocks: these tests incur no image API charges.
Visual originality remains probabilistic, so production samples still need periodic
human review; the gates are not a promise of perfect images.
