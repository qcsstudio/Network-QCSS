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

## Day 2 wired-lab contract

The writer, repair prompt and independent reviewer receive one shared fault-test instruction. Day 2 requests 10-12 lab steps, rather than the general 7-9, so router setup and the four fault/recovery actions can stay on separate, named consoles.

1. Keep 10.1.2.254 unused in the isolated lab. On EndpointB, enter `ip 10.1.2.10/24 10.1.2.254`, then `show ip`.
2. On EndpointA, enter `ping 10.1.2.10`. Expect failure with no echo replies because EndpointB's return path is broken. One-way delivery or a fresh ARP cache is not successful request-and-reply connectivity.
3. On EndpointB, restore `ip 10.1.2.10/24 10.1.2.1`, then `show ip`.
4. On EndpointA, repeat `ping 10.1.2.10` and expect replies. Repeat the explicit GNS3 console-opening instruction at each step.

The gate follows command order and console ownership. A self-ping, reversed test, early restoration, wrong restored gateway, intervening fault, missing retest, or negative recovery result does not pass. Supporting walkthroughs, verification, troubleshooting and answer explanations are also checked for known wrong-gateway/ARP success claims; independent review remains responsible for semantic correctness beyond these deterministic checks. This contract describes expected observations, not an executed lab.

The normalized visual alt text is: "A packet travels from EndpointA through Switch1, Router1 and Switch2 to EndpointB. The diagram ends at EndpointB." It is 113 characters, within the 200-character budget.

Both the visual boundary and each access-point or firewall comparison callout use the same complete, 208-character text: "Lab boundary: The access point and firewall are omitted from every hands-on and diagram step in this wired GNS3 lab. Wireless radio behavior and firewall policy are conceptual comparisons only, not simulated." Normalization cannot overwrite this with earlier ambiguous wording. Existing teaching points are preserved; a full field must be rewritten through the bounded repair workflow, never clipped or silently discarded.

Technical reference: [RFC 1122, local/remote routing and gateway selection](https://www.rfc-editor.org/rfc/rfc1122.html#section-3.3.1.1). A destination on another IP network requires gateway routing for the reply as well as the request.

## Regression coverage

Run `npm run test:ccna`, `npm run typecheck`, lint and the production build when changing these contracts. Tests cover citation-budget boundaries, canonical duplicates, untrusted URLs, combined schema/technical failures, malformed JSON, contradictory reviews, bounded repairs, changed-content approval, Day 2 console-separated fault recovery, visual limits and existing course/social behavior.

Fixture-based and mocked-review tests prove the pipeline's control flow. They do not prove that an LLM's technical judgment is correct or that a GNS3 lab was executed. A new live generation and independent review are still required before publishing an actual lesson. First-attempt publication is a reliability goal, not a guarantee; unresolved evidence or technical problems must keep a lesson on hold.
