import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { evaluateEditorialReadiness } from "../src/lib/editorial-publication-policy.ts";
import { fortigateAutomationRebootCaseStudy as post, websiteOnlyResources, resourceCardImage } from "../src/lib/website-only-resources.ts";
import sitemapModule from "../src/app/resources/sitemap.ts";
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url));
const diagnostics=JSON.parse(read("src/content/website-only/fortigate-automation-reboot-diagnostics.json"));
const hash=(value)=>createHash("sha256").update(value).digest("hex");
const sorted=(v)=>Array.isArray(v)?v.map(sorted):v&&typeof v==="object"?Object.fromEntries(Object.keys(v).sort().map(k=>[k,sorted(v[k])])):v;
const sitemap=typeof sitemapModule==="function"?sitemapModule:sitemapModule.default;

test("reboot case passes existing gates with ten mapped sources",()=>{
  assert.deepEqual(evaluateEditorialReadiness(post).issues,[]);
  assert.equal(post.sources.length,10);
  const urls=new Set(post.sources.map(s=>s.url));
  for(const s of [...post.sections,...post.questions]){assert.ok(s.sourceUrls.length);for(const u of s.sourceUrls)assert.ok(urls.has(u));}
  for(const c of diagnostics.checks)assert.ok(urls.has(c.sourceUrl));
});
test("case distinguishes reported outcome, defaults and operational safety",()=>{
  const body=post.sections.map(s=>s.body).join(" ");
  for(const phrase of ["not independently reproduced", "not executed on a FortiGate", "not a universal", "7.4.10", "7.6.5", "Do not turn off FortiGuard", "shared action", "Do not blindly restore", "not a mandatory default name", "Test Automation Stitch"])assert.ok(body.includes(phrase),phrase);
  assert.match(body,/warm reboot.*does not.*prove/is);
  assert.match(body,/No Updates.*different from a failed check/);
});
test("seven inspection commands never execute automation or edit settings",()=>{
  assert.equal(diagnostics.checks.length,7);
  assert.match(diagnostics.introduction,/FortiGate CLI console/);
  for(const c of diagnostics.checks){assert.match(c.purpose,/^FortiGate:/);assert.ok(c.limit.length>75&&c.stop.length>75);assert.doesNotMatch(c.command,/^(config|execute)|automation test|debug enable|clear|reset|autod [1-9]/);}
  assert.equal(diagnostics.checks[5].command,"show full-configuration system autoupdate schedule");
});
test("diagrams are accessible, full resolution and self contained",()=>{
  for(const [name,height] of [["evidence",1350],["dependencies",1600],["social",1800]]){
    const base=`public/images/editorial/fortigate-automation-reboot-${name}`,png=read(base+".png"),svg=read(base+".svg").toString();
    assert.equal(png.readUInt32BE(16),2400);assert.equal(png.readUInt32BE(20),height);
    assert.match(svg,/<title id="title">/);assert.match(svg,/<desc id="desc">/);assert.doesNotMatch(svg,/<script|foreignObject|https?:\/\/[^" ]+\.(png|jpg)/);
  }
  assert.match(read("public/images/editorial/fortigate-automation-reboot-evidence.svg").toString(),/02 \/ STITCH/);
});
test("static article is discoverable without database or social publishing dependencies",()=>{
  const route=read(`src/app/resources/${post.slug}/page.tsx`).toString();
  assert.match(route,/export const dynamic = "error"/);assert.match(route,/showLeadForm=\{false\}/);assert.match(route,/TechArticle/);assert.match(route,/FAQPage/);
  assert.doesNotMatch(route,/prisma|editorial-delivery|openai|fetch\(/i);
  assert.equal(websiteOnlyResources.filter(p=>p.slug===post.slug).length,1);assert.equal(resourceCardImage(post),post.image);
  assert.equal(sitemap().filter(p=>p.url.endsWith(`/resources/${post.slug}`)).length,1);
  assert.doesNotMatch(read("src/lib/blog.ts").toString(),new RegExp(post.slug));
});
test("publication is bound to exact independent reviewed artifacts",()=>{
  const review=JSON.parse(read("src/content/website-only/fortigate-automation-reboot-case-study.review.json"));
  assert.equal(review.status,"PASS");assert.equal(review.reviewerId,"01a13e77-9990-71d0-b15b-6295f9c59903");
  const content={...post};for(const k of ["reviewedBy","editorialMethod","publishedAt","updatedAt"])delete content[k];
  assert.equal(hash(JSON.stringify(sorted(content))),review.substantiveContentSha256);
  for(const a of review.artifacts){if(a.file.endsWith("fortigate-automation-reboot-case-study.json"))continue;assert.equal(hash(read(a.file)),a.sha256,a.file);}
  assert.match(post.reviewedBy.name,/independent Codex/);assert.doesNotMatch(post.editorialMethod,/review is pending/i);
});
