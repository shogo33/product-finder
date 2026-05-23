import fs from 'fs';
const f = 'public/basics/aliexpress-size.html';
let c = fs.readFileSync(f, 'utf8');
c = c.replace('<div class="tag">サイズ・買い方のコツ</div>', '<div class="tag">トラブル対策</div>');
fs.writeFileSync(f, c, 'utf8');
console.log('done');
