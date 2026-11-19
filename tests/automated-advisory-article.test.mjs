import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parse } from 'parse5';

const require = createRequire(import.meta.url);
// Compile the actual modules with local dependencies, as in the existing UI harness.
async function loadModule(file, mocks = {}) {
  const url = new URL(`../${file}`, import.meta.url);
  const compiled = await transform(await readFile(url, 'utf8'), { loader: 'tsx', format: 'cjs', jsx: 'automatic', sourcefile: file });
  const compiledModule = { exports: {} };
  vm.runInNewContext(compiled.code, {
    module: compiledModule, exports: compiledModule.exports, process, URL, Buffer, structuredClone,
    require: id => Object.hasOwn(mocks, id) ? mocks[id] : require(id)
  }, { filename: file, timeout: 1000 });
  return compiledModule.exports;
}
const siteConfig = { name: 'QuantumCrafters Studio Pvt. Ltd.', url: 'https://www.qcsstudio.com' };
const candidateSha256 = 'a'.repeat(64);
const sourceUrl = 'https://vendor.example/security/QCS-42?product=edge&version=4#conditions';
const fixture = {
  releaseId: 'prospective-only', slug: 'vendor-edge-advisory', title: 'Vendor Edge request handling vulnerability',
  summary: 'A malformed management request can interrupt the affected edge service.', vendor: 'Example Vendor',
  mechanism: 'An authenticated request reaches an unsafe parser.\n\nThe management process can restart.',
  affectedConditions: 'The management interface must be reachable and the affected feature enabled.',
  products: ['Example Edge'], affectedVersions: ['4.0 through 4.2'], fixedVersions: ['4.3'],
  remediation: 'Back up the configuration, then upgrade to 4.3 in an approved change window.',
  workaround: null, verification: 'Compare the running release with 4.3 and retest management access and service health.',
  recovery: 'Restore the recorded configuration and validate routing if the change fails.',
  limitations: ['Documentation is not evidence of testing on your appliance.'],
  definitions: [{ term: 'Management plane', definition: 'The services used to administer the device.' }],
  sections: [{ heading: 'Exposure boundary', body: 'Restrict access to trusted operators.\n\nRecord the approved access path.', bullets: ['Confirm the service owner.'], sourceUrls: [sourceUrl] }],
  cves: ['CVE-2099-1234'], severity: 'high', cvssScore: 8.1, exploitationStatus: 'No exploitation confirmed in this snapshot.',
  sources: [{ url: sourceUrl, bodySha256: 'b'.repeat(64) }],
  assets: [
    { key: 'diagram', path: `/automated-advisories/prospective-only/${'c'.repeat(64)}.svg`, sha256: 'c'.repeat(64), bytes: 400, mimeType: 'image/svg+xml', width: 1600, height: 900, alt: 'A management client reaches the enabled parser; upgrade to 4.3 and retest the service.' },
    { key: 'linkedin', path: `/automated-advisories/prospective-only/${'d'.repeat(64)}.jpg`, sha256: 'd'.repeat(64), bytes: 500, mimeType: 'image/jpeg', width: 1200, height: 630, alt: 'Affected management path and the fixed release 4.3.' },
    { key: 'reel', path: `/automated-advisories/prospective-only/${'e'.repeat(64)}.mp4`, sha256: 'e'.repeat(64), bytes: 600, mimeType: 'video/mp4', width: 1080, height: 1920, alt: 'Service remediation sequence.' }
  ],
  independentReview: { candidateSha256, reviewer: 'PRIVATE REVIEW ID' },
  vendorPublishedAt: '2026-11-18T10:00:00Z', vendorUpdatedAt: '2026-11-18T11:00:00Z'
};
const assetUrl = asset => new URL(asset.path, siteConfig.url).href;
const domain = { automatedAssetUrl: assetUrl, automatedCandidateHash: () => candidateSha256 };
const structuredData = await loadModule('src/components/structured-data.tsx');
const styles = new Proxy({}, { get: (_target, key) => String(key) });
const link = ({ children, ...props }) => createElement('a', props, children);
const image = props => {
  const attributes = { ...props };
  delete attributes.unoptimized;
  delete attributes.priority;
  return createElement('img', attributes);
};
const { AutomatedAdvisoryArticle } = await loadModule('src/components/automated-advisory-article.tsx', {
  'next/link': link, 'next/image': image, './structured-data': structuredData,
  '@/lib/content': { siteConfig }, '@/lib/automated-advisory-domain': domain,
  './reviewed-advisory-article.module.css': { __esModule: true, default: styles }
});
const canonical = `${siteConfig.url}/security-advisories/${fixture.slug}`;
const publishedAt = '2026-11-19T12:00:00Z', modifiedAt = '2026-11-19T13:00:00Z';
const render = (release = fixture) => renderToStaticMarkup(createElement(AutomatedAdvisoryArticle, { release, canonical, publishedAt, modifiedAt }));

