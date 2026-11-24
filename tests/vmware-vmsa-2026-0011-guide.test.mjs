import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const {createElement} = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const {parse} = require('parse5');
const root = fileURLToPath(new URL('../', import.meta.url));
const modulePath = 'src/lib/vmware-vmsa-2026-0011-resource.ts';
const routePath = 'src/app/resources/vmware-vmsa-2026-0011-patching-guide/page.tsx';
const jsonPath = 'src/content/website-only/vmware-vmsa-2026-0011.json';
const articleBytes = fs.readFileSync(path.join(root, jsonPath));
const article = JSON.parse(articleBytes);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const publicationDate = '2026-11-25';
const siteConfig = {name: 'QuantumCrafters Studio Private Limited', url: 'https://www.qcsstudio.com'};
function load(relative, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, relative), 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true}
  }).outputText;
  const mod = {exports: {}};
  vm.runInNewContext(code, {module: mod, exports: mod.exports, Buffer, URL, Date, Intl,
    require: id => Object.hasOwn(mocks, id) ? mocks[id] : require(id)}, {filename: relative});
  return mod.exports;
}
function resource() {
  return load(modulePath, {'../content/website-only/vmware-vmsa-2026-0011.json': article});
}
function existingResources() {
  const relative = 'src/lib/website-only-resources.ts';
  const source = ts.createSourceFile(relative, fs.readFileSync(path.join(root, relative), 'utf8'), ts.ScriptTarget.Latest, true);
  const mocks = {};
  for (const item of source.statements.filter(ts.isImportDeclaration)) {
    if (item.importClause?.isTypeOnly) continue;
    const id = item.moduleSpecifier.text;
    assert.ok(id.startsWith('../content/website-only/') && id.endsWith('.json'));
    mocks[id] = JSON.parse(fs.readFileSync(path.resolve(root, path.dirname(relative), id), 'utf8'));
  }
  return load(relative, mocks).websiteOnlyResources;
}
const data = resource();
const styles = new Proxy({}, {get: (_target, key) => String(key)});
const structured = load('src/components/structured-data.tsx');
const seo = load('src/lib/seo.ts', {'@/lib/content': {siteConfig}});
function page() {
  return load(routePath, {
    'next/link': ({children, ...props}) => createElement('a', props, children),
    'next/image': props => { const copy = {...props}; delete copy.unoptimized; return createElement('img', copy); },
    '@/components/structured-data': structured,
    '@/components/reviewed-advisory-article.module.css': {__esModule: true, default: styles},
    '@/lib/content': {siteConfig}, '@/lib/seo': seo,
    '@/lib/vmware-vmsa-2026-0011-resource': data
  });
}
const normalize = value => value.replace(/\s+/g, ' ').trim();
const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
function find(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.childNodes || []) { const found = find(child, predicate); if (found) return found; }
}
function all(node, predicate) {
  return [...(predicate(node) ? [node] : []), ...(node.childNodes || []).flatMap(n => all(n, predicate))];
}
function text(node) {
  if (['script', 'style'].includes(node.tagName)) return '';
  return node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join(' ');
}
function rendered() {
  const route = page(), html = renderToStaticMarkup(createElement(route.default));
  const dom = parse(html), body = find(dom, n => n.tagName === 'article' && attr(n, 'data-vmware-guide') === article.externalId);
  assert.ok(body);
  return {route, html, dom, body, visible: normalize(text(body))};
}

