import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const root = new URL('../', import.meta.url);
const pkg = JSON.parse(fs.readFileSync(new URL('package.json', root)));
const lock = JSON.parse(fs.readFileSync(new URL('package-lock.json', root)));
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const changes = [
  ['dependencies', 'next', '16.4.6'],
  ['dependencies', 'sharp', '0.35.5'],
  ['devDependencies', 'eslint-config-next', '16.4.6'],
  ['optionalDependencies', '@img/sharp-linux-x64', '0.35.5'],
  ['optionalDependencies', '@img/sharp-libvips-linux-x64', '1.3.4']
];

test('only the five approved root dependency specifications change', () => {
  const rest = structuredClone(pkg);
  for (const [group, name, version] of changes) {
    assert.equal(pkg[group][name], version);
    assert.equal(lock.packages[''][group][name], version);
    delete rest[group][name];
  }
  assert.equal(hash(rest), '857abe3ba9c80ab6cb190ee942834a56f30bf52c8414d23b89654ed0e028ead3');
});

test('unrelated locked dependency records remain identical to the baseline', () => {
  const allowed = key => key === '' || /^node_modules\/(?:@img\/sharp[^/]*|@next\/(?:env|eslint-plugin-next|swc-[^/]+)|next|eslint-config-next|sharp)(?:$|\/node_modules\/(?:@img\/sharp[^/]*|semver)$)/.test(key);
  const rest = Object.entries(lock.packages).filter(([key]) => !allowed(key))
    .sort(([a], [b]) => a.localeCompare(b, 'en'));
  assert.equal(rest.length, 626);
  assert.equal(hash(rest), '1e880ba4767a9ed10c6f2453487b541454fe97f4a75af1321eaf46dc37130e0d');
});

test('patched Next and Sharp match the verified registry integrity values', () => {
  for (const [name, version, integrity] of [
    ['next', '16.4.6', 'sha512-QZJiYhaZLJMo2KpkQGQIwvmd79WVsAWeYIU554a8d7zArS3si/IRy3lBNV/rtYhE70oLwdLYhPAXLPx8HwcwtA=='],
    ['sharp', '0.35.5', 'sha512-Ywn4OnzGukp7CDMrp08RQ50YKmuwG47brZgIVPTvBaaAfQlRlygrRqSrxdCiL9M+LlzLBiJ68IR1QqvzHyjC7g==']
  ]) {
    const entry = lock.packages[`node_modules/${name}`];
    assert.equal(entry.version, version);
    assert.equal(entry.integrity, integrity);
    assert.equal(new URL(entry.resolved).hostname, 'registry.npmjs.org');
  }
});

test('all platform bindings are patched and no older nested Sharp survives', () => {
  for (const [key, entry] of Object.entries(lock.packages)) {
    if (/\/node_modules\/sharp$/.test('/' + key)) assert.equal(entry.version, '0.35.5');
    if (/^node_modules\/@img\/sharp-libvips-/.test(key)) assert.equal(entry.version, '1.3.4');
    else if (/^node_modules\/@img\/sharp-/.test(key)) assert.equal(entry.version, '0.35.5');
    if (/^node_modules\/@next\/(?:env|eslint-plugin-next|swc-)/.test(key)) assert.equal(entry.version, '16.4.6');
    assert.ok(!key.startsWith('node_modules/sharp/node_modules/@img/'));
  }
  assert.equal(lock.packages['node_modules/next'].optionalDependencies.sharp, '^0.35.5');
  assert.equal(pkg.overrides.sharp, '$sharp');
});

test('installed runtime uses patched Next and Sharp with functional image decoding', async () => {
  assert.equal(require('next/package.json').version, '16.4.6');
  assert.equal(require('sharp/package.json').version, '0.35.5');
  const sharp = require('sharp');
  const input = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="16" height="12"><rect width="16" height="12" fill="#c11352"/></svg>');
  const png = await sharp(input).resize(8, 6).png().toBuffer();
  const metadata = await sharp(png).metadata();
  assert.equal(metadata.width, 8);
  assert.equal(metadata.height, 6);
  assert.equal(metadata.format, 'png');
});
