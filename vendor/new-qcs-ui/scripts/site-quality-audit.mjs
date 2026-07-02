import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx']);
const readabilityFiles = [
  'src/container/network-support-services/NetworkSupportServicesPage.tsx',
  'src/data/networkSupportPage.ts',
];

const walk = (dir) => readdirSync(dir).flatMap((entry) => {
  const path = join(dir, entry);
  const stat = statSync(path);

  if (stat.isDirectory()) {
    return entry === 'node_modules' || entry === '.next' ? [] : walk(path);
  }

  return sourceExtensions.has(extname(path)) ? [path] : [];
});

const stripComments = (source) => source
  .replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
  .replace(/(^|\s)\/\/.*$/gm, '');

const wordCount = (text) => (text.match(/[A-Za-z0-9x+-]+/g) || []).length;

const imageIssues = [];
for (const file of walk('src')) {
  const source = stripComments(readFileSync(file, 'utf8'));
  const imageMatches = source.matchAll(/<img\b[^>]*>/gis);

  for (const match of imageMatches) {
    const tag = match[0];
    if (!/\balt=/.test(tag) || !/\bwidth=/.test(tag) || !/\bheight=/.test(tag)) {
      const line = source.slice(0, match.index).split('\n').length;
      imageIssues.push(`${file}:${line} ${tag.replace(/\s+/g, ' ').trim()}`);
    }
  }
}

const readabilityIssues = [];
for (const file of readabilityFiles) {
  const source = readFileSync(file, 'utf8');
  const textMatches = source.matchAll(/"([^"{}<>`]+)"|>([^<>]+)</g);

  for (const match of textMatches) {
    const chunk = (match[1] || match[2] || '').trim();
    const isCopy = chunk.length > 30
      && /[A-Za-z]/.test(chunk)
      && !chunk.includes('network-support')
      && !chunk.includes('cs_')
      && !chunk.includes('@/')
      && !chunk.startsWith('M18.');

    if (!isCopy) continue;

    for (const sentence of chunk.split(/(?<=[.!?])\s+/)) {
      const words = wordCount(sentence);
      if (words > 24) {
        readabilityIssues.push(`${file}: ${words} words — ${sentence}`);
      }
    }
  }
}

const readabilityScore = readabilityIssues.length === 0 ? 100 : Math.max(0, 100 - readabilityIssues.length * 10);
const retinaScore = imageIssues.length === 0 ? 100 : Math.max(0, 100 - imageIssues.length * 10);

console.log(`Network page reading score: ${readabilityScore}%`);
console.log(`Whole-site retina/image markup score: ${retinaScore}%`);
console.log(`Network readability long-sentence issues: ${readabilityIssues.length}`);
console.log(`Image markup best-practice issues: ${imageIssues.length}`);

if (readabilityIssues.length > 0) {
  console.error(readabilityIssues.join('\n'));
}

if (imageIssues.length > 0) {
  console.error(imageIssues.join('\n'));
}

process.exit(readabilityIssues.length === 0 && imageIssues.length === 0 ? 0 : 1);