test('local JSON preserves the exact frozen article bytes and all 23 CVEs', () => {
  assert.equal(hash(articleBytes), '2560ff42166e526a47ecb41a50bc179d878d5b74b96908e50f9264e513e0ff70');
  assert.equal(data.vmwareGuideContentSha256, hash(articleBytes));
  assert.equal(article.cves.length, 23);
  assert.equal(new Set(article.cves).size, 23);
  assert.equal(article.slug, 'vmware-vmsa-2026-0011-patching-guide');
  assert.equal(article.cvssScore, 9.8);
  assert.equal(article.sources.length, 5);
  assert.equal(Object.hasOwn(article, 'independentReview'), false);
  assert.equal(Object.hasOwn(article, 'nativeReconciliation'), false);
});
test('actual page markup preserves all authored client text outside schema/scripts', () => {
  const {visible} = rendered();
  const wanted = [article.title, article.summary, article.vendor, article.severity,
    ...article.cves, ...article.products, ...article.affectedVersions, ...article.fixedVersions,
    article.exploitationStatus, article.mechanism, article.affectedConditions, article.remediation,
    article.workaround, article.verification, article.recovery, ...article.limitations,
    ...article.definitions.flatMap(d => [d.term, d.definition]),
    ...article.sections.flatMap(s => [s.heading, s.body, ...s.bullets || []])];
  for (const value of wanted) assert.ok(visible.includes(normalize(value)), `Missing authored text: ${value.slice(0, 80)}`);
  assert.doesNotMatch(visible, /Codex|Halley|approvedadvisoryrelease|paid generation API|TAC approved|independently approved/i);
  assert.match(visible, /Maximum published CVSS 3\.1 score/);
  assert.match(visible, /individual CVEs range from 3\.4 to 9\.8/);
});
test('each grouped condition and exact pending/partial patch explanation remains in its own section', () => {
  const {body} = rendered();
  article.sections.forEach((section, i) => {
    const element = find(body, n => attr(n, 'id') === `vmware-section-${i}`);
    assert.ok(element);
    const visible = normalize(text(element));
    for (const value of [section.heading, section.body, ...section.bullets || []]) assert.ok(visible.includes(normalize(value)));
  });
  assert.ok(article.sections[3].bullets.some(s => s.includes('CVE-2026-123914') && s.includes('CVE-2026-123915') && s.includes('Patch Pending')));
  assert.ok(article.sections[6].bullets.some(s => s.includes('Do not mark Avi 31.x/CVE-2026-123926 resolved')));
});
test('all original vendor, Q&A, KB and KEV links appear as exact bibliography URLs', () => {
  const {body} = rendered();
  const sourceSection = find(body, n => attr(n, 'id') === 'sources');
  const links = all(sourceSection, n => n.tagName === 'a').map(n => attr(n, 'href'));
  assert.deepEqual(links, article.sources.map(s => s.url));
  for (const section of article.sections) for (const url of section.sourceUrls) assert.ok(links.includes(url));
});
test('metadata, schema, byline and calendar date use the resource canonical, not advisory ownership', () => {
  const {route, dom, visible} = rendered();
  const canonical = `${siteConfig.url}${data.vmwareGuidePath}`;
  assert.equal(route.dynamic, 'error');
  assert.equal(route.metadata.alternates.canonical, data.vmwareGuidePath);
  assert.equal(route.metadata.title.absolute, article.title);
  assert.equal(route.metadata.openGraph.publishedTime, publicationDate);
  assert.equal(route.metadata.openGraph.modifiedTime, publicationDate);
  assert.equal(route.metadata.openGraph.images[0].url, data.vmwareCardImage.src);
  const schemas = all(dom, n => n.tagName === 'script' && attr(n, 'type') === 'application/ld+json')
    .flatMap(n => JSON.parse(n.childNodes[0].value));
  const schema = schemas.find(s => s['@type'] === 'TechArticle');
  assert.equal(schema.mainEntityOfPage, canonical);
  assert.equal(schema.url, canonical);
  assert.equal(schema.datePublished, publicationDate);
  assert.equal(schema.dateModified, publicationDate);
  assert.deepEqual(schema.author, {'@type': 'Organization', name: siteConfig.name, url: siteConfig.url});
  assert.deepEqual(schema.publisher, schema.author);
  assert.deepEqual(schema.citation, article.sources.map(s => s.url));
  assert.deepEqual(schema.about.slice(0, 23), article.cves);
  assert.match(visible, /QCS published 25 November 2026/);
  assert.match(visible, /Vendor disclosure 24 November 2026/);
});
test('publication is a fixed calendar date with no environment or runtime-clock dependency', () => {
  const loaded = resource();
  assert.equal(loaded.vmwareResource.publishedAt, publicationDate);
  assert.equal(loaded.vmwareResource.updatedAt, publicationDate);
  const source = fs.readFileSync(path.join(root, modulePath), 'utf8');
  assert.doesNotMatch(source, /process\s*\.|\bDate\b|\bIntl\b|NEXT_PUBLIC_/);
});
test('resource-card merging adds one entry and never changes or replaces an older record', () => {
  const prior = {...data.vmwareResource, slug: 'existing-resource', title: 'Keep original', publishedAt: '2026-10-01'};
  const input = [prior], merged = data.withVmwareResource(input);
  assert.equal(input.length, 1); assert.strictEqual(input[0], prior);
  assert.equal(merged.length, 2); assert.strictEqual(merged.find(p => p.slug === prior.slug), prior);
  assert.equal(merged[0].slug, article.slug);
  assert.equal(data.withVmwareResource(merged).length, 2);
  assert.throws(() => data.withVmwareResource([{...data.vmwareResource, title: 'Different owner'}]), /already has a different entry/);
});
test('all seven actual existing resource records retain their complete data and object identity', () => {
  const old = existingResources(), before = JSON.stringify(old);
  assert.equal(old.length, 7);
  const merged = data.withVmwareResource(old);
  assert.equal(merged.length, 8);
  assert.equal(JSON.stringify(old), before);
  for (const post of old) assert.strictEqual(merged.find(p => p.slug === post.slug), post);
  assert.equal(JSON.stringify(merged.filter(p => p.slug !== article.slug).sort((a, b) => old.indexOf(a) - old.indexOf(b))), before);
});
test('sitemap adds one static resource and preserves all earlier entries verbatim', () => {
  const old = existingResources(), before = JSON.stringify(old);
  const loaded = load('src/app/resources/sitemap.ts', {
    '@/lib/content': {siteConfig}, '@/lib/website-only-resources': {websiteOnlyResources: old},
    '@/lib/vmware-vmsa-2026-0011-resource': data
  });
  const result = loaded.default();
  assert.equal(loaded.dynamic, 'error');
  assert.equal(result.length, 8);
  assert.deepEqual(JSON.parse(JSON.stringify(result.slice(0, 7))), Array.from(old, post => ({
    url: `${siteConfig.url}/resources/${post.slug}`, lastModified: post.updatedAt, images: [`${siteConfig.url}${post.image}`]
  })));
  assert.equal(JSON.stringify(old), before);
  assert.equal(result[7].url, `${siteConfig.url}${data.vmwareGuidePath}`);
  assert.equal(result[7].lastModified, publicationDate);
  assert.equal(result.filter(e => e.url === `${siteConfig.url}${data.vmwareGuidePath}`).length, 1);
});
test('the two copied PNGs keep the exact media-v2 bytes and dimensions', () => {
  for (const [name, digest, dimensions] of [
    ['diagram', 'aefd3f2d35be4167dd1d7c285a5cab2a4c327e9dbd0fd09cff30e091e34eff0f', [1080, 1440]],
    ['linkedin', 'bcc38c4571965a9994005d125fde18d6cca09a5fe98bef3ba9bb3cd331c3d99a', [1200, 1200]]
  ]) {
    const bytes = fs.readFileSync(path.join(root, `public/images/editorial/vmware-vmsa-2026-0011-${name}.png`));
    assert.equal(hash(bytes), digest);
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)], dimensions);
  }
  const {body} = rendered(), image = find(body, n => n.tagName === 'img');
  assert.equal(attr(image, 'src'), data.vmwareDiagram.src);
  assert.equal(attr(image, 'alt'), data.vmwareDiagram.alt);
  assert.equal(attr(image, 'width'), '1080'); assert.equal(attr(image, 'height'), '1440');
});
test('static route/module imports cannot reach database, queue, generation or advisory release code', () => {
  const allowed = new Set(['next/image', 'next/link', 'lucide-react', '@/components/structured-data',
    '@/components/reviewed-advisory-article.module.css', '@/lib/content', '@/lib/seo',
    '@/lib/vmware-vmsa-2026-0011-resource', '../content/website-only/vmware-vmsa-2026-0011.json']);
  for (const relative of [routePath, modulePath]) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    const ast = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true, relative.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    for (const item of ast.statements.filter(ts.isImportDeclaration)) {
      if (item.importClause?.isTypeOnly) continue;
      assert.ok(allowed.has(item.moduleSpecifier.text), item.moduleSpecifier.text);
    }
    assert.doesNotMatch(source, /ApprovedAdvisoryRelease|automated-advisory|ems-recovery|\bfetch\s*\(|getPrisma|getPool|socialPublication|new Date\(\)/);
  }
});
test('normal Vercel config, normal preflight and shared theme remain byte-identical', () => {
  for (const [relative, expected] of [
    ['vercel.json', 'eb68efc06e9270f3922c0145985a9bc483bdc1d5921aa420a19aada6764c15a4'],
    ['scripts/verifygrid-production-preflight.mjs', 'e96e58a040ec87e5a74ee063afd1462e94819fa626425b425bd9b19e1e76dc4e'],
    ['src/components/reviewed-advisory-article.module.css', '983d361e3a0fc6e2123036f1eb669247e72172d104acab9dfb0d01d3675fc1f5']
  ]) assert.equal(hash(fs.readFileSync(path.join(root, relative))), expected);
  assert.equal(fs.existsSync(path.join(root, 'src/lib/ems-recovery-resource.ts')), false);
});
