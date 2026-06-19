import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import * as cheerio from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');
const DATA = join(ROOT, 'data');
const DIST = join(ROOT, 'dist');

const DEEP_LEARNING_SECTIONS = [
  { csvValue: 'Deep Learning 2020', heading: 'Deep Learning - 2020' },
  { csvValue: 'Deep Learning 2019', heading: 'Deep Learning - 2019' },
  { csvValue: 'Deep Learning 2018', heading: 'Deep Learning - 2018' },
  { csvValue: 'Deep Learning 2017', heading: 'Deep Learning - 2017' },
  { csvValue: 'Self Driving Cars', heading: 'Self Driving Cars' },
];

function readCsv(filename) {
  const content = readFileSync(join(DATA, filename), 'utf8');
  return parse(content, { columns: true, skip_empty_lines: true, relax_quotes: true });
}

function extractYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function youtubeEmbed(url, className = 'videocard w-video w-embed') {
  const id = extractYouTubeId(url);
  if (!id) return '';
  return `<div style="padding-top:56.25%" class="${className}"><iframe src="https://www.youtube.com/embed/${id}" scrolling="no" title="YouTube embed" frameborder="0" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen="true"></iframe></div>`;
}

function populateDynList($, $list, items, renderItem) {
  if (!$list.length) return;

  const $template = $list.find('.w-dyn-item').first().clone();
  $list.find('.w-dyn-item').remove();
  $list.find('.w-dyn-empty').remove();

  const $container = $list.find('.w-dyn-items');
  for (const item of items) {
    const $item = $template.clone();
    renderItem($item, item);
    $container.append($item);
  }
}

async function downloadImage(url, destDir) {
  if (!url) return url;
  mkdirSync(destDir, { recursive: true });
  const filename = basename(new URL(url).pathname);
  const localPath = join(destDir, filename);
  const relativePath = `images/cms/${filename}`;

  if (existsSync(localPath)) return relativePath;

  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const buffer = Buffer.from(await res.arrayBuffer());
    writeFileSync(localPath, buffer);
    return relativePath;
  } catch {
    return url;
  }
}

function fixAssetPaths(html, prefix = '') {
  return html
    .replace(/href="css\//g, `href="${prefix}css/`)
    .replace(/src="css\//g, `src="${prefix}css/`)
    .replace(/href="js\//g, `href="${prefix}js/`)
    .replace(/src="js\//g, `src="${prefix}js/`)
    .replace(/src="images\//g, `src="${prefix}images/`)
    .replace(/srcset="images\//g, `srcset="${prefix}images/`)
    .replace(/href="images\/favicon\.png"/g, `href="${prefix}images/favicon.png"`)
    .replace(/href="images\/webclip\.png"/g, `href="${prefix}images/webclip.png"`)
    .replace(/href="index\.html"/g, `href="${prefix}index.html"`)
    .replace(/href="deep-learning\.html"/g, `href="${prefix}deep-learning.html"`)
    .replace(/href="podcast\.html"/g, `href="${prefix}podcast.html"`)
    .replace(/href="research\.html"/g, `href="${prefix}research.html"`);
}

function applyCommonFixes(html, prefix = '') {
  html = fixAssetPaths(html, prefix);
  const $ = cheerio.load(html);

  $('a.navlinkssocial img[alt="Youtube"]').parent()
    .attr({ href: 'https://www.youtube.com/lexfridman', target: '_blank' });
  $('a.navlinkssocial img[alt="Twitter"]').parent()
    .attr({ href: 'https://twitter.com/LexFridman', target: '_blank' });

  $('a.buttondefault.w-button').filter((_, el) => $(el).text().trim() === 'HOME')
    .attr('href', `${prefix}index.html`);

  $('img.logoerror').parent('a').attr('href', `${prefix}index.html`);

  return $.html();
}

function writePage(filePath, html, prefix = '') {
  writeFileSync(filePath, applyCommonFixes(html, prefix));
}

async function buildResearch() {
  const rows = readCsv('Lex Fridman Research.csv');
  const html = readFileSync(join(SRC, 'research.html'), 'utf8');
  const $ = cheerio.load(html);

  const imageDir = join(DIST, 'images', 'cms');
  const items = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      thumbnail: await downloadImage(row.Thumbnal, imageDir),
    }))
  );

  populateDynList($, $('.w-dyn-list').first(), items, ($item, row) => {
    $item.find('img.w-dyn-bind-empty')
      .removeClass('w-dyn-bind-empty')
      .attr({ src: row.thumbnail, alt: row.Title });

    $item.find('.textcardtitleresearch')
      .removeClass('w-dyn-bind-empty')
      .text(row.Title);

    $item.find('.paragraphinline')
      .removeClass('w-dyn-bind-empty')
      .text(row.Summary);

    const $links = $item.find('.linkcard');
    if (row['Video Link']) {
      $links.filter(':contains("Video")').attr('href', row['Video Link']).attr('target', '_blank');
    } else {
      $links.filter(':contains("Video")').remove();
    }

    if (row['Paper Link']) {
      $links.filter(':contains("Paper")').attr('href', row['Paper Link']).attr('target', '_blank');
    }

    $item.find('.linkcardcitation').filter(':contains("Scholar")')
      .attr('href', row['Scholar Link'] || '#')
      .attr('target', '_blank');

    $item.find('.linkcardcitation').filter(':contains("BibTeX")')
      .attr('href', row['Paper Link'] || row['Scholar Link'] || '#')
      .attr('target', '_blank');
  });

  writePage(join(DIST, 'research.html'), $.html());
}

