import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { XMLParser } from "fast-xml-parser";
import postcss from "postcss";
import { build } from "esbuild";
import { CcnaWebsiteVisualDiagram, ccnaWebsiteDiagramGeometry } from "../src/components/ccna-website-visual-diagram.tsx";
import { CcnaVisualDiagram } from "../src/components/ccna-visual-diagram.tsx";
import { ccnaVisualStorySchema, firstNetworkVisualStory } from "../src/lib/ccna-visual-story.ts";
import { ccnaTopologyVisual } from "../src/lib/ccna-topology-contract.ts";
import { ccnaLayeredVisual } from "../src/lib/ccna-layered-contract.ts";
import { contrastRatio } from "../src/lib/editorial-quality-policy.ts";
import { loadVisualExplainer } from "./ccna-visual-test-loader.mjs";

const { CcnaVisualExplainer } = await loadVisualExplainer();
const hash = value => createHash("sha256").update(value).digest("hex");
const render = (story, stageIndex = 0, compact = false) => renderToStaticMarkup(createElement(CcnaWebsiteVisualDiagram, { story, stageIndex, compact }));
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", parseAttributeValue: false, htmlEntities: true });
const array = value => value === undefined ? [] : Array.isArray(value) ? value : [value];
const scenes = story => [story, ...(story.comparisons || [])];
const fabric = ccnaTopologyVisual().comparisons.at(-1);
const evidence = {
  ...firstNetworkVisualStory, title: "Separate evidence, not extra cables", layout: "comparison",
  nodes: [
    { id: "prefix", kind: "record", label: "RA prefix", detail: "Network bits" },
    { id: "iid", kind: "address", label: "Local IID", detail: "Interface bits" },
    { id: "address", kind: "computer", label: "Own address", detail: "Check usable state" },
    { id: "gateway", kind: "router", label: "Default router", detail: "Check its lifetime" }
  ], connections: [],
  stages: firstNetworkVisualStory.stages.map(stage => ({ ...stage, direction: "none", activeNodes: ["prefix", "address"], activeConnections: [] }))
};
const bundle = {
  ...firstNetworkVisualStory, layout: "comparison",
  nodes: [
    { id: "a", kind: "switch", label: "RSW1", detail: "Po2: 203.0.113.1" },
    { id: "member-a", kind: "boundary", label: "Gi0/0 pair", detail: "Gi0/0 physical link" },
    { id: "member-b", kind: "boundary", label: "Gi0/1 pair", detail: "Gi0/1 physical link" },
    { id: "b", kind: "switch", label: "RSW2", detail: "Po2: 203.0.113.2" }
  ],
  connections: [{ id: "a1", from: "a", to: "member-a" }, { id: "a2", from: "member-a", to: "b" }, { id: "b1", from: "a", to: "member-b" }, { id: "b2", from: "member-b", to: "b" }],
  stages: firstNetworkVisualStory.stages.map(stage => ({ ...stage, activeNodes: ["a", "member-b", "b"], activeConnections: ["b1", "b2"] }))
};

function assertScene(story) {
  ccnaVisualStorySchema.parse(story);
  const original = JSON.stringify(story);
  for (const compact of [false, true]) for (let stageIndex = 0; stageIndex < story.stages.length; stageIndex++) {
    const svg = parser.parse(render(story, stageIndex, compact)).svg;
    const geometry = ccnaWebsiteDiagramGeometry(story, compact);
    const stage = story.stages[stageIndex];
    assert.equal(svg["aria-label"], story.altText);
    assert.equal(svg.desc["#text"], story.boundary);
    assert.equal(svg.viewBox, `0 0 ${geometry.width} ${geometry.height}`);
    const nodes = array(svg.g);
    assert.deepEqual(nodes.map(node => node["data-node"]), story.nodes.map(node => node.id));
    for (const [index, node] of nodes.entries()) {
      assert.equal(node["data-kind"], story.nodes[index].kind);
      assert.equal(node["data-active"], String(stage.activeNodes.includes(story.nodes[index].id)));
      assert.deepEqual(array(node.text).map(text => text["data-label"]), [story.nodes[index].label, story.nodes[index].detail]);
      for (const text of array(node.text)) {
        const reconstructed = array(text.tspan).map(span => typeof span === "string" ? span : span["#text"] ?? "").join(" ").replace(/\s+/g, " ").trim();
        assert.equal(reconstructed, text["data-label"], "Every word must render, not only appear in an aria label.");
        assert.ok(Number(text.x) >= 0 && Number(text.x) <= geometry.width);
        const finalBaseline = Number(text.y) + array(text.tspan).slice(1).reduce((total, span) => total + Number(span.dy), 0);
        assert.ok(finalBaseline + 5 <= geometry.height, `Text baseline outside SVG: ${text["data-label"]}`);
      }
    }
    const edges = array(svg.path);
    assert.deepEqual(edges.map(edge => [edge["data-connection"], edge["data-from"], edge["data-to"]]), story.connections.map(edge => [edge.id, edge.from, edge.to]));
    for (const [index, edge] of edges.entries()) {
      const source = story.connections[index];
      const directed = stage.activeConnections.includes(source.id) && stage.direction !== "none";
      assert.equal(Boolean(edge["marker-end"]), directed);
      assert.equal(edge["data-arrow-to"], directed ? stage.direction === "reverse" ? source.from : source.to : undefined);
      assert.doesNotMatch(edge.d, /NaN|Infinity|undefined/);
    }
    if (story.connections.length === 0) {
      assert.equal(svg["data-website-diagram"], "evidence");
      assert.equal(svg.defs, undefined, "Evidence panels must have no traffic arrows.");
      assert.equal(edges.length, 0, "No connections may be inferred from node order.");
    }
  }
  assert.equal(JSON.stringify(story), original, "Website rendering cannot mutate lesson data.");
}

