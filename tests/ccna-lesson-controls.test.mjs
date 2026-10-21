import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { declarationsAt, descendants, lessonCss, mountComponent, textContent } from "./helpers/ccna-ui-static-harness.mjs";

const shellFile = new URL("../src/components/ccna-lesson-shell.tsx", import.meta.url);
const quizFile = new URL("../src/components/ccna-quiz.tsx", import.meta.url);
const shellProps = {
  children: createElement("section", { id: "lesson-topic" }, "Lesson text"),
  outline: createElement("a", { href: "#lesson-topic" }, "Topic"),
  sources: createElement("p", null, "Source")
};
const byLabel = label => node => node.props["aria-label"] === label;
const button = (host, label) => host.find(node => node.type === "button" && byLabel(label)(node));

test("outline starts expanded and closes once after exactly five seconds", async () => {
  const host = await mountComponent(shellFile, "CcnaLessonShell", shellProps);
  assert.match(host.tree.props.className, /is-outline-open/);
  assert.equal(host.find(node => node.type === "aside").props.inert, false);
  host.advance(4999);
  assert.match(host.tree.props.className, /is-outline-open/);
  host.advance(1);
  assert.match(host.tree.props.className, /is-outline-closed/);
  assert.equal(host.find(node => node.type === "aside").props.inert, true);
  assert.equal(host.find(node => node.type === "aside").props["aria-hidden"], true);
  assert.equal(host.document.activeElement, null, "Auto-close must not steal article focus");
  assert.equal(host.timerCount, 0);
  host.unmount();
});

test("manual outline controls and Escape preserve names, focus intent and timer cancellation", async () => {
  const host = await mountComponent(shellFile, "CcnaLessonShell", shellProps);
  host.act(() => button(host, "Hide lesson outline").props.onClick());
  const restore = button(host, "Open lesson outline");
  assert.equal(restore.props["aria-expanded"], false);
  assert.equal(restore.props["aria-controls"], "ccna-lesson-outline");
  assert.equal(restore.props.tabIndex, 0);
  assert.equal(host.document.activeElement, host.host(restore));
  assert.equal(host.document.activeElement.focusOptions.preventScroll, true);
  assert.equal(host.timerCount, 0);
  host.act(() => restore.props.onClick());
  assert.equal(button(host, "Open lesson outline").props.tabIndex, -1);
  assert.equal(host.document.activeElement, host.host(button(host, "Hide lesson outline")));
  host.advance(10000);
  assert.match(host.tree.props.className, /is-outline-open/);
  host.key("Escape");
  assert.match(host.tree.props.className, /is-outline-closed/);
  assert.equal(host.document.activeElement, host.host(button(host, "Open lesson outline")));
  host.unmount();
  assert.equal(host.listenerCount, 0);
});

test("auto-close preserves focus intent from inside the outline; unmount clears timers", async () => {
  const host = await mountComponent(shellFile, "CcnaLessonShell", shellProps);
  host.host(button(host, "Hide lesson outline")).focus();
  host.advance(5000);
  assert.equal(host.document.activeElement, host.host(button(host, "Open lesson outline")));
  host.unmount();
  const pending = await mountComponent(shellFile, "CcnaLessonShell", shellProps);
  assert.equal(pending.timerCount, 1);
  pending.unmount();
  assert.equal(pending.timerCount, 0);
  assert.equal(pending.listenerCount, 0);
});

test("outline navigation closes the panel without restarting the initial timer", async () => {
  const host = await mountComponent(shellFile, "CcnaLessonShell", shellProps);
  const target = host.host(host.find(node => node.type === "a"));
  host.act(() => host.find(byLabel("Lesson contents")).props.onClickCapture({ target }));
  assert.match(host.tree.props.className, /is-outline-closed/);
  assert.equal(host.timerCount, 0);
  host.unmount();
});