function buildPodcastList() {
  const rows = readCsv('Lex Fridman Sample Podcasts.csv');
  const html = readFileSync(join(SRC, 'podcast.html'), 'utf8');
  const $ = cheerio.load(html);

  populateDynList($, $('.w-dyn-list').first(), rows, ($item, row) => {
    $item.find('.videocard').replaceWith(youtubeEmbed(row['YouTube Video Link'], 'videocard w-video w-embed'));

    $item.find('.textcardtitle')
      .removeClass('w-dyn-bind-empty')
      .text(row['Podcast Title']);

    const $subtexts = $item.find('.textcardsubtext');
    $subtexts.eq(0).removeClass('w-dyn-bind-empty').text(row['Guest Name']);
    $subtexts.eq(1).removeClass('w-dyn-bind-empty').text(row['Guest Designation']);

    $item.find('.buttoncard')
      .attr('href', `podcast/${row.Slug}.html`);
  });

  writePage(join(DIST, 'podcast.html'), $.html());
}

function buildPodcastDetails() {
  const rows = readCsv('Lex Fridman Sample Podcasts.csv');
  const template = readFileSync(join(SRC, 'templates', 'podcast-detail.html'), 'utf8');
  const podcastDir = join(DIST, 'podcast');
  mkdirSync(podcastDir, { recursive: true });

  for (const row of rows) {
    const $ = cheerio.load(template);

    $('[class*="headingpodcastnumber"]').first()
      .removeClass('w-dyn-bind-empty')
      .text(`#${row['Episode Number']}`);

    $('.headingpage.w-dyn-bind-empty')
      .removeClass('w-dyn-bind-empty')
      .text(row['Podcast Title']);

    $('.textpodcastauthor')
      .removeClass('w-dyn-bind-empty')
      .text(row['Guest Name']);

    $('.textpodcastsubauthor')
      .removeClass('w-dyn-bind-empty')
      .text(row['Guest Designation']);

    $('.paragraphdefault.w-richtext')
      .removeClass('w-dyn-bind-empty')
      .html(row['Text Content']);

    $('.videopodcastfull')
      .replaceWith(youtubeEmbed(row['YouTube Video Link'], 'videopodcastfull w-video w-embed'));

    $('title').text(`${row['Podcast Title']} | Lex Fridman`);

    writePage(join(podcastDir, `${row.Slug}.html`), $.html(), '../');
  }
}

async function buildDeepLearning() {
  const rows = readCsv('Lex Fridman Deep Learning Videos.csv');
  const html = readFileSync(join(SRC, 'deep-learning.html'), 'utf8');
  const $ = cheerio.load(html);

  for (const section of DEEP_LEARNING_SECTIONS) {
    const sectionItems = rows.filter((row) => row['File Under'] === section.csvValue);
    const $heading = $(`.headingvideocategories`).filter((_, el) => $(el).text().trim() === section.heading);
    const $list = $heading.next('.collection-list-wrapper.w-dyn-list');

    populateDynList($, $list, sectionItems, ($item, row) => {
      $item.find('.videocard').replaceWith(
        youtubeEmbed(row['Youtube Video Link'], 'videocard w-video w-embed')
      );

      $item.find('.textcardtitle')
        .removeClass('w-dyn-bind-empty')
        .text(row.Name);

      const $subtexts = $item.find('.textcardsubtext');
      $subtexts.eq(0).removeClass('w-dyn-bind-empty').text(row['Credited to']);
      $subtexts.eq(1).removeClass('w-dyn-bind-empty').text(row.Tags);

      const $slidesBtn = $item.find('.buttoncard.slides');
      if (row['Slides Link']) {
        $slidesBtn.attr('href', row['Slides Link']).attr('target', '_blank');
      } else {
        $slidesBtn.remove();
      }

      $item.find('.buttoncard.video')
        .attr('href', row['Youtube Video Link'])
        .attr('target', '_blank');
    });
  }

  writePage(join(DIST, 'deep-learning.html'), $.html());
}

function copyStaticAssets() {
  if (existsSync(DIST)) rmSync(DIST, { recursive: true });
  mkdirSync(DIST, { recursive: true });

  cpSync(join(SRC, 'css'), join(DIST, 'css'), { recursive: true });
  cpSync(join(SRC, 'js'), join(DIST, 'js'), { recursive: true });
  cpSync(join(SRC, 'images'), join(DIST, 'images'), { recursive: true });
  cpSync(join(SRC, 'index.html'), join(DIST, 'index.html'));
  cpSync(join(SRC, '404.html'), join(DIST, '404.html'));

  for (const page of ['index.html', '404.html']) {
    const html = readFileSync(join(DIST, page), 'utf8');
    writePage(join(DIST, page), html);
  }
}

async function main() {
  copyStaticAssets();
  await buildResearch();
  buildPodcastList();
  buildPodcastDetails();
  await buildDeepLearning();
  console.log(`Build complete → ${DIST}`);
  console.log('Run: npm run dev');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
