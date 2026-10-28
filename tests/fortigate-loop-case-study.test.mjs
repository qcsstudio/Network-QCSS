import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEditorialReadiness } from "../src/lib/editorial-publication-policy.ts";
import { fortigateLayer2LoopCaseStudy as post, websiteOnlyResources, resourceCardImage } from "../src/lib/website-only-resources.ts";
import sitemapModule from "../src/app/resources/sitemap.ts";
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url));
const diagnostics=JSON.parse(read("src/content/website-only/fortigate-layer2-loop-diagnostics.json"));
const hash=(v)=>createHash("sha256").update(v).digest("hex");
const sorted=(v)=>Array.isArray(v)?v.map(sorted):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;
const sitemap=typeof sitemapModule==="function"?sitemapModule:sitemapModule.default;
test("loop case passes existing editorial gates with mapped primary evidence",()=>{
  assert.deepEqual(evaluateEditorialReadiness(post).issues,[]);
  assert.equal(post.sources.length,9);
  const urls=new Set(post.sources.map(s=>s.url));
  for(const s of [...post.sections,...post.questions]) {assert.ok(s.sourceUrls.length);for(const u of s.sourceUrls) assert.ok(urls.has(u));}
  for(const c of diagnostics.checks) assert.ok(urls.has(c.sourceUrl));
});
test("case unknowns and operational safety are explicit",()=>{
  const body=post.sections.map(s=>s.body).join(" ");
  for(const phrase of ["not disclosed", "not a reconstruction", "No FortiGate, FortiSwitch, FortiAP or networking lab was operated", "Do not disable spanning tree", "not a recommendation for every device", "not merely a green total", "not blindly", "rollback"]) {
    if(phrase==="not blindly") assert.match(body,/does not mean blindly/); else assert.ok(body.includes(phrase),phrase);
  }
  assert.match(body,/build 3744/);
});
test("six observational commands have console, stop, limits and citations",()=>{
  assert.deepEqual(diagnostics.checks.map(c=>c.command),["get system performance status","diagnose sys mpstat 2","diagnose sys top","diagnose netlink interface packet-rate","get switch lldp neighbors-summary","diagnose stp instance list"]);
  for(const c of diagnostics.checks){assert.match(c.purpose,/^Forti(Gate|Switch):/);assert.ok(c.stop.length>20&&c.limit.length>50);assert.doesNotMatch(c.command,/clear|reset|reboot|kill|config|debug enable/);}
});
test("all diagrams are high-resolution, complete and free of external image dependencies",()=>{
  for(const [name,h] of [["evidence",1350],["topology",1600],["social",1500]]){
    const base=`public/images/editorial/fortigate-loop-${name}`;
    const png=read(base+".png"),svg=read(base+".svg").toString();
    assert.equal(png.readUInt32BE(16),2400);assert.equal(png.readUInt32BE(20),h);
    assert.match(svg,/<title id="title">/);assert.match(svg,/<desc id="desc">/);
    assert.doesNotMatch(svg,/<script|foreignObject|https?:\/\/[^" ]+\.(png|jpg)/);
  }
  const topology=read("public/images/editorial/fortigate-loop-topology.svg").toString();
  for(const label of ["Switch A","Switch B","Switch C"]) assert.equal(topology.split(`>${label}</text>`).length-1,2);
  assert.match(topology,/Teaching example only/);assert.match(topology,/Never reproduce a loop in production/);
});
test("static route is discoverable and isolated from database and social workflows",()=>{
  const route=read(`src/app/resources/${post.slug}/page.tsx`).toString();
  assert.match(route,/export const dynamic = "error"/);assert.match(route,/showLeadForm=\{false\}/);
  assert.match(route,/TechArticle/);assert.match(route,/FAQPage/);
  assert.doesNotMatch(route,/prisma|content-posts|editorial-delivery|openai|fetch\(/i);
  assert.equal(websiteOnlyResources.filter(p=>p.slug===post.slug).length,1);
  assert.equal(resourceCardImage(post),post.image);
  assert.equal(sitemap().filter(p=>p.url.endsWith(`/resources/${post.slug}`)).length,1);
});
test("release requires genuine exact-content independent approval",()=>{
  const review=JSON.parse(read("src/content/website-only/fortigate-layer2-loop-case-study.review.json"));
  assert.equal(review.status,"PASS");assert.equal(review.reviewerId,"01a13e77-9990-71d0-b15b-6295f9c59903");
  const content={...post};for(const key of ["reviewedBy","editorialMethod","publishedAt","updatedAt"]) delete content[key];
  assert.equal(hash(JSON.stringify(sorted(content))),review.substantiveContentSha256);
  for(const a of review.artifacts){if(a.file.endsWith("fortigate-layer2-loop-case-study.json"))continue;assert.equal(hash(read(a.file)),a.sha256,a.file);}
  assert.doesNotMatch(post.editorialMethod,/review is pending/);
});
