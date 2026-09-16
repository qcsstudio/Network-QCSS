# CCNA Investigation and Publication Workflow

Verified on 15 September 2026. Research horizon: 15 September 2027.

## Exam Findings

The live 200-301 exam remains v1.1. Cisco gives 2 February 2027 as its final
testing date and 3 February 2027 as the v2.0 launch. This is a blueprint change,
not an immediate replacement of the current exam. No subsequent 200-301 revision
was verified in the official announcements inspected for the one-year horizon.
That is not a guarantee that Cisco will announce nothing else.

Sources: [current exam](https://www.cisco.com/site/us/en/learn/training-certifications/exams/ccna.html),
[transition dates](https://blogs.cisco.com/learning/stay-on-track-get-certified-before-the-ccna-refresh),
[refresh announcement](https://blogs.cisco.com/learning/ai-updates-ccna-ccie-automation),
[certification roadmap alerts](https://mkto.cisco.com/certification-roadmap.html).

The v2.0 emphasis is applied troubleshooting and operations. Its five domain
weights are 25/25/20/20/10. Material that must be explicit in our path includes
OSPFv3, operational HSRP/VRRP interpretation, SFTP/SCP, named as well as numbered
ACLs, edge-host/PoE scenarios, client-OS troubleshooting, packet-capture evidence,
Ansible execution and careful evaluation of AI recommendations. Keep a simulator
boundary where real RF, PoE or cloud services cannot be demonstrated.

[Official v2.0 blueprint](https://learningcontent.cisco.com/documents/marketing/exam-topics/200-301_CCNA_v2.0_Exam_Topics_PDF.pdf)
was compared with the
[v1.1 blueprint](https://learningcontent.cisco.com/documents/marketing/exam-topics/200-301-CCNA-v1.1.pdf).
The existing v1.1 references for transport, addressing, wireless, virtualization
and switching were misnumbered. Those are corrected without renumbering days or
changing lesson URLs. NTP, QoS, REST and JSON remain useful learning material but
are no longer presented as individually named v2.0 objectives. Courseware version
numbers and the separate CCNA Automation/Cybersecurity certifications are not
substitutes for the 200-301 exam version.

The manifest records its verification date and research horizon. Admin warns
after 30 days without verification; this is not an automatic Cisco-change detector.
Generation researches official sources, but any newly announced blueprint still
needs a deliberate mapping update. Never silently relabel published material.

## Failure Findings

Production checks found Day 4 held after eight attempts and Day 5 held with the
older `allOf` response-schema rejection. Historical logs separately recorded API
credit exhaustion, temporary token-rate limits and a lost worker ownership claim.
These are distinct from a failed technical review. Historical billing errors do
not establish the present credit balance.

Day 4 mixed maintained lab fields with regenerated prose and assessments, leading
to contradictory answers. Some reviewer suggestions were themselves inaccurate:
a non-NAT router does not replace a forwarded endpoint's source IP with its own.
The aligned maintained lesson now covers the definitions, nonliteral analogies,
full diagram, isolated lab, exact console steps, ownership checks and cautious
interpretation of ping/counters as one unit. Independent review still evaluates
that assembled revision; passing deterministic tests is not approval.

## One-Action Workflow

1. In Admin > CCNA Learning Desk, select a lesson and choose **Prepare & publish**.
2. The authenticated request persists the job before returning HTTP 202. A second
   click finds the same active job. The page polls read-only status; closing it
   does not remove the database job.
3. A complete, independently reviewed current revision can publish without paid
   generation. Otherwise use the saved draft as the first candidate or generate
   a new lesson. OpenAI JSON schemas are checked before provider requests.
4. Research primary documents, then assemble the lab, teaching and assessments.
   Inspect schema limits, complete sentences, visual endpoints, command context,
   topic constraints, paired explanations and canonical citations together.
5. Independently review the complete assembled content against the evidence.
   Send all actionable findings into bounded repairs. Stop unchanged repaired
   content rather than paying for the identical review again. Never clip a field
   or erase a required citation to pass its limit.
6. Preserve complete provider stages across temporary capacity/deadline pauses.
   The existing five-minute editorial worker also checks explicitly requested
   publication jobs; actual scheduler latency can vary. This reuses an existing
   job, with no additional recurring GitHub job. An empty queue makes no model
   calls. New automatic editions retain their weekday-only schedule; requested
   publication jobs can resume outside that window.
7. Publish only a passing exact revision. Compare-and-swap and generation leases
   prevent a stale worker from replacing an operator's newer action. Skipped or
   cancelled jobs do not auto-publish. A job has at most six worker runs.
8. Queue the canonical lesson for LinkedIn through the existing idempotent queue.
   Website publication and LinkedIn delivery are separate states. Failed queueing
   leaves a pending delivery marker for worker recovery; it does not unpublish the
   lesson or pretend LinkedIn has delivered it. Queue bookkeeping preserves the
   published content timestamp so it cannot invalidate its queued revision.
   Queue failures back off and stop after three attempts, freeing the worker for
   later lessons. Use **Queue LinkedIn** after resolving the reported cause.

**Repair draft** remains a draft-only action. **Prepare & publish** is explicit
publication authorization. Do not use the latter just to inspect an unfinished
lesson. Published lessons remain unchanged until explicitly returned to draft.

## Verification and Limits

Regression tests exercise schema compatibility, every known Day 2/3/4 constraint,
retina diagram geometry, citation budgets, bounded output/retry behavior, billing
classification, persistent publication intent, duplicate requests, cancellation
and exact-review-digest publication. Browser tests cover narrow mobile through
desktop and mock the network so they cannot accidentally publish real lessons.

These checks do not execute licensed Cisco IOS in GNS3, guarantee that a model
never makes a mistake, or make provider billing/outages disappear. Content with an
unresolved safety or factual issue must remain held with its combined diagnostics.
One click means orchestration of the whole process, not bypassing review.

## Production Repair Follow-Up

The first live verification retained nine completed stages when the final review
hit the request deadline. Deadline-bound SDK timeouts now become resumable pauses;
short remaining windows do not start another paid request. Ambiguous early network
timeouts still hold for inspection because a server may already have processed
the request. Clipped legacy metadata and unfinished prerequisites are checked
together, and Day 4's maintained package includes those fields as well as its
teaching. Review findings must be checked against the actual cited fields and
declared platform, not unrelated operating systems or absent-context assumptions.

On 16 September, a draft-only production verification completed three research
stages, one independent review and one repair before pausing at the safe deadline.
All five responses remained saved, and the lesson remained unpublished. The
review identified a useful measurement improvement: record the ACL deny counter
before the peer test, then compare its change after the test. The maintained lab
now supplies that exact observation sequence, treats missing counters as unknown,
and explains VPCS address syntax, the GNS3 Start control and IPv4 ACL show-command
alternatives. These additions are covered by regression tests; they do not assert
that a licensed IOS lab was executed or waive independent review.

The subsequent run exposed a second loop: Day 4's maintained text was unchanged
while generated bibliography-only repairs produced different content digests and
new reviews. Day 4 now uses its exact maintained bibliography and no paid writing
parts. Its assembled chapter still receives live research and independent review;
an unchanged failing chapter stops after one review rather than paying for source
churn. Stale bibliography entries are removed when that maintained chapter is
assembled, not by dropping citations from independently generated chapters.

Independent review now records nine explicit checks covering facts, reproducible
labs, safety/licensing, beginner clarity, visuals, assessments, sources, syllabus
scope and presentation. Each blocker needs an existing JSON Pointer, a verbatim
quote, learner impact and repair. Technical corrections need verified primary
references. Missing/duplicate checks, nonexistent quotes, unverified references
and contradictory verdicts are invalid review responses, not accepted evidence of
a lesson defect. One bounded response-correction request is allowed; capacity
errors still pause normally. Review must not invent extra lesson objectives or
block on optional alternate commands, but actual factual and safety defects still
hold publication. The full checklist and findings are saved for audit.

Final live verification on 16 September returned Day 4 to `draft` with quality
score 100, no pending issues, eight sources and all nine independent checks passed.
The saved review digest matches the exact saved chapter. No writing-part calls
were needed for the maintained lesson, and `publishedAt` remains null. The score
is an automated gate result, not a claim of perfect instruction or real IOS lab
execution. Review feedback itself now requires complete sentences and rejects
clipped impact/repair text before it can become another lesson-repair instruction.
