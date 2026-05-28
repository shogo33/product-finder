import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rawDir = path.join(__dirname, '../public/x-data/raw');

const files = [
  { src: path.join(rawDir, 'FireShot Capture 134 - _N100_ - 検索 _ X - [x.com].png'), dir: '../public/x-data/split-134' },
  { src: path.join(rawDir, 'FireShot Capture 135 - _GMKtec N100 - 検索 _ X - [x.com].png'), dir: '../public/x-data/split-135' },
  { src: path.join(rawDir, 'FireShot Capture 136 - _Beelink N100_ - 検索 _ X - [x.com].png'), dir: '../public/x-data/split-136' }
];

const sliceH = 1500;

for (const f of files) {
  const outDir = path.resolve(__dirname, f.dir);
  fs.mkdirSync(outDir, { recursive: true });
  const meta = await sharp(f.src).metadata();
  const { width: W, height: H } = meta;
  const parts = Math.ceil(H / sliceH);
  for (let i = 0; i < parts; i++) {
    const top = i * sliceH;
    const h = Math.min(sliceH, H - top);
    const out = path.join(outDir, `part${String(i + 1).padStart(2, '0')}.png`);
    await sharp(f.src).extract({ left: 0, top, width: W, height: h }).toFile(out);
  }
  console.log(`${path.basename(outDir)}: ${parts} parts (${W}x${H})`);
}