async function artwork(marker,legacy=false){
 const item={id:'fixture-auto',status:'published',updatedAt:new Date(publishedAt),revisions:[{version:1}]};
 const row={id:item.id,slug:fixture.slug,contentHash:candidateSha256,editorialTrace:marker===undefined?{}:{automatedAdvisory:marker}};
 const client={securityAdvisory:{findMany:async query=>{assert.equal(query.select.editorialTrace,true);return [row];}},editorialImage:{findMany:async()=>legacy?[{id:'legacy-image',contentType:'security_advisory',contentId:item.id,contentRevision:'1',altText:'Legacy crop',generatedAt:new Date(publishedAt)}]:[]}};
 const loaded=await loadModule('src/lib/advisory-image-availability.ts',{'./prisma.ts':{getPrismaClient:()=>client},'./editorial-static-media.ts':{staticMediaImageIds:[],staticEditorialEntry:()=>null},'./automated-advisory-domain.ts':{...domain,getAutomatedReleases:()=>[fixture]}});
 return (await loaded.readyAdvisoryImages([item])).get(item.id);
}
test('automatic artwork requires the same exact DB marker as article binding',async()=>{
 for(const marker of [undefined,null,[],{releaseId:'wrong',candidateSha256},{releaseId:fixture.releaseId,candidateSha256:'wrong'}])assert.equal(await artwork(marker),undefined);
 assert.equal((await artwork({releaseId:fixture.releaseId,candidateSha256})).url,assetUrl(fixture.assets[0]));
});
test('legacy image metadata cannot replace an exact reviewed automatic diagram',async()=>{
 const result=await artwork({releaseId:fixture.releaseId,candidateSha256},true);
 assert.equal(result.url,assetUrl(fixture.assets[0]));assert.equal(result.altText,fixture.assets[0].alt);
});
function nodes(node) { return [node, ...(node.childNodes || []).flatMap(nodes)]; }
function attribute(node, name) { return node.attrs?.find(item => item.name === name)?.value; }
function text(node) { return node.nodeName === '#text' ? node.value : (node.childNodes || []).map(text).join(' '); }

test('article renders every approved explanation and original URL without mutating the release', () => {
  const before = JSON.stringify(fixture);
  const all = nodes(parse(render()));
  const article = all.find(node => node.tagName === 'article');
  const visible = text(article).replace(/\s+/g, ' ');
  for (const value of [fixture.title, fixture.summary, fixture.mechanism, fixture.affectedConditions, fixture.remediation, fixture.verification, fixture.recovery, ...fixture.limitations, ...fixture.products, ...fixture.affectedVersions, ...fixture.fixedVersions, ...fixture.cves, fixture.severity, fixture.exploitationStatus, fixture.definitions[0].term, fixture.definitions[0].definition, fixture.sections[0].heading, fixture.sections[0].body, ...fixture.sections[0].bullets]) {
    assert.ok(visible.includes(value.replace(/\s+/g, ' ')), value);
  }
  assert.ok(visible.includes(siteConfig.name));
  assert.ok(visible.includes('No workaround is specified'));
  assert.ok(visible.includes('8.1'));
  const links = all.filter(node => node.tagName === 'a');
  assert.equal(links.filter(node => attribute(node, 'href') === sourceUrl).length, 2);
  assert.equal(links.some(node => attribute(node, 'href')?.includes('utm_source')), false);
  for (const anchor of links.filter(node => attribute(node, 'href')?.startsWith('#'))) {
    assert.ok(all.some(node => attribute(node, 'id') === attribute(anchor, 'href').slice(1)));
  }
  assert.doesNotMatch(visible, /PRIVATE REVIEW ID|candidateSha256|independent.review|reviewed by|TAC|generated by|artificial intelligence/i);
  assert.equal(JSON.stringify(fixture), before);
});

