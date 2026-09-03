# QCS CCNA Daily Learning System: Research Source

Updated: 2026-09-03

## Decision

QCS will publish a 60-lesson, 12-week CCNA learning path from Monday through Friday. Each canonical website lesson teaches one controlled syllabus topic in simple English and includes a real-world situation, a reproducible GNS3 or Cisco Modeling Labs exercise, verification evidence, troubleshooting guidance, original practice questions, and a scored quiz.

The course teaches the current CCNA 200-301 v1.1 exam while explicitly bridging each topic to the announced v2.0 blueprint. Cisco says v1.1 remains available through 2027-02-02 and v2.0 begins on 2027-02-03, so the learner experience should encourage study now while identifying the transferable operational skills and new v2.0 emphasis.

## Primary Evidence

- Cisco CCNA exam page: https://www.cisco.com/site/us/en/learn/training-certifications/exams/ccna.html
- Cisco CCNA v1.1 exam topics: https://learningcontent.cisco.com/documents/marketing/exam-topics/200-301-CCNA-v1.1.pdf
- Cisco CCNA v1.1 release notes: https://learningcontent.cisco.com/documents/marketing/exam-topics/CCNA_1_1_release_notes.pdf
- Cisco CCNA v2.0 exam topics: https://learningcontent.cisco.com/documents/marketing/exam-topics/200-301_CCNA_v2.0_Exam_Topics_PDF.pdf
- Cisco certification refresh timeline: https://blogs.cisco.com/learning/stay-on-track-get-certified-before-the-ccna-refresh
- Cisco discussion of the 2027 AI, security, and practical-skills refresh: https://blogs.cisco.com/learning/ai-updates-ccna-ccie-automation
- GNS3 first Cisco topology guidance: https://docs.gns3.com/docs/getting-started/your-first-cisco-topology
- GNS3 Cisco image licensing guidance: https://docs.gns3.com/docs/troubleshooting-faq/where-do-i-get-ios-images
- LinkedIn newsletter best practices: https://www.linkedin.com/help/linkedin/answer/a517940/linkedin-newsletters-best-practices?lang=en
- LinkedIn newsletter creation workflow: https://www.linkedin.com/help/linkedin/answer/a517925/create-a-newsletter-on-linkedin?lang=en
- LinkedIn Posts API: https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?tabs=curl&view=li-lms-2026-04

## Blueprint Model

Current v1.1 domains are Network Fundamentals, Network Access, IP Connectivity, IP Services, Security Fundamentals, and Automation and Programmability. The announced v2.0 blueprint reorganizes the scope into Network Infrastructure and Connectivity, Switching and Network Access, IP Routing, Network Services and Security, and AI, Network Operations, and Management. QCS stores both mappings on every topic rather than mixing the two versions into an ambiguous syllabus.

## Editorial Quality Gate

A lesson cannot auto-publish unless it contains at least 1,500 useful words, five cited teaching sections, three authoritative sources, seven lab steps, four verification checks, three troubleshooting checks, six original practice questions, five original quiz questions, and a correct GNS3 licensing note. The generation agent must perform live web research and may cite only controlled authoritative domains and URLs observed during that research.

These checks reject thin or structurally incomplete lessons and constrain the agent to traceable sources. They do not prove that every explanation is factually perfect or that a GNS3 lab has been executed. Commands and platform-specific behavior must still be verified in the stated, licensed lab environment; learners must not treat the material as production change approval.

Production launch review exposed a weak draft that passed structural checks but contained serialized text, filler lab steps, and ambiguous quiz answers. Policy v2 now separates three focused live-web searches from structured writing, rejects those mechanical defects, and requires a separate technical instructor review. The reviewer checks topic boundaries, exact topology/addressing/commands, supporting citations, and single-answer quiz validity. One bounded repair pass is allowed; unresolved defects are held, not automatically approved. Manual publication also requires a successful independent review trace.

Direct OpenAI research defaults to `gpt-5-mini` (`CCNA_RESEARCH_MODEL`) with primary-domain filtering and at most two tool calls per focused query. The structured writer defaults to `gpt-4.1-mini`; the independent reviewer and any repair pass default to `gpt-4.1` (`CCNA_REVIEW_MODEL`). GPT-4.1 Mini cannot handle the API's domain-filter control and is therefore not used for filtered research. No Vercel AI Gateway is used. A corrected course edition refreshes its existing LinkedIn entry rather than accumulating duplicate daily posts; replacement media requires a replacement LinkedIn post because the existing post's uploaded image cannot be edited in place.

## Distribution Model

The QCS lesson page is the canonical source. After a lesson passes the gate, the system publishes it on the website, creates a contextual 1920 by 1080 QCS visual, and queues a LinkedIn post with presentation spacing, three actions, an explicit verification step, the canonical lesson URL, and five focused hashtags.

