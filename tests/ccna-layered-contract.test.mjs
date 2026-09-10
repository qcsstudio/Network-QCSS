import assert from "node:assert/strict";
import test from "node:test";
import { ccnaLayeredLab, ccnaLayeredVisual, ccnaLayeredPrelude, ccnaLayeredSources, ccnaLayeredWritingBoundary, applyCcnaLayeredContract, ccnaLayeredIssues } from "../src/lib/ccna-layered-contract.ts";
import { ccnaLessonContentSchema } from "../src/lib/ccna-lesson-schema.ts";
import { ccnaVisualGenerationSchema, ccnaVisualStoryIssues } from "../src/lib/ccna-visual-story.ts";
import { ccnaContentDigest, ccnaReviewedRevisionIssues } from "../src/lib/ccna-generation-pipeline.ts";
import { ccnaDiagramGeometry, wrapVisualLabel } from "../src/components/ccna-visual-diagram.tsx";

const urls = ccnaLayeredSources.map((source) => source.url);

test("Day 4 complete visual phrases satisfy the real 24/26 character generation budgets", () => {
  const visual = ccnaLayeredVisual();
  assert.deepEqual(ccnaVisualGenerationSchema.safeParse(visual).error?.issues || [], []);
  assert.deepEqual(ccnaVisualStoryIssues(visual, urls), []);
  assert.equal(visual.title, "Packet Journey");
  assert.deepEqual(visual.nodes.map(({ label }) => label), ["PC1", "Switch", "Router", "PC2"]);
  assert.equal(visual.nodes[1].detail, "Forwards local frames");
  assert.equal(visual.nodes[2].detail, "Routes IP packets");
  assert.equal(visual.stages[2].title, "Check Router filtering");
  assert.ok(visual.nodes.every((node) => node.detail.length <= 24));
  assert.ok(visual.stages.every((stage) => stage.title.length <= 26));
  assert.match(visual.stages[0].explanation, /192\.168\.1\.1\/24.*192\.168\.2\.1\/24.*192\.168\.2\.10\/24/);
  assert.match(visual.altText, /PC1.*Switch.*Router.*PC2/);
  assert.match(visual.altText, /ends at PC2/);
  for (const stage of visual.stages) for (const id of stage.activeConnections) {
    const edge = visual.connections.find((edge) => edge.id === id);
    assert.ok(stage.activeNodes.includes(edge.from) && stage.activeNodes.includes(edge.to));
  }
  assert.ok(!visual.stages[2].activeConnections.includes("router-pc2"), "The filter stage must not show the blocked request delivered to PC2.");
  assert.equal(visual.stages[1].direction, "reverse");
});

test("all visual label truncations from the report are found together without slicing strings", () => {
  const visual = ccnaLayeredVisual();
  visual.nodes[1].detail = "Forwards frames between ";
  visual.nodes[2].label = "Router (192.168.1.1/24, ";
  visual.nodes[2].detail = "Routes packets between ";
  visual.stages[2].title = "Packet Journey through Router and";
  const issues = ccnaVisualStoryIssues(visual, urls);
  assert.equal(issues.length, 3, issues.join("\n"));
  assert.ok(issues.some((issue) => /complete device labels.*router/.test(issue)));
  assert.ok(issues.some((issue) => /node details.*Switch.*Router/.test(issue)));
  assert.ok(issues.some((issue) => /stage titles.*3/.test(issue)));
  assert.equal(visual.nodes[2].label, "Router (192.168.1.1/24, ", "Validation must not silently modify truncated content.");
  for (const label of ["Router (LAN1)", "Router [LAN1]", "Router {LAN1}"]) {
    const candidate = ccnaLayeredVisual(); candidate.nodes[2].label = label;
    assert.deepEqual(ccnaVisualStoryIssues(candidate, urls), []);
  }
  for (const label of ["Router (LAN1]", "Router)", "Router ("]) {
    const candidate = ccnaLayeredVisual(); candidate.nodes[2].label = label;
    assert.ok(ccnaVisualStoryIssues(candidate, urls).some((issue) => /complete device labels/.test(issue)));
  }
});