test('contextual diagram uses its own dimensions and full label, not a social crop or paid image', async () => {
  const all = nodes(parse(render()));
  const images = all.filter(node => node.tagName === 'img');
  assert.equal(images.length, 1);
  assert.equal(attribute(images[0], 'src'), assetUrl(fixture.assets[0]));
  assert.equal(attribute(images[0], 'width'), '1600');
  assert.equal(attribute(images[0], 'height'), '900');
  assert.equal(attribute(images[0], 'alt'), fixture.assets[0].alt);
  assert.equal(text(all.find(node => node.tagName === 'figcaption')), fixture.assets[0].alt);
  const css = await readFile(new URL('../src/components/reviewed-advisory-article.module.css', import.meta.url), 'utf8');
  assert.match(css, /\.diagram img\{[^}]*width:100%;height:auto/);
});

test('structured data credits only QCS and carries absolute image metadata and original citations', () => {
  const script = nodes(parse(render())).find(node => node.tagName === 'script');
  const data = JSON.parse(text(script));
  assert.deepEqual(data.author, { '@type': 'Organization', name: siteConfig.name, url: siteConfig.url });
  assert.deepEqual(data.publisher, data.author);
  assert.equal(data.isAccessibleForFree, true);
  assert.equal(data.mainEntityOfPage, canonical);
  assert.equal(data.datePublished, publishedAt);
  assert.equal(data.dateModified, modifiedAt);
  assert.deepEqual(data.citation, [sourceUrl]);
  assert.deepEqual(data.image, { '@type': 'ImageObject', url: assetUrl(fixture.assets[0]), width: 1600, height: 900, caption: fixture.assets[0].alt });
});

test('workaround, unrated CVSS, empty optional sections and literal prose render without fabricated claims', () => {
  const release = structuredClone(fixture);
  release.workaround = 'Restrict the management interface to the documented allowlist.';
  release.cvssScore = null;
  release.definitions = [];
  release.sections = [];
  release.summary = '<script>alert("not markup")</script>';
  const all = nodes(parse(render(release)));
  const visible = text(all.find(node => node.tagName === 'article'));
  assert.ok(visible.includes(release.summary));
  assert.ok(visible.includes(release.workaround));
  assert.ok(visible.includes('Not supplied'));
  assert.equal(all.filter(node => node.tagName === 'script').length, 1);
  assert.equal(all.some(node => attribute(node, 'href') === '#terms'), false);
});

const readCache = await loadModule('src/lib/public-read-cache.ts');
async function readerFor(initial, release = fixture) {
  const state = { row: structuredClone(initial), queries: [], lookups: [] };
  const read = readCache.createPublicReadCache();
  const db = { securityAdvisory: { findFirst: async query => {
    state.queries.push(query);
    return state.row ? Object.fromEntries(Object.keys(query.select).map(key => [key, state.row[key]])) : null;
  } } };
  const { publicAdvisoryBySlug } = await loadModule('src/lib/public-advisory-reader.ts', {
    './prisma.ts': { getPrismaClient: () => db },
    './public-read-cache.ts': { readPublicSnapshot: (scope, gate, load) => readCache.readPublicSnapshot(scope, gate, load, read) },
    './reviewed-advisory-domain.ts': { isReviewedAdvisoryIdentity: ({ slug }) => slug === 'cisco-existing', reviewedEnvelope: payload => payload?.reviewedGuide ?? null },
    './automated-advisory-domain.ts': { ...domain, automatedReleaseBySlug: slug => { state.lookups.push(slug); return release; } }
  });
  state.read = (slug = state.row?.slug || fixture.slug) => publicAdvisoryBySlug(slug);
  return state;
}
const baseRow = () => ({
  id: 'prospective-row', slug: fixture.slug, title: 'Database title', summary: 'Database summary', vendor: fixture.vendor,
  status: 'published', contentHash: candidateSha256,
  editorialTrace: { automatedAdvisory: { releaseId: fixture.releaseId, candidateSha256 } },
  firstSeenAt: new Date(publishedAt), updatedAt: new Date(modifiedAt), source: { name: 'Vendor', officialHost: 'vendor.example', lastSuccessAt: new Date(modifiedAt) },
  revisions: [{ version: 1, createdAt: new Date(modifiedAt) }]
});

