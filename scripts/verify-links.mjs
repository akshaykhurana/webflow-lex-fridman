import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, resolve, normalize } from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const BASE_URL = process.env.BASE_URL || 'http://localhost:58992';

function getAllHtmlFiles(dir, base = dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...getAllHtmlFiles(full, base));
    else if (entry.name.endsWith('.html')) files.push(full);
  }
  return files;
}

function resolveInternal(fromFile, href) {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) {
    return null;
  }
  if (href.startsWith('http://') || href.startsWith('https://')) return { type: 'external', href };

  const fromDir = dirname(fromFile);
  let target = normalize(resolve(fromDir, href.split('?')[0].split('#')[0]));

  // serve strips .html and serves clean URLs
  if (!existsSync(target) && !target.endsWith('.html')) {
    const withHtml = target + '.html';
    if (existsSync(withHtml)) target = withHtml;
  }
  if (!existsSync(target) && target.endsWith('.html')) {
    const withoutHtml = target.replace(/\.html$/, '');
    if (existsSync(withoutHtml) && !withoutHtml.endsWith('/')) {
      // directory index not used
    }
  }

  return { type: 'internal', href, target, exists: existsSync(target) };
}

async function checkHttp(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    return { url, status: res.status, ok: res.ok };
  } catch (err) {
    return { url, status: 0, ok: false, error: err.message };
  }
}

const htmlFiles = getAllHtmlFiles(DIST);
const internalIssues = [];
const externalLinks = new Set();
const pagesToHttpCheck = new Set();

for (const file of htmlFiles) {
  const rel = file.replace(DIST, '').replace(/^\//, '') || 'index.html';
  pagesToHttpCheck.add(`/${rel.replace(/index\.html$/, '').replace(/\.html$/, '') || ''}`.replace(/\/$/, '') || '/');

  const $ = cheerio.load(readFileSync(file, 'utf8'));

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    const resolved = resolveInternal(file, href);
    if (!resolved) return;
    if (resolved.type === 'external') {
      externalLinks.add(href);
      return;
    }
    if (!resolved.exists) {
      internalIssues.push({ page: rel, href, expected: resolved.target.replace(DIST, '') });
    }
  });

  $('img[src]').each((_, el) => {
    const src = $(el).attr('src');
    const resolved = resolveInternal(file, src);
    if (resolved?.type === 'internal' && !resolved.exists) {
      internalIssues.push({ page: rel, href: src, kind: 'img', expected: resolved.target.replace(DIST, '') });
    }
  });

  $('link[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href?.startsWith('http')) {
      const resolved = resolveInternal(file, href);
      if (resolved?.type === 'internal' && !resolved.exists) {
        internalIssues.push({ page: rel, href, kind: 'link', expected: resolved.target.replace(DIST, '') });
      }
    }
  });

  $('script[src]').each((_, el) => {
    const src = $(el).attr('src');
    if (!src?.startsWith('http')) {
      const resolved = resolveInternal(file, src);
      if (resolved?.type === 'internal' && !resolved.exists) {
        internalIssues.push({ page: rel, href: src, kind: 'script', expected: resolved.target.replace(DIST, '') });
      }
    }
  });
}

// Verify podcast list DETAILS links match files
const podcastList = readFileSync(join(DIST, 'podcast.html'), 'utf8');
const $pod = cheerio.load(podcastList);
const detailHrefs = [];
$pod('.buttoncard').each((_, el) => detailHrefs.push($pod(el).attr('href')));
const missingDetails = detailHrefs.filter((href) => {
  const target = resolve(DIST, href);
  return !existsSync(target);
});

// CMS content checks
const checks = {
  researchItems: cheerio.load(readFileSync(join(DIST, 'research.html'), 'utf8'))('.w-dyn-item').length,
  podcastItems: $pod('.w-dyn-item').length,
  deepLearningItems: cheerio.load(readFileSync(join(DIST, 'deep-learning.html'), 'utf8'))('.w-dyn-item').length,
  podcastDetailFiles: readdirSync(join(DIST, 'podcast')).filter((f) => f.endsWith('.html')).length,
  emptyStates: htmlFiles.filter((f) => readFileSync(f, 'utf8').includes('No items found')).map((f) => f.replace(DIST, '')),
  bindEmpty: htmlFiles.filter((f) => readFileSync(f, 'utf8').includes('w-dyn-bind-empty')).map((f) => f.replace(DIST, '')),
  hashLinks: htmlFiles.flatMap((f) => {
    const $ = cheerio.load(readFileSync(f, 'utf8'));
    const bad = [];
    $('a[href="#"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text && !['', 'Youtube', 'Twitter'].includes(text) && !$(el).hasClass('navlinkssocial')) {
        bad.push({ page: f.replace(DIST, ''), text, classes: $(el).attr('class') });
      }
    });
    return bad;
  }),
};

// HTTP checks for all pages
const httpChecks = [];
for (const page of [...pagesToHttpCheck].sort()) {
  const url = page === '/' ? BASE_URL : `${BASE_URL}${page}`;
  httpChecks.push(await checkHttp(url));
}

console.log('=== CMS Content ===');
console.log(`Research items: ${checks.researchItems} (expected 10)`);
console.log(`Podcast list items: ${checks.podcastItems} (expected 12)`);
console.log(`Deep learning items: ${checks.deepLearningItems} (expected 26)`);
console.log(`Podcast detail pages: ${checks.podcastDetailFiles} (expected 12)`);
console.log(`Detail links missing files: ${missingDetails.length}`);

console.log('\n=== Empty / Unpopulated ===');
console.log(`"No items found" pages: ${checks.emptyStates.length ? checks.emptyStates.join(', ') : 'none'}`);
console.log(`w-dyn-bind-empty pages: ${checks.bindEmpty.length ? checks.bindEmpty.join(', ') : 'none'}`);

console.log('\n=== Internal Link Issues ===');
if (internalIssues.length === 0) console.log('None');
else internalIssues.forEach((i) => console.log(`  ${i.page}: ${i.href} → missing (${i.expected})`));

console.log('\n=== Stub # Links (non-nav) ===');
const stubs = checks.hashLinks.filter((l) => !l.classes?.includes('navlinkssocial'));
if (stubs.length === 0) console.log('None');
else stubs.slice(0, 20).forEach((l) => console.log(`  ${l.page}: "${l.text}" (${l.classes})`));
if (stubs.length > 20) console.log(`  ... and ${stubs.length - 20} more`);

console.log('\n=== HTTP Page Checks ===');
const httpFails = httpChecks.filter((c) => !c.ok);
httpChecks.forEach((c) => console.log(`  ${c.status} ${c.url}`));
if (httpFails.length) console.log(`\nHTTP failures: ${httpFails.length}`);

console.log('\n=== External Links (unique count) ===');
console.log(`Total unique external URLs: ${externalLinks.size}`);

const allOk =
  checks.researchItems === 10 &&
  checks.podcastItems === 12 &&
  checks.deepLearningItems === 26 &&
  checks.podcastDetailFiles === 12 &&
  missingDetails.length === 0 &&
  internalIssues.length === 0 &&
  checks.emptyStates.length === 0 &&
  httpFails.length === 0;

process.exit(allOk ? 0 : 1);