test("quiz retains authored prompts, two-digit numbers, selection, scoring and reset", async () => {
  const questions = Array.from({ length: 8 }, (_, index) => ({
    question: `Question ${index + 1}: which observation supports the conclusion without relying on an assumption?`,
    options: ["Compare the recorded baseline and the observed result.", "Assume a missing reply proves hardware failure.", "Skip the observed result.", "Change every setting before recording the baseline."],
    correctIndex: 0,
    explanation: "Compare evidence from the same test before and after the isolated change."
  }));
  assert.ok(questions.length >= 6, "Regression fixture must include question 06");
  const before = JSON.stringify(questions);
  const host = await mountComponent(quizFile, "CcnaQuiz", { questions, slug: "unit-only" });
  const nodesWithClass = name => descendants(host.tree).filter(node => node.props.className === name);
  assert.deepEqual(nodesWithClass("ccna-quiz-prompt").map(textContent), questions.map(question => question.question));
  assert.equal(textContent(nodesWithClass("ccna-quiz-number")[5]), "06");
  assert.equal(host.find(node => node.type === "button").props.disabled, true);
  const status = () => host.find(node => node.props.role === "status");
  assert.equal(textContent(status()), `0/${questions.length}answered`);
  for (const [index, question] of questions.entries()) {
    const inputs = descendants(host.tree).filter(node => node.type === "input" && node.props.name === `question-${index}`);
    host.act(() => inputs[question.correctIndex].props.onChange());
  }
  assert.equal(textContent(status()), `${questions.length}/${questions.length}answered`);
  const submit = host.find(node => node.type === "button");
  assert.equal(submit.props.disabled, false);
  host.act(() => submit.props.onClick());
  assert.equal(textContent(status()), `${questions.length}/${questions.length}correct`);
  assert.ok(descendants(host.tree).filter(node => node.type === "input").every(node => node.props.disabled));
  assert.equal(JSON.parse(host.storage.get("qcs-ccna-quiz-unit-only")).score, questions.length);
  host.act(() => host.find(node => node.type === "button").props.onClick());
  assert.equal(textContent(status()), `0/${questions.length}answered`);
  assert.ok(descendants(host.tree).filter(node => node.type === "input").every(node => !node.props.checked && !node.props.disabled));
  assert.equal(JSON.stringify(questions), before);
  host.unmount();
});

const css = await lessonCss();
test("dark teaching panels retain readable text and mobile lab titles have full width", () => {
  assert.equal(declarationsAt(css, ".qcs-theme .ccna-lesson-article .ccna-lab-section > header p", 320).color, "#c0cede");
  assert.equal(declarationsAt(css, ".qcs-theme .ccna-lesson-article .ccna-scenario-section :is(p, li)", 320).color, "#c0cede");
  assert.equal(declarationsAt(css, ".ccna-lab-section > header", 320)["flex-direction"], "column");
  assert.equal(declarationsAt(css, ".ccna-lab-section > header > svg", 320).display, "none");
});
for (const width of [320, 390, 768, 1440]) {
  test(`${width}px CSS contract: outline rail and stable quiz dimensions (not measured layout)`, () => {
    const closed = declarationsAt(css, ".ccna-lesson-layout.is-outline-closed", width);
    const control = declarationsAt(css, ".ccna-outline-restore", width);
    assert.equal(closed["grid-template-columns"], "minmax(0, 1fr) 46px");
    assert.ok(parseInt(closed.gap) >= 8, "Reserved rail must include focus-ring clearance");
    assert.equal(control.position, "sticky", "A fixed control can cover text at arbitrary scroll offsets");
    assert.equal(control["grid-column"], "2");
    assert.equal(control.width, "46px");
    assert.equal(control.height, "46px");
    assert.equal(declarationsAt(css, ".ccna-lesson-article", width)["grid-column"], "1");
    assert.equal(declarationsAt(css, ".ccna-lesson-layout.is-outline-closed .ccna-lesson-sidebar", width).display, "none", "Hidden outline content must not size the reading row");
    const number = declarationsAt(css, ".ccna-quiz-number", width);
    assert.equal(number["white-space"], "nowrap");
    assert.equal(number["overflow-wrap"], "normal");
    assert.equal(number["font-variant-numeric"], "tabular-nums");
    assert.equal(declarationsAt(css, ".ccna-quiz-legend", width)["grid-template-columns"], "2.5ch minmax(0, 1fr)");
    const status = declarationsAt(css, ".ccna-quiz-status", width);
    assert.equal(status.width, "108px");
    assert.equal(status["min-height"], "64px");
    assert.equal(status["white-space"], "nowrap");
    const options = declarationsAt(css, ".ccna-quiz-options label", width);
    assert.equal(options["grid-template-columns"], "18px minmax(0, 1fr) 18px");
    assert.ok(parseInt(options["min-height"]) >= 44);
  });
}
