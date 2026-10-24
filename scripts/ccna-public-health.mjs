import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

// Read-only public checks. No credentials, database, generation or social APIs.
const base = new URL(process.argv[2] || 'https://www.qcsstudio.com');
assert.ok(base.protocol === 'https:' || (base.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(base.hostname)));
assert.ok(!base.username && !base.password && base.pathname === '/');
const output = process.argv[3];
if (output) mkdirSync(output, { recursive:true });
const lessons = JSON.parse(readFileSync(new URL('../src/content/ccna-public-recovery.json', import.meta.url), 'utf8'));
const escape = value => value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#x27;');
const report = { checkedAt:new Date().toISOString(), base:base.origin, results:[], index:null, unknownSlug:null, passed:false };
const save = () => { if (output) writeFileSync(path.join(output,'http-verification.json'), JSON.stringify(report,null,2) + '\n'); };

for (const [index, lesson] of lessons.entries()) {
  const lessonPath = `/courses/ccna/lessons/${lesson.slug}`;
  const result = { day:lesson.sequence, url:new URL(lessonPath,base).href, passed:false };
  report.results.push(result);
  try {
    const response = await fetch(result.url,{ signal:AbortSignal.timeout(45000) });
    const html = await response.text();
    result.status = response.status;
    assert.equal(response.status,200);
    assert.ok(html.includes(escape(lesson.title)), 'Lesson title missing');
    result.canonical = `https://www.qcsstudio.com${lessonPath}`;
    assert.ok(html.includes(`rel="canonical" href="${result.canonical}"`), 'Canonical missing');
    assert.ok(!/<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html), 'Page is noindex');
    for (const section of lesson.content.sections) assert.ok(html.includes(escape(section.heading)), `Missing section: ${section.heading}`);
    for (const question of lesson.content.quiz) assert.ok(html.includes(escape(question.question)), `Missing quiz: ${question.question}`);
    for (const neighbour of [lessons[index - 1], lessons[index + 1]].filter(Boolean)) {
      assert.ok(html.includes(`/courses/ccna/lessons/${neighbour.slug}`), `Missing neighbour: ${neighbour.sequence}`);
    }
    result.sections = lesson.content.sections.length;
    result.quizQuestions = lesson.content.quiz.length;
    result.images = [];
    for (const [suffix,width,height] of [['social-image',1920,1080],['opengraph-image',1200,630]]) {
      const image = await fetch(new URL(`${lessonPath}/${suffix}`,base),{ signal:AbortSignal.timeout(45000) });
      const bytes = Buffer.from(await image.arrayBuffer());
      assert.equal(image.status,200, `${suffix} status`);
      assert.equal(bytes.subarray(1,4).toString(),'PNG', `${suffix} encoding`);
      assert.ok(bytes.length > 10000, `${suffix} empty`);
      assert.equal(bytes.readUInt32BE(16),width);
      assert.equal(bytes.readUInt32BE(20),height);
      result.images.push({ suffix,status:image.status,width,height,bytes:bytes.length });
    }
    result.passed = true;
  } catch (error) { result.error = error.message; }
  save();
  console.log(JSON.stringify(result));
}
try {
  const index = await fetch(new URL('/courses/ccna',base),{ signal:AbortSignal.timeout(45000) });
  const html = await index.text();
  assert.equal(index.status,200);
  const linked = lessons.filter(lesson => html.includes(`/courses/ccna/lessons/${lesson.slug}`)).length;
  assert.equal(linked,60);
  report.index = { status:index.status,linkedChapters:linked,passed:true };
  const missing = await fetch(new URL('/courses/ccna/lessons/not-a-published-ccna-chapter',base),{ signal:AbortSignal.timeout(45000) });
  assert.equal(missing.status,404);
  report.unknownSlug = { status:missing.status,passed:true };
} catch (error) { report.index = { ...report.index, error:error.message,passed:false }; }
report.passed = report.results.length === 60 && report.results.every(result => result.passed) && report.index?.passed && report.unknownSlug?.passed === true;
save();
console.log(JSON.stringify({ passed:report.passed,chapters:report.results.filter(result => result.passed).length,index:report.index,unknownSlug:report.unknownSlug }));
if (!report.passed) process.exitCode = 1;