test('only the exact published slug, trace identity and candidate hashes attach automaticRelease', async () => {
  const reader = await readerFor(baseRow());
  const result = await reader.read();
  assert.equal(result.automaticRelease, fixture);
  assert.equal(result.reviewedRelease, null);
  assert.deepEqual(reader.lookups, [fixture.slug]);
  for (const query of reader.queries) {
    assert.equal(query.select.contentHash, true);
    assert.equal(query.select.editorialTrace, true);
    assert.notEqual(query.select.revisions.select.payload, true);
    assert.equal(query.select.revisions.select.version, true);
  }
});

for (const [name, change, release] of [
  ['release ID mismatch', row => { row.editorialTrace.automatedAdvisory.releaseId = 'different'; }],
  ['trace candidate mismatch', row => { row.editorialTrace.automatedAdvisory.candidateSha256 = 'f'.repeat(64); }],
  ['missing trace candidate', row => { delete row.editorialTrace.automatedAdvisory.candidateSha256; }],
  ['row hash mismatch', row => { row.contentHash = 'f'.repeat(64); }],
  ['withdrawal', row => { row.status = 'withdrawn'; }],
  ['draft', row => { row.status = 'draft'; }],
  ['null marker', row => { row.editorialTrace.automatedAdvisory = null; }],
  ['array marker', row => { row.editorialTrace.automatedAdvisory = []; }],
  ['unknown catalog release', () => {}, null],
  ['another catalog slug', () => {}, { ...fixture, slug: 'different-slug' }]
]) test(`marked records fail closed on ${name}`, async () => {
  const row = baseRow();
  change(row);
  const reader = await readerFor(row, release === undefined ? fixture : release);
  assert.equal(await reader.read(), null);
});

test('catalog alone cannot replace an existing unmarked post or read its revision payload', async () => {
  for (const editorialTrace of [null, {}, { unrelated: 'preserve' }, [], 'legacy']) {
    const reader = await readerFor({ ...baseRow(), editorialTrace });
    const result = await reader.read();
    assert.equal(result.title, 'Database title');
    assert.equal(result.automaticRelease, null);
    assert.equal(result.reviewedRelease, null);
    assert.deepEqual(reader.lookups, []);
  }
});

test('existing Cisco release still uses its own reviewed envelope and payload select', async () => {
  const reviewed = { releaseId: 'existing-reviewed-release' };
  const reader = await readerFor({ ...baseRow(), slug: 'cisco-existing', editorialTrace: {}, revisions: [{ version: 4, createdAt: new Date(modifiedAt), payload: { reviewedGuide: reviewed } }] });
  const result = await reader.read();
  assert.deepEqual(result.reviewedRelease, reviewed);
  assert.equal(result.automaticRelease, null);
  assert.equal(reader.queries.find(query => query.select.slug).select.revisions.select.payload, true);
});

test('hash and trace changes invalidate a cached release even when updatedAt did not change', async () => {
  const reader = await readerFor(baseRow());
  assert.ok((await reader.read()).automaticRelease);
  reader.row.contentHash = 'f'.repeat(64);
  assert.equal(await reader.read(), null);
  reader.row.contentHash = candidateSha256;
  reader.row.editorialTrace.automatedAdvisory.releaseId = 'replaced';
  assert.equal(await reader.read(), null);
});

