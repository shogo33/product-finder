import fs from 'node:fs';
import path from 'node:path';

const PRODUCTS_FILE = 'data/ugreen/ugreen-jp-products-enriched.json';
const IMAGES_DIR = 'data/ugreen/ugreen-jp-images';
const DELAY_MS = 600;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
      'Accept': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function downloadImage(url, outPath) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  if (!res.ok) throw new Error(`download HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
}

function countLocalImages(dir) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f)).length;
}

async function main() {
  const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
  console.log(`Processing ${products.length} products...`);

  let skipped = 0;
  let downloaded = 0;
  let failed = 0;

  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const prefix = `[${i + 1}/${products.length}]`;
    const dir = path.join(IMAGES_DIR, p.handle);

    try {
      const data = await fetchJson(p.url + '.json');
      const images = data.product?.images || [];
      const localCount = countLocalImages(dir);

      if (images.length === 0) {
        console.log(`${prefix} no-imgs ${p.handle}`);
        skipped++;
        await sleep(DELAY_MS);
        continue;
      }

      if (localCount >= images.length) {
        console.log(`${prefix} ok      ${p.handle} (${localCount}/${images.length})`);
        skipped++;
        await sleep(DELAY_MS);
        continue;
      }

      fs.mkdirSync(dir, { recursive: true });
      for (let j = 0; j < images.length; j++) {
        const img = images[j];
        const num = String(j + 1).padStart(2, '0');
        const ext = (img.src.match(/\.(png|jpe?g|webp|gif)/i)?.[1] || 'png').toLowerCase();
        const outPath = path.join(dir, `${num}.${ext}`);
        if (fs.existsSync(outPath)) continue;
        await downloadImage(img.src, outPath);
        downloaded++;
      }
      console.log(`${prefix} DL      ${p.handle} (${images.length} images)`);
    } catch (e) {
      console.log(`${prefix} FAIL    ${p.handle} (${e.message})`);
      failed++;
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nDone. downloaded=${downloaded}, skipped=${skipped}, failed=${failed}`);
}

main();