test("complete vectors preserve all nodes, exact words, declared edges and stage directions", () => {
  for (const story of [firstNetworkVisualStory, ...scenes(ccnaTopologyVisual()), ...scenes(ccnaLayeredVisual()), evidence, bundle]) assertScene(story);
});

test("parallel members and spines stay alternatives in wide and narrow diagrams", () => {
  for (const story of [bundle, fabric]) for (const compact of [false, true]) {
    const layout = ccnaWebsiteDiagramGeometry(story, compact);
    const first = layout.nodes[story === bundle ? 1 : 2];
    const second = layout.nodes[story === bundle ? 2 : 3];
    assert.equal(first.rank, second.rank);
    assert.equal(compact ? first.y : first.x, compact ? second.y : second.x);
    assert.notEqual(compact ? first.x : first.y, compact ? second.x : second.y);
    assert.equal(story.connections.some(edge => edge.from === first.id && edge.to === second.id || edge.from === second.id && edge.to === first.id), false);
  }
});

test("cyclic and wider fan-out models keep finite routes and complete nodes", () => {
  const cyclic = structuredClone(firstNetworkVisualStory);
  cyclic.connections.push({ id: "return-link", from: "pc2", to: "pc1" });
  assertScene(cyclic);
  const fanout = { ...evidence, layout: "sequence", connections: evidence.nodes.slice(1).map((node, index) => ({ id: `fan-${index}`, from: "prefix", to: node.id })) };
  assertScene(fanout);
});

test("actual requested candidate diagrams render without changing source artifacts", async t => {
  const names = await readdir("test-results").catch(() => []);
  const protectedNames = names.filter(name => /^ccna-day(?:2|3|6|14|17|22|24|29)-(?:corrected-content\.json|supplemented-content\.json|linkedin.*)$/.test(name));
  const before = new Map(await Promise.all(protectedNames.map(async name => [name, hash(await readFile(`test-results/${name}`))])));
  let found = 0;
  for (const day of [2, 3, 6, 14, 17, 22, 24, 29]) {
    const name = [`ccna-day${day}-supplemented-content.json`, `ccna-day${day}-corrected-content.json`].find(name => names.includes(name));
    if (!name) { t.diagnostic(`Day ${day} private candidate is unavailable; portable fixtures still run.`); continue; }
    const content = JSON.parse(await readFile(`test-results/${name}`, "utf8"));
    for (const story of scenes(content.visualStory)) assertScene(story);
    found++;
  }
  for (const [name, digest] of before) assert.equal(hash(await readFile(`test-results/${name}`)), digest, `${name} changed during rendering.`);
  t.diagnostic(`Rendered candidates for ${found}/8 requested days; ${before.size} candidate/social artifact hashes unchanged.`);
});

