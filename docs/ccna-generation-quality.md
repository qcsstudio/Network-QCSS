# CCNA generation and approval contract

One generation job performs research, writes a draft, checks it, and makes at most two focused repairs. Passing a JSON schema or a word count alone never approves a lesson.

## Checks and ownership

| Check | Enforcement |
| --- | --- |
| Primary research | Three distinct searches and authoritative discovered URLs in `ccna-content-agent.ts`. Research remains evidence, not instructions. |
| Structure and field sizes | `ccnaGeneratedLessonSchema` is used for the writer's response schema and runtime validation. It requires the beginner guide, visual and paired command explanations. |
| Citation inventory | `ccna-citations.ts` canonicalizes fragment/tracking variants, deduplicates references, and prioritizes cited evidence over unused bibliography entries. |
| Source budget | One shared limit of ten distinct bibliography sources across teaching sections and visual stages. More than ten genuinely cited sources triggers evidence-aware repair, not citation deletion or an early exception. |
| Teaching, lab and assessment | `evaluateCcnaLessonForTopic` combines general teaching checks, command/explanation pairing, licensing, quiz checks and curriculum-specific requirements. Manual publishing calls the same evaluator. |
| Visual structure and copy | Generation uses the same composition budgets as visual approval. Node/connection references, final destination, complete phrases and source mappings are checked. Text is rewritten, never sliced to fit. |
| Independent technical review | Reviews the complete final candidate against researched evidence, lab boundaries, beginner accessibility, commands, quiz reasoning and visual meaning. Reviews also run on parseable drafts with field errors, so technical findings can accompany schema findings. |
| Revision integrity | The review stores a stable SHA-256 content digest. Manual publication requires a passing review for that exact saved revision. Older drafts without a bound review must be generated and reviewed under this contract. |

## Repair behavior

The pipeline gathers all available schema, citation, deterministic quality and independent-review findings for an attempt. The repair receives both the complete existing candidate and the combined findings. It must preserve correct content, fix the reported fields, and return a complete lesson for revalidation.

Malformed JSON cannot be technically reviewed; it is repaired first. Deterministic teaching checks requiring typed fields wait until those fields are structurally valid. The independent reviewer still examines parseable candidates with schema errors. No unchecked candidate can become ready.

Each attempt records schema status, whether review ran, review status, content digest and the full findings. A failed final structured draft remains `needs_review`. An unrepairable malformed draft retains diagnostics and does not enter another automatic paid validation loop. Network, authentication, quota and provider failures remain operational failures, not technical approvals.

## Provider capacity

Research, drafting, repairs and independent review share one bounded request runner. A temporary OpenAI token/request limit or explicit model-overload error retries the same request at most twice. The runner honors Retry-After (including dates and milliseconds), the provider's stated retry interval, or reset headers; otherwise it uses exponential backoff. Positive jitter is added, never subtracted from the provider's minimum. The whole job may spend at most 60 seconds waiting and stops within a 270-second application deadline, leaving time for persistence before Vercel's 300-second route limit.

Authentication, billing/quota failures and ambiguous network failures are not replayed. A request that exceeds the model's entire TPM limit is not retried unchanged. Exhaustion is reported as a capacity or deadline problem, not a technical-review failure. Request retries do not reduce the lesson's output allowance, truncate its content or replace the independent review model. Retry events are recorded in the generation trace and server logs. No claim is made that one process can control other workloads sharing the organization's limits.

Official reference: [OpenAI rate-limit handling](https://developers.openai.com/api/docs/guides/rate-limits).

## Regression coverage

Run `npm run test:ccna`, `npm run typecheck`, lint and the production build when changing these contracts. Tests cover citation-budget boundaries, canonical duplicates, untrusted URLs, combined schema/technical failures, malformed JSON, contradictory reviews, bounded repairs, changed-content approval, Day 2 console-separated fault recovery, visual limits and existing course/social behavior.

Fixture-based and mocked-review tests prove the pipeline's control flow. They do not prove that an LLM's technical judgment is correct or that a GNS3 lab was executed. A new live generation and independent review are still required before publishing an actual lesson. First-attempt publication is a reliability goal, not a guarantee; unresolved evidence or technical problems must keep a lesson on hold.
