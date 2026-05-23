import fs from 'fs';
const f = 'public/guide/aliexpress-osusume.html';
let c = fs.readFileSync(f, 'utf8');
c = c.replace('href="/basics/">基礎知識', 'href="/guide/">ガイド');
fs.writeFileSync(f, c, 'utf8');
console.log('done');
