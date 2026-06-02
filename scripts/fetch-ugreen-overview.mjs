import fs from 'node:fs';

const FILE = 'data/ugreen/ugreen-jp-products-enriched.json';
const DELAY_MS = 600;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

function extractOverview(html) {
  const start = html.indexOf('<div class="ug-product-overview');
  if (start < 0) return [];
  const end = html.indexOf('</div>\n</div>\n<style>', start);
  const region = html.slice(start, end > start ? end : start + 30000);

  const items = [];
  const itemRe = /<div class="item">([\s\S]*?)<\/div>\s*<\/div>/g;
  let m;
  while ((m = itemRe.exec(region)) !== null) {
    const block = m[1];
    const h3 = block.match(/<h3>([\s\S]*?)<\/h3>/);
    const p = block.match(/<p>([\s\S]*?)<\/p>/);
    const img = block.match(/<img[^>]+src="([^"]+)"/);
    if (!h3 && !p) continue;
    const imgUrl = img ? (img[1].startsWith('//') ? 'https:' + img[1] : img[1]) : '';
    items.push({
      heading: h3 ? stripTags(h3[1]) : '',
      body: p ? stripTags(p[1]) : '',
      image: imgUrl,
    });
  }
  return items;
}

async function main() {
  const products = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  console.log(`Processing ${products.length} products...`);

  let withOverview = 0;
  let empty = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prefix = `[${i + 1}/${products.length}]`;
    try {
      const html = await fetchHtml(p.url);
      const overview = extractOverview(html);
      p.overview = overview;
      if (overview.length > 0) {
        console.log(`${prefix} ${overview.length} items  ${p.handle}`);
        withOverview++;
      } else {
        console.log(`${prefix} (empty)    ${p.handle}`);
        empty++;
      }
    } catch (e) {
      console.log(`${prefix} FAIL       ${p.handle} (${e.message})`);
      failed++;
    }
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(FILE, JSON.stringify(products, null, 2) + '\n');
  console.log(`\nDone. withOverview=${withOverview}, empty=${empty}, failed=${failed}`);
}

main();
