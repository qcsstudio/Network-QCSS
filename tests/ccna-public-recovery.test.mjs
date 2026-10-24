import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validatePublicCcnaRecovery, createPublicCcnaReader } from '../src/lib/ccna-public-recovery.ts';
import { ccnaContentDigest } from '../src/lib/ccna-generation-pipeline.ts';

const raw = JSON.parse(readFileSync('src/content/ccna-public-recovery.json', 'utf8'));
const lessons = validatePublicCcnaRecovery(raw);
const duringOutage = () => Date.parse('2026-10-24T12:00:00Z');
const afterReset = () => Date.parse('2026-11-01T00:00:00Z');
const quota = () => { throw Object.assign(new Error('quota exceeded'), { code: '53000' }); };

test('public bundle is the exact last-published, reviewed three-chapter content', () => {
  assert.deepEqual(lessons.map(lesson => lesson.sequence), [14,15,16]);
  assert.deepEqual(lessons.map(lesson => ccnaContentDigest(lesson.content)), [
    'fa78fee6271f0e51835ba6aa4690bd6b39711fc89acc106551e98e245e07b3ff',
    'fa7ae0626440e392830b887768c18b19e98212b0510852d4fed9ff2043c4447f',
    '9d47f8529d0ae8c8ddc9335014346a8f2d37279c2bd2cfa13c3ea1de05c17e4b'
  ]);
  assert.deepEqual(lessons.map(lesson => lesson.publishedAt), [
    '2026-10-19T16:26:52.967Z', '2026-10-20T10:35:27.443Z', '2026-10-20T11:05:04.770Z'
  ]);
});

test('private operational fields and drafts cannot enter the public bundle', () => {
  for (const patch of [{ status:'draft' }, { generationTrace:{} }, { jobs:[] }, { approvedBy:'private' }, { lastError:'private' }]) {
    assert.throws(() => validatePublicCcnaRecovery([{ ...raw[0], ...patch }, ...raw.slice(1)]));
  }
});

test('wrong days, slugs, duplicate entries and invalid timestamps fail closed', () => {
  for (const patch of [{ sequence:17 }, { slug:'other-lesson' }, { week:99 }, { day:5 }, { updatedAt:'2020-01-01T00:00:00Z' }]) {
    assert.throws(() => validatePublicCcnaRecovery([{ ...raw[0], ...patch }, ...raw.slice(1)]));
  }
  assert.throws(() => validatePublicCcnaRecovery([raw[0],raw[0],raw[2]]));
  assert.throws(() => validatePublicCcnaRecovery(raw.slice(0,2)));
});

test('approved outage window restores the three pages and navigation without any DB call', async () => {
  let calls = 0;
  const forbidden = async () => { calls++; throw new Error('must not touch suspended DB'); };
  const reader = createPublicCcnaReader(lessons,{ bySlug:forbidden, list:forbidden },duringOutage);
  for (const lesson of lessons) assert.equal(await reader.bySlug(lesson.slug),lesson);
  for (const slug of ['unreviewed-draft', 'unknown-slug', '', 'slaac-eui64-and-neighbor-discovery-typo']) {
    assert.equal(await reader.bySlug(slug), null);
  }
  assert.deepEqual(await reader.list(),lessons);
  assert.equal(calls,0);
});

test('after the hold a healthy missing or withdrawn lesson remains missing', async () => {
  const reader = createPublicCcnaReader(lessons,{ bySlug:async()=>null, list:async()=>[] },afterReset);
  assert.equal(await reader.bySlug(lessons[0].slug),null);
  assert.deepEqual(await reader.list(),[]);
});

test('fresh DB content wins after reset, not the bundled older revision', async () => {
  const newer = { ...lessons[0], updatedAt:'2026-11-02T00:00:00Z' };
  const reader = createPublicCcnaReader(lessons,{ bySlug:async()=>newer, list:async()=>[newer] },afterReset);
  assert.equal(await reader.bySlug(newer.slug),newer);
  assert.deepEqual(await reader.list(),[newer]);
});

test('known availability errors retain only the approved public recovery copies', async () => {
  const reader = createPublicCcnaReader(lessons,{ bySlug:quota, list:quota },afterReset);
  assert.equal(await reader.bySlug(lessons[0].slug),lessons[0]);
  assert.deepEqual(await reader.list(),lessons);
  await assert.rejects(reader.bySlug('unreviewed-draft'));
});

test('programming/auth errors are not misrepresented as successful recovery', async () => {
  const bad = async () => { throw new Error('unexpected mapping error'); };
  const reader = createPublicCcnaReader(lessons,{ bySlug:bad, list:bad },afterReset);
  await assert.rejects(reader.bySlug(lessons[0].slug),/unexpected/);
  await assert.rejects(reader.list(),/unexpected/);
});

test('list limits remain bounded and integral', async () => {
  const reader = createPublicCcnaReader(lessons,{ bySlug:quota, list:quota },duringOutage);
  assert.equal((await reader.list(1)).length,1);
  assert.equal((await reader.list(2.9)).length,2);
  assert.equal((await reader.list(NaN)).length,3);
});

test('admin and social workers still use authoritative DB readers', () => {
  for (const file of ['src/lib/ccna-learning.ts','src/lib/social-publications.ts','src/lib/meta-publications.ts','scripts/ccna-local-release.ts','scripts/ccna-local-supplement.ts']) {
    assert.doesNotMatch(readFileSync(file,'utf8'),/ccna-public-lessons|ccna-public-recovery/);
  }
  assert.match(readFileSync('src/lib/ccna-public-lessons.ts','utf8'),/import "server-only"/);
  for (const file of ['src/app/courses/ccna/page.tsx','src/app/courses/ccna/lessons/[slug]/page.tsx','src/app/courses/ccna/lessons/[slug]/social-image/route.tsx','src/app/courses/ccna/lessons/[slug]/opengraph-image.tsx']) {
    assert.match(readFileSync(file,'utf8'),/ccna-public-lessons/);
  }
});