const seo = await loadModule('src/lib/seo.ts', { '@/lib/content': { siteConfig } });
async function pageFor(advisory, artwork) {
  let artworkReads = 0;
  const route = await loadModule('src/app/security-advisories/[slug]/page.tsx', {
    react: { ...require('react'), cache: fn => fn }, 'next/image': image, 'next/link': link,
    'next/navigation': { notFound: () => { throw new Error('NOT_FOUND'); } },
    '@/components/structured-data': structuredData, '@/lib/content': { siteConfig }, '@/lib/seo': seo,
    '@/lib/advisories': { getSecurityAdvisory: async () => advisory },
    '@/lib/advisory-image-availability': { readyAdvisoryImages: async () => { artworkReads++; return new Map(artwork ? [[advisory.id, artwork]] : []); } },
    '@/lib/section-availability': { loadSection: async (_name, load) => ({ data: await load() }) },
    '@/components/reviewed-advisory-article': { ReviewedAdvisoryArticle: () => null },
    '@/components/automated-advisory-article': { AutomatedAdvisoryArticle },
    '@/lib/reviewed-advisory-domain': { guideAsset: () => `${siteConfig.url}/existing-overview.png` },
    '@/lib/automated-advisory-domain': domain
  });
  return { ...route, artworkReads: () => artworkReads };
}
const props = { params: Promise.resolve({ slug: fixture.slug }) };

test('route selects the separate automatic article and exact absolute social metadata', async () => {
  const route = await pageFor({ ...baseRow(), automaticRelease: fixture, reviewedRelease: null });
  const page = await route.default(props);
  assert.equal(page.type, AutomatedAdvisoryArticle);
  assert.equal(page.props.canonical, canonical);
  const metadata = await route.generateMetadata(props);
  assert.equal(metadata.title, fixture.title);
  assert.equal(metadata.description, fixture.summary);
  assert.equal(metadata.alternates.canonical, canonical);
  assert.equal(metadata.openGraph.url, canonical);
  assert.deepEqual(JSON.parse(JSON.stringify(metadata.openGraph.images)), [{ url: assetUrl(fixture.assets[1]), width: 1200, height: 630, alt: fixture.assets[1].alt }]);
  assert.equal(metadata.twitter.images[0], assetUrl(fixture.assets[1]));
  assert.equal(route.artworkReads(), 0);
});

test('automatic metadata falls back only to the catalog diagram, never reel or unrelated artwork', async () => {
  const release = { ...fixture, assets: fixture.assets.filter(asset => asset.key !== 'linkedin') };
  const route = await pageFor({ ...baseRow(), automaticRelease: release, reviewedRelease: null });
  const metadata = await route.generateMetadata(props);
  assert.equal(metadata.openGraph.images[0].url, assetUrl(fixture.assets[0]));
  assert.equal(metadata.openGraph.images[0].width, 1600);
  assert.equal(metadata.openGraph.images[0].height, 900);
  assert.equal(route.artworkReads(), 0);
});

test('legacy metadata and no-artwork fallback remain unchanged', async () => {
  const advisory = { ...baseRow(), automaticRelease: null, reviewedRelease: null, cves: [], products: [] };
  const route = await pageFor(advisory, { url: '/artwork?variant=hero', altText: 'Existing artwork' });
  const metadata = await route.generateMetadata(props);
  assert.equal(metadata.alternates.canonical, `/security-advisories/${fixture.slug}`);
  assert.deepEqual(JSON.parse(JSON.stringify(metadata.openGraph.images)), [{ url: '/artwork?variant=social', width: 1200, height: 627, alt: 'Existing artwork' }]);
  const fallback = await (await pageFor(advisory)).generateMetadata(props);
  assert.equal(fallback.twitter.card, 'summary');
  assert.equal(fallback.openGraph.images.length, 0);
  assert.equal(fallback.twitter.images.length, 0);
});

test('unavailable records remain not found and publish no article metadata', async () => {
  const route = await pageFor(null);
  assert.equal(Object.keys(await route.generateMetadata(props)).length, 0);
  await assert.rejects(route.default(props), /NOT_FOUND/);
});
