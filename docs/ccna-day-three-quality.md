# Day 3 topology generation repair

## Root cause

The previous generic visual contract allowed five nodes and three stages, while Day 3 asks learners to compare five different designs. Compressing every design into that one scene produced omitted endpoints, mixed lab assumptions and clipped text. A passing character count was not evidence of a complete explanation.

## Implemented contract

- Five separate scenes: campus, WAN, SOHO, cloud and spine-leaf. Each has its own complete path, destination, three teaching stages, omission boundary and citations.
- The spine-leaf scene has six nodes and all six connections, including both spine alternatives and the final server.
- Alt text stays within 200 characters; boundaries within 220; explanations within 240. No string slicing or ellipsis substitution is used to make these diagrams fit.
- One executable GNS3 lab uses two separate VPCS instances and one built-in Ethernet switch. Addresses, cable endpoints, console instructions, baseline, fault, recovery and cleanup are fixed together.
- WAN, SOHO, cloud and spine-leaf are explicitly separate paper exercises. They are not invented GNS3 appliance templates or claims of measured provider failover, isolation or ECMP.
- Campus redundancy is explained as a production design option, not confused with the deliberately nonredundant lab.
- The first teaching block defines access, distribution, core, spine, leaf, interface, console, ping and ICMP before the visual or commands. It explains echo requests/replies, limits the traffic test's conclusion and explicitly limits everyday analogies.
- The writer and independent reviewer distinguish two illustrated inter-leaf links from a universal hop-count rule. Same-leaf traffic and eligible ECMP alternatives are covered; the fixed lab contains no invented Cisco IOS tasks on built-in nodes.
- The single spine-leaf teaching section is composed from maintained, cited prose before review. Its definition, example and key points explicitly separate ECMP routing from paper path tracing and reject guarantees of even load sharing or loss-free recovery. Other sections remain unchanged. Missing or duplicate spine-leaf sections are held, not guessed.
- The Cisco image note follows the applicable-license boundary and prohibits sharing or redistribution. CML reference images require permission for use outside CML.

The writer generates the surrounding teaching, scenarios, questions and citations. It does not regenerate the fixed lab or diagrams; the spine-leaf teaching section is replaced during composition. Their full content is assembled before independent review, and approval must match that exact content digest. Cached Day 3 writing from the old contract is incompatible and is not accepted as a reviewed new lesson. A changed section cannot reuse an approval for the previous revision.

## Verification

Run `npm run test:ccna` for schema, source, topology, assembly, retry and exact-revision checks.

Run `npm run build` followed by `npm run test:ccna-ui`. The topology browser fixture uses all four production stylesheets and fonts from the build. It checks every topology and stage at 320, 390, 768 and 1440 pixels with a 2x device scale, SVG text bounds, visible destinations, connection counts, complete transcripts, console errors and automated WCAG A/AA checks. The first-concepts block is checked for complete definitions, order before the diagrams, overflow and accessibility at the same sizes.

The fixture writes screenshots and an interactive `preview.html` to the OS temporary directory `qcs-ccna-day3-qa`.

## Boundaries

Automated checks cannot guarantee educational quality or successful first-attempt generation. Independent review still evaluates the complete lesson and can hold a conflicting or unsupported teaching claim. The GNS3 commands were checked against documentation and deterministic tests, not executed in a live emulator during this repair. No paid generation, publication or production database change was run.

Deployment and regeneration of the saved Day 3 lesson are separate steps; code changes do not silently approve or publish the existing failed draft.