LinkedIn's documented Posts API supports member posts and shared article links, but it does not document creation of native newsletter editions. QCS therefore automates the supported LinkedIn post and provides an admin copy action for the native LinkedIn newsletter editor. This avoids brittle browser automation and keeps the website lesson, social post, and optional native edition consistent.

## Schedule And Recovery

The weekday endpoint is gated by Asia/Kolkata time and becomes due after 08:00. Vercel Cron calls it at 08:05 IST on weekdays; a separately authenticated GitHub Actions workflow calls it at 08:20 and 08:50 IST for backup and recovery. Database state makes repeated scheduled calls idempotent for the India calendar day. Failed generation is retried on a later eligible invocation with a lease and 10/20-minute backoff, with at most three automatic attempts; a quality failure is held for operator review instead of being published. Expired generation leases can be reclaimed after 20 minutes.

## Operator Steps

1. Open `/admin#learning` and select the next syllabus topic.
2. Use Generate to research a draft, or Run today to execute the scheduled publication path.
3. Review the lesson, citations, platform assumptions, lab verification checks, and quality issues. Publish only a lesson that clears the gate.
4. Check the Distribution tab for LinkedIn queue and delivery status. The canonical QCS link and five relevant hashtags are required.
5. For a native LinkedIn newsletter edition, use Copy native edition and Open LinkedIn editor. Native newsletter publication remains a manual LinkedIn action.

## Launch Verification

Production generation and LinkedIn delivery succeeded on 2026-09-03. The first lesson was then reviewed against GNS3's first-topology and built-in switch documentation. Corrections clarify supported VLAN port modes, exact Ethernet endpoints, per-console command context, peer versus self-ping, and licensing boundaries. The repeatable repair script defaults to dry-run, records its review sources, and uses an optimistic revision check. Future writer/reviewer instructions and a regression test cover the same defects.

The live course and lesson appear in the sitemap. Desktop and mobile inspection found no horizontal overflow. The quiz was exercised with five correct answers (5/5) and reset (0/5 answered). The first lesson contains 2,160 useful words, six cited teaching sections, eight operational lab steps, six practice questions and five quiz questions. These are structural measurements, not a claim of perfect teaching or an externally certified reading score. The lab has been checked against documentation but not executed in GNS3.

LinkedIn delivery stores the exact submitted caption, hashes, image asset, external post ID and write acceptance receipt. Live API readback is unavailable with the current partner permissions, so an accepted write is not represented as independent verification of the rendered LinkedIn feed. Images are checked at 1920x1080 and use explicit logo dimensions to prevent a zero-height logo in the image renderer.

## Zero-Background Teaching Revision

The course now begins at `/courses/ccna/start-here`, before the unchanged 60-topic sequence. Six preparation units cover computer parts, clicking and typing, apps and files, local networks versus the Internet, addresses, and safe lab setup. Each unit pairs an explanation with a small task and an answer reveal. A browser-only typing exercise and a five-question quiz support practice without installing software. Phone and paper exercises are explicitly preparation, not a substitute for hands-on network verification.

Teaching policy v3 applies to the writer and the independent reviewer. Every new lesson requires a topic-specific beginner guide: starting point, reason to learn, familiar comparison with its limitations, a worked example, a safe first task with a hint, and an understanding check. Every command line requires a matching explanation of its values and purpose. Missing support blocks publication. Older saved content remains parseable, but it must satisfy the new checks before republishing. Native newsletter exports include the same beginner material and command explanations; the course's weekday release schedule is not a learner deadline.

The approach follows W3C cognitive-accessibility guidance on [clear words and definitions](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p01-clear-words/), [clear labels and instructions](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p06-clear-labels/) and [literal language](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o3p04-literal-language/). These are design references, not an accessibility certification. Official GNS3 Windows, macOS, Linux, local-server and first-topology documentation was checked; the nonexistent installation landing URL was removed.

`scripts/upgrade-ccna-beginner.mjs` rewrites the first published lesson without changing its URL. Its dry run validates 3,983 useful words, six teaching sections, eight lab steps, twelve explained command lines, sixteen glossary entries, six practice questions, five quiz questions and ten sources. Application is explicit (`--apply`), idempotent and guarded by `updatedAt` to avoid overwriting concurrent edits. Its audit trace distinguishes this source-checked editorial revision from the previous AI review. It does not request a LinkedIn repost.

Verification for this revision: 16 CCNA/authentication tests and 17 LinkedIn/state regression tests passed, with TypeScript and scoped ESLint checks. Browser checks covered widths 320, 360, 390, 768, 1024, 1440 and 1920 without clipped guide headings or controls or horizontal page overflow. The practice message was entered, sent and cleared. The foundation quiz returned 5/5 with explanations and reset successfully. Desktop and mobile screenshots were inspected.

These checks measure structure, correctness against the checked references and interface behavior. They do not establish universal comprehension, a guaranteed exam result, a certified reading score, or execution of the GNS3 lab. Real beginner usability sessions and instructor-run lab verification remain valuable independent validation.