test("Day 4 lab and first-use definitions fit schemas and commands belong to one console", () => {
  const lab = ccnaLayeredLab();
  assert.deepEqual(ccnaLessonContentSchema.shape.lab.safeParse(lab).error?.issues || [], []);
  assert.deepEqual(ccnaLessonContentSchema.shape.teachingPrelude.safeParse(ccnaLayeredPrelude).error?.issues || [], []);
  assert.equal(lab.steps.length, 14);
  for (const step of lab.steps) {
    assert.equal(step.commands.length, step.commandExplanations.length);
    if (!step.commands.length) continue;
    const console = step.instruction.match(/right-click (Router|PC1|PC2) and choose Console before typing/);
    assert.ok(console, step.title);
    assert.match(step.instruction, /press Enter/);
    const node = console[1];
    for (const command of step.commands) {
      assert.ok(!/[<>#]|\n/.test(command), `No prompt or unresolved placeholder: ${command}`);
      if (node !== "Router") assert.match(command, /^(ip |show ip$|ping )/);
      else assert.ok(!/^ip 192/.test(command), "A VPCS address command must not run on Router.");
    }
  }
  const terms = new Map(ccnaLayeredPrelude.terms.map(({ term, meaning }) => [term, meaning]));
  assert.match(terms.get("VPCS and Console"), /PC1>.*Type only the command/);
  assert.match(terms.get("Router command modes"), /privileged EXEC.*configure terminal.*end/);
  assert.match(terms.get("ACL number and name"), /access-list 199.*ip access-list extended LAB_FILTER.*ip access-group/);
  assert.match(terms.get("ACL number and name"), /sequence number is not/);
  assert.match(terms.get("Baseline and rollback"), /merges settings.*not a reliable rollback/);
  assert.match(lab.licensingNote, /GNS3 does not provide Cisco software images.*do not share or redistribute.*licensed for use within CML/);
});

test("ACL rollback has the exact global/interface modes, identifier and detach-before-delete order", () => {
  const lab = ccnaLayeredLab();
  const removal = lab.steps.find((step) => step.commands.includes("no access-list 199"));
  assert.deepEqual(removal.commands, ["enable", "configure terminal", "interface GigabitEthernet0/0", "no ip access-group 199 in", "exit", "no access-list 199", "end", "show access-lists", "show ip interface GigabitEthernet0/0"]);
  assert.match(removal.instruction, /baseline.*no ACL was originally attached/);
  assert.match(removal.instruction, /not solely ours, stop/);
  assert.ok(lab.steps[1].commands.includes("show running-config"));
  assert.match(lab.steps[1].instruction, /no ACL 199 anywhere/);
  assert.ok(lab.steps[6].commands.includes("copy running-config startup-config"));
  assert.match(lab.steps[6].instruction, /Never save the later fault/);
  assert.ok(lab.steps[7].commands.indexOf("access-list 199 permit ip any any") < lab.steps[7].commands.indexOf("ip access-group 199 in"));
  assert.match(lab.steps[7].instruction, /never append into an existing 199/);
  assert.match(lab.steps.at(-1).instruction, /Do not copy startup-config into running-config.*merges settings/);
  for (const command of lab.steps.flatMap((step) => step.commands)) {
    assert.doesNotMatch(command, /write erase|erase |reload|copy startup-config running-config|no ip access-list|no access-list (?!199$)/);
  }
  // Validate IOS mode transitions, not a claim of executing IOS or emulating forwarding.
  for (const step of lab.steps.filter((step) => /right-click Router/.test(step.instruction))) {
    let mode = "user";
    for (const command of step.commands) {
      if (command === "enable") mode = "exec";
      else if (command === "configure terminal") { assert.equal(mode, "exec"); mode = "global"; }
      else if (command.startsWith("interface ")) { assert.equal(mode, "global"); mode = "interface"; }
      else if (command === "exit") { assert.equal(mode, "interface"); mode = "global"; }
      else if (command === "end") mode = "exec";
      else if (/^(?:no )?access-list /.test(command)) assert.equal(mode, "global", command);
      else if (/^(?:no )?ip access-group |^ip address |^no shutdown$/.test(command)) assert.equal(mode, "interface", command);
      else if (/^show |^copy /.test(command)) assert.equal(mode, "exec", command);
    }
    assert.equal(mode, "exec", step.title);
  }
});

test("peer tests, diagnosis limits and interface recovery cover reported beginner blockers", () => {
  const lab = ccnaLayeredLab();
  const addresses = new Map(lab.addressing.filter((row) => /^PC/.test(row.device)).map((row) => [row.device, row.address.split("/")[0]]));
  for (const step of lab.steps) for (const command of step.commands.filter((command) => command.startsWith("ping "))) {
    const source = step.instruction.match(/right-click (PC[12])/)[1];
    assert.notEqual(command.split(" ")[1], addresses.get(source), `Self-ping in ${step.title}`);
    assert.ok(step.commands.includes("show ip"));
  }
  const forward = lab.steps.filter((step) => step.commands.includes("ping 192.168.2.10"));
  assert.equal(forward.length, 3);
  assert.match(forward[0].expectedResult, /Repeated replies.*timeout.*ARP.*filtering/);
  assert.match(forward[1].expectedResult, /fails.*gateway should still reply/);
  assert.match(forward[2].expectedResult, /replies.*resume/);
  assert.ok(lab.troubleshooting.some((line) => /Missing interface.*stop Router/i.test(line)));
  assert.ok(lab.troubleshooting.some((line) => /Administratively down.*no shutdown.*cable/.test(line)));
  assert.ok(lab.setup.some((line) => /GigabitEthernet0\/0\/0.*GigabitEthernet0\/0\/1.*EVERY command.*ACL removal/.test(line)));
  assert.match(ccnaLayeredWritingBoundary, /quiz AND practice set.*ping-limit question.*ICMP filtering/);
  assert.match(ccnaLayeredWritingBoundary, /No ping result alone identifies a faulty layer/);
});

test("Day 4 composition is immutable, idempotent and invalidates old independent approval", () => {
  const before = { sources: [], sections: [{ heading: "Unchanged teaching" }], lab: {}, visualStory: { nodes: [] }, teachingPrelude: undefined };
  const snapshot = structuredClone(before);
  assert.equal(ccnaLayeredIssues(before).length, 3);
  const after = applyCcnaLayeredContract(before);
  assert.deepEqual(before, snapshot);
  assert.deepEqual(after.sections, before.sections);
  assert.deepEqual(applyCcnaLayeredContract(after), after);
  assert.deepEqual(ccnaLayeredIssues(after), []);
  assert.equal(new Set(after.sources.map(({ url }) => url)).size, after.sources.length);
  const oldApproval = { editorialReview: { passed: true, issues: [] }, reviewedContentDigest: ccnaContentDigest(before) };
  assert.ok(ccnaReviewedRevisionIssues(after, oldApproval).some((issue) => /exact saved content/.test(issue)));
  after.lab.steps[10].commands = ["no access-list 199"];
  after.visualStory.nodes[2].label = "Router (";
  after.teachingPrelude = undefined;
  assert.equal(ccnaLayeredIssues(after).length, 3, "Aggregate every contract defect in one pass.");
});

test("mobile and desktop diagram geometry retains every complete role and label", () => {
  const story = ccnaLayeredVisual();
  for (const compact of [false, true]) {
    const geometry = ccnaDiagramGeometry(story, compact);
    assert.equal(geometry.nodes.length, 4);
    for (const node of geometry.nodes) {
      const label = wrapVisualLabel(node.label, 17);
      const details = wrapVisualLabel(node.detail, 20);
      assert.equal(label.join(" "), node.label);
      assert.equal(details.join(" "), node.detail);
      assert.ok(node.x - 53 >= 0 && node.x + 53 <= geometry.width);
      assert.ok(node.y + 91 + label.length * 33 + (details.length - 1) * 26 < geometry.height);
    }
  }
});
