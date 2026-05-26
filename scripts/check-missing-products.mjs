import fs from 'fs';
import path from 'path';

const files = [
  'public/gadget/ugreen-gan-charger-osusume.html',
  'public/gadget/ugreen-mouse-osusume.html',
  'public/gadget/ugreen-wifi-osusume.html',
  'public/game/anbernic-rg35xx-h-osusume.html',
  'public/game/gamesir-controller-osusume.html',
  'public/game/retroid-pocket5-osusume.html',
  'public/game/sf3000-game-osusume.html',
];

const NON_PROD = ['比較','選び方','よくある','まとめ','アリエクで','ポイント','ガイド','の使い方','レビューまとめ','仕組み','方法','注意','確認','安全','チェック','セール','番外'];

for (const f of files) {
  const content = fs.readFileSync(f, 'utf8');
  const h2Pattern = /<h2 id="(sec-(\d+))">([\s\S]*?)<\/h2>/g;
  const issues = [];
  let m;
  while ((m = h2Pattern.exec(content)) !== null) {
    const num = parseInt(m[2]);
    const heading = m[3].replace(/<[^>]+>/g, '').trim();
    if (num === 1) continue;
    if (NON_PROD.some(k => heading.includes(k))) continue;

    const pos = m.index;
    const nextSecPos = content.indexOf('<h2 id=', pos + 10);
    const chunk = nextSecPos > 0 ? content.slice(pos, nextSecPos) : content.slice(pos, pos + 3000);
    if (!chunk.includes('@product-start')) {
      issues.push(`  ❌ ${m[1]}: ${heading.slice(0, 70)}`);
    }
  }

  if (issues.length) {
    console.log(`=== ${path.basename(f)} ===`);
    issues.forEach(x => console.log(x));
  } else {
    console.log(`✅ ${path.basename(f)}`);
  }
}
