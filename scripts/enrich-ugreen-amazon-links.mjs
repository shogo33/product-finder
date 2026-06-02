import fs from 'node:fs';
import path from 'node:path';

const FILE = 'data/ugreen/ugreen-jp-products-enriched.json';
const DELAY_MS = 800;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extractAmazonLink(html) {
  const dpMatches = html.match(/https?:\/\/(?:www\.)?amazon\.co\.jp\/(?:[\w-%]+\/)?(?:dp|gp\/product)\/[A-Z0-9]{10}[^\s"'<>]*/gi) || [];
  if (dpMatches.length === 0) return null;
  const url = dpMatches[0];
  const m = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return m ? `https://www.amazon.co.jp/dp/${m[1]}` : url;
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'ja,en;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const products = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  console.log(`Processing ${products.length} products...`);

  let updated = 0;
  let kept = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prefix = `[${i + 1}/${products.length}]`;
    try {
      const html = await fetchPage(p.url);
      const amazonUrl = extractAmazonLink(html);
      if (amazonUrl) {
        const before = p.retailLinks?.amazon || '(none)';
        p.retailLinks = p.retailLinks || {};
        p.retailLinks.amazon = amazonUrl;
        if (before !== amazonUrl) {
          console.log(`${prefix} UPDATED ${p.title.slice(0, 40)} -> ${amazonUrl}`);
          updated++;
        } else {
          console.log(`${prefix} same    ${p.title.slice(0, 40)}`);
          kept++;
        }
      } else {
        console.log(`${prefix} no dp   ${p.title.slice(0, 40)} (kept existing)`);
        kept++;
      }
    } catch (e) {
      console.log(`${prefix} FAIL    ${p.title.slice(0, 40)} (${e.message})`);
      failed++;
    }
    await sleep(DELAY_MS);
  }

  fs.writeFileSync(FILE, JSON.stringify(products, null, 2) + '\n');
  console.log(`\nDone. updated=${updated}, kept=${kept}, failed=${failed}`);
}

main();
