import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEditorialReadiness } from "../src/lib/editorial-publication-policy.ts";
import { fortigateSubnetOverlapCaseStudy as post, websiteOnlyResources, resourceCardImage } from "../src/lib/website-only-resources.ts";
import sitemapModule from "../src/app/resources/sitemap.ts";
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url));
const diagnostics=JSON.parse(read("src/content/website-only/fortigate-subnet-overlap-diagnostics.json"));
const hash=(value)=>createHash("sha256").update(value).digest("hex");
const sorted=(v)=>Array.isArray(v)?v.map(sorted):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;
const sitemap=typeof sitemapModule==="function"?sitemapModule:sitemapModule.default;

test("overlap article passes existing editorial gates and maps all claims",()=>{
  assert.deepEqual(evaluateEditorialReadiness(post).issues,[]);
  assert.equal(post.sources.length,10);
  const urls=new Set(post.sources.map(s=>s.url));
  for(const s of [...post.sections,...post.questions]){assert.ok(s.sourceUrls.length);for(const u of s.sourceUrls)assert.ok(urls.has(u));}
  for(const c of diagnostics.checks)assert.ok(urls.has(c.sourceUrl));
});
test("reported diagnosis is separate from completion and routing-context assumptions",()=>{
  const body=post.sections.map(s=>s.body).join(" ");
  for(const phrase of ["completed post-change results", "not executed on a FortiGate", "not automatically evidence", "one-way ping", "rollback", "Do not disable acceleration", "not a permanent fix", "customer addresses", "different masks"])assert.ok(body.toLowerCase().includes(phrase.toLowerCase()),phrase);
  assert.match(body,/dedicated-to management.*dedicated-mgmt/s);
  assert.match(body,/same forwarding context/);
});
test("observational commands have actual console, safe bounds and explicit limitations",()=>{
  assert.equal(diagnostics.checks.length,5);
  assert.match(diagnostics.introduction,/Windows command belongs on the test client/);
  assert.match(diagnostics.privacyNote,/15 seconds/);
  for(const c of diagnostics.checks){assert.match(c.purpose,/^(FortiGate|Windows client):/);assert.ok(c.limit.length>70&&c.stop.length>60);assert.doesNotMatch(c.command,/clear|reset|config|reboot|debug enable/);}
  assert.equal(diagnostics.checks[4].command,"diagnose sniffer packet any 'host 192.0.2.53 and port 53' 4 50 l");
});
test("three diagrams are full-resolution, labelled and have no external dependencies",()=>{
  for(const [name,height] of [["evidence",1350],["topology",1600],["social",1800]]){
    const base=`public/images/editorial/fortigate-overlap-${name}`,png=read(base+".png"),svg=read(base+".svg").toString();
    assert.equal(png.readUInt32BE(16),2400);assert.equal(png.readUInt32BE(20),height);
    assert.match(svg,/<title id="title">/);assert.match(svg,/<desc id="desc">/);
    assert.doesNotMatch(svg,/<script|foreignObject|https?:\/\/[^" ]+\.(png|jpg)/);
  }
  const svg=read("public/images/editorial/fortigate-overlap-topology.svg").toString();
  for(const label of ["Client","FortiGate","Transit Router","DNS Server","Management Port","HYPOTHESIS TO VERIFY"])assert.ok(svg.includes(label));
  assert.match(svg,/No device or packet simulation/);
});
test("static discoverability has no publishing or database dependency",()=>{
  const route=read(`src/app/resources/${post.slug}/page.tsx`).toString();
  assert.match(route,/export const dynamic = "error"/);assert.match(route,/showLeadForm=\{false\}/);assert.match(route,/TechArticle/);assert.match(route,/FAQPage/);
  assert.doesNotMatch(route,/prisma|content-posts|editorial-delivery|openai|fetch\(/i);
  assert.equal(websiteOnlyResources.filter(p=>p.slug===post.slug).length,1);
  assert.equal(resourceCardImage(post),post.image);
  assert.equal(sitemap().filter(p=>p.url.endsWith(`/resources/${post.slug}`)).length,1);
  assert.doesNotMatch(read("src/lib/blog.ts").toString(),new RegExp(post.slug));
});
test("exact reviewed content and artifacts are required for publication",()=>{
  const review=JSON.parse(read("src/content/website-only/fortigate-subnet-overlap-case-study.review.json"));
  assert.equal(review.status,"PASS");assert.equal(review.reviewerId,"01a13e77-9990-71d0-b15b-6295f9c59903");
  const content={...post};for(const k of ["reviewedBy","editorialMethod","publishedAt","updatedAt"])delete content[k];
  assert.equal(hash(JSON.stringify(sorted(content))),review.substantiveContentSha256);
  for(const a of review.artifacts){if(a.file.endsWith("fortigate-subnet-overlap-case-study.json"))continue;assert.equal(hash(read(a.file)),a.sha256,a.file);}
  assert.match(post.reviewedBy.name,/independent Codex/);assert.doesNotMatch(post.editorialMethod,/review is pending/);
});
