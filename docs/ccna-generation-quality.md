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

## Complete structured writing

The former single 14,000-token teaching request could end with `status: incomplete` and `max_output_tokens` before the combined gate could run. Writing now uses three coordinated JSON parts from the same full schema: lab and bibliography first, then teaching and beginner support, then the visual and assessments. Later parts receive the completed lab and earlier material; all parts are assembled before the existing full validation and independent review. Schema fields are assigned exactly once, and adding a required field without assigning it fails locally before a paid writing call.

Normal output ceilings are 6,000 / 8,000 / 5,000 tokens. Only a confirmed `max_output_tokens` response permits one fresh, complete retry of that part at 8,000 / 10,000 / 7,000 respectively, with concise-writing instructions. No partial JSON is joined, parsed as a lesson, or published. There are at most two output-limit recoveries shared across the whole job, including repair passes and a review recovery from 1,600 to 3,000 tokens. The existing deadline, rate-limit wait budget and two full-content repair limit still apply. Research and completed writing parts are reused within the current attempt; this is not durable cross-job checkpointing.

The configured models and their reasoning settings remain unchanged. Refusals, content filters, empty or failed responses do not trigger output-budget escalation. Exhausted output recovery places the job in `needs_review`, not another automatic full-research retry. Response IDs, completion reasons and token usage are stored in diagnostics; partial lesson text is not logged. Approval still requires an independent passing review of the exact assembled revision. No token allowance is a guarantee that a model will finish or that its content is correct.

Official reference: [OpenAI Responses API](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create). `max_output_tokens` includes visible output and reasoning tokens; incomplete responses require explicit handling.

## Day 2 wired-lab contract

The writer, repair prompt and independent reviewer receive one shared fault-test instruction. Day 2 requests 10-12 lab steps, rather than the general 7-9, so router setup and the four fault/recovery actions can stay on separate, named consoles.

1. Keep 10.1.2.254 unused in the isolated lab. On EndpointB, enter `ip 10.1.2.10/24 10.1.2.254`, then `show ip`.
2. On EndpointA, enter `ping 10.1.2.10`. Expect failure with no echo replies because EndpointB's return path is broken. One-way delivery or a fresh ARP cache is not successful request-and-reply connectivity.
3. On EndpointB, restore `ip 10.1.2.10/24 10.1.2.1`, then `show ip`.
4. On EndpointA, repeat `ping 10.1.2.10` and expect replies. Repeat the explicit GNS3 console-opening instruction at each step.

The gate follows command order and console ownership. A self-ping, reversed test, early restoration, wrong restored gateway, intervening fault, missing retest, or negative recovery result does not pass. Supporting walkthroughs, verification, troubleshooting and answer explanations are also checked for known wrong-gateway/ARP success claims; independent review remains responsible for semantic correctness beyond these deterministic checks. This contract describes expected observations, not an executed lab.

The normalized visual alt text is: "A packet travels from EndpointA through Switch1, Router1 and Switch2 to EndpointB. The diagram ends at EndpointB." It is 113 characters, within the 200-character budget.

Both the visual boundary and each access-point or firewall comparison callout use the same complete, 208-character text: "Lab boundary: The access point and firewall are omitted from every hands-on and diagram step in this wired GNS3 lab. Wireless radio behavior and firewall policy are conceptual comparisons only, not simulated." Normalization cannot overwrite this with earlier ambiguous wording. Existing teaching points are preserved; a full field must be rewritten through the bounded repair workflow, never clipped or silently discarded.

The application now stores a `teachingPrelude` with ten direct definitions, a two-LAN forwarding explanation, and the boundary. It is composed before independent review and covered by the saved-content digest, but omitted from the writer's response schema. Both the webpage and native newsletter put these definitions before the visual or beginner walkthrough. Comparison callouts use the prelude's boundary independently of the section's key-point array, so six existing teaching points do not block the callout or require deletion.

The same boundary also precedes access-point or firewall comparisons in the beginner analogy and real-world scenario. Visuals and comparisons share one callout component; plain-text newsletter editions preserve its complete wording. The local QA command verifies the analogy callout's reading order and keeps its saved draft and screenshots out of Git.

Day 2 command recognition accepts both `ip 10.1.2.10/24 10.1.2.254` and `ip 10.1.2.10 255.255.255.0 10.1.2.254`; the restoration forms receive identical checks. Wrong masks, consoles, addresses and order still fail. A reply-path explanation is equivalent to a return-path explanation. The built-in switches are not IOS switches: a narrowly recognized `show mac address-table` step is replaced with an explicitly labelled paper prediction with no commands or invented output. Unknown or mixed switch actions stay visible for repair. Router1's new frame uses its outgoing-interface MAC and EndpointB's MAC; the switches learn independent local tables.

References: [GNS3 built-in switch limitations](https://docs.gns3.com/docs-3.1-en/web-ui/template-preferences-builtin), [GNS3 VPCS command formats](https://docs.gns3.com/docs-3.1-en/web-ui/template-preferences-vpcs), [Cisco switching and frame rewriting](https://www.cisco.com/c/en/us/td/docs/ios-xml/ios/ipswitch_poview/configuration/12-2sx/isw-poview-12-2sx/isw-poview-overview.pdf).

`scripts/qa-ccna-day-two.mjs --input <lesson-json>` renders the normalized prelude, visual stages and guide using real components and stylesheet, then checks reading order and overflow at 320, 390, 768 and 1440 pixels with 2x screenshots. `--live-draft` instead performs a read-only Day 2 database fetch. Neither option calls a model, changes a database record, approves a revision, or publishes anything. Fixture rendering does not replace a live generation review or executing the GNS3 lab.

Technical reference: [RFC 1122, local/remote routing and gateway selection](https://www.rfc-editor.org/rfc/rfc1122.html#section-3.3.1.1). A destination on another IP network requires gateway routing for the reply as well as the request.

## Regression coverage

Run `npm run test:ccna`, `npm run typecheck`, lint and the production build when changing these contracts. Tests cover citation-budget boundaries, canonical duplicates, untrusted URLs, combined schema/technical failures, malformed JSON, contradictory reviews, bounded repairs, changed-content approval, Day 2 console-separated fault recovery, visual limits and existing course/social behavior.

Fixture-based and mocked-review tests prove the pipeline's control flow. They do not prove that an LLM's technical judgment is correct or that a GNS3 lab was executed. A new live generation and independent review are still required before publishing an actual lesson. First-attempt publication is a reliability goal, not a guarantee; unresolved evidence or technical problems must keep a lesson on hold.