test("contextual heading, accessible stage controls and original transcript are retained", () => {
  const story = { ...evidence, comparisons: [bundle] };
  const html = renderToStaticMarkup(createElement(CcnaVisualExplainer, { story, artwork: null }));
  assert.match(html, /<h2[^>]*>Separate evidence, not extra cables<\/h2>/);
  assert.doesNotMatch(html, /Five topology comparisons|aria-label="Network topologies"/);
  assert.match(html, /aria-label="Visual comparisons"/);
  assert.match(html, /aria-live="polite" aria-atomic="true"/);
  assert.match(html, /aria-label="Previous visual step"[^>]*disabled/);
  assert.match(html, /aria-label="Restart visual explanation"[^>]*disabled/);
  assert.match(html, /aria-label="Next visual step"/);
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 2);
  assert.ok(html.includes(story.stages[0].explanation));
  assert.ok(html.includes("Full visual explanation and references"));
});

test("module styles retain legibility, container responsiveness and reduced motion without global edits", async () => {
  const css = postcss.parse(await readFile("src/components/ccna-visual-explainer.module.css", "utf8"));
  const queries = [];
  css.walkAtRules(rule => queries.push(`${rule.name} ${rule.params}`));
  assert.ok(queries.some(value => value.startsWith("container ")));
  assert.ok(queries.includes("media (prefers-reduced-motion: reduce)"));
  css.walkRules(rule => assert.match(rule.selector, /\.explainer/, "Rules must stay inside the local explainer."));
  css.walkDecls("font-size", declaration => assert.doesNotMatch(declaration.value, /vw|cqw|clamp/));
  for (const color of ["#182332", "#425564", "#075e62", "#a32b59"]) assert.ok(contrastRatio(color, "#fafbfc") >= 4.5);
});

test("default shared/social SVG remains byte-identical in all baseline stages and layouts", () => {
  const expected = [
    "a776ced98c681b070ea081e05833a6727370a33aac90206912a8871c2352b8e2", "bc9ec3a94b222130126d5f9319192de2c7eede0e9e95814fc6bdc515fb9f5afd", "81e16f57f838d91ed8127037a2ca7b55ebc6b5ad05779a0e3b97bee9ea855ac3",
    "2f3e9ad5110d557da02ca4976e6e148aa4123dab2f8835e1b1b5cb408f10c03d", "4a57dc9430845d0358d86cd596d35495327ef26440f4f4c003e442f53be41314", "c449eaa91bd5a2bb56fbebf48681f19d5a26cba1f1f2361995f91451303d702a",
    "e7377c9970a76a4a77f281da35c0d209ff97dcc2e2f59a0f94698c15af2a6d8e", "a27e234f9cd8ad7c19a151ca37288079379447c9765c21a48984e1e3f3f00314", "a27e234f9cd8ad7c19a151ca37288079379447c9765c21a48984e1e3f3f00314",
    "2f8f849d6f175169b68327b5a2694db1f7f8a5f824510ae0337bcd202ce423c6", "e48cbf90963de7468f0b1766f14dd0b3dea5c6fc87a46c6583b9dec0cbf8d37b", "e48cbf90963de7468f0b1766f14dd0b3dea5c6fc87a46c6583b9dec0cbf8d37b"
  ];
  const actual = [firstNetworkVisualStory, fabric].flatMap(story => [false, true].flatMap(compact => [0, 1, 2].map(stageIndex => hash(renderToStaticMarkup(createElement(CcnaVisualDiagram, { story, compact, stageIndex }))))));
  assert.deepEqual(actual, expected);
});

test("shared social source artifacts stay unchanged", async () => {
  const expected = {
    "src/components/ccna-visual-diagram.tsx": "e99f251c4fc0a19d88b32989d67ec408804f685274c040d96f726afcd0aedd03",
    "src/lib/ccna-social-visual.tsx": "7cee8545b78ea0afbf6e51f87abaebbfd99a44607277d354e62386330a3b4eaa"
  };
  for (const [path, digest] of Object.entries(expected)) assert.equal(hash((await readFile(path, "utf8")).replaceAll("\r\n", "\n")), digest, path);
});

test("website component bundles its scoped CSS without a browser or filesystem output", async () => {
  const result = await build({
    stdin: { contents: "export {CcnaVisualExplainer} from './src/components/ccna-visual-explainer';", resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, outfile: "ccna-visual-pure-test.js", platform: "browser", format: "esm", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" }
  });
  assert.equal(result.errors.length, 0);
  const css = result.outputFiles.find(file => file.path.endsWith(".css"));
  assert.ok(css?.text.includes("prefers-reduced-motion"));
  assert.ok(css?.text.includes("container-type: inline-size"));
  assert.ok(result.outputFiles.find(file => file.path.endsWith(".js"))?.text.includes("data-website-diagram"));
});
