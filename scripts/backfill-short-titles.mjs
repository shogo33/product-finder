/**
 * 既存の data/products.json に title_short を一括生成するバックフィルスクリプト
 * 使い方: node scripts/backfill-short-titles.mjs
 */

import dotenv from 'dotenv';
dotenv.config({ override: true });
import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;
const DATA_FILE  = path.resolve('data/products.json');

const client = new Anthropic({ apiKey: CLAUDE_KEY });

async function generateShortTitle(title) {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 60,
    messages: [{
      role: 'user',
      content: `以下のAliExpress商品名を、日本語で20文字以内の簡潔な商品名に変換してください。
ブランド名・製品番号があれば残し、スペック詳細・色・個数などは省略してください。
商品名だけを出力し、説明や記号は一切不要です。

商品名: ${title}`
    }]
  });
  return msg.content[0].text.trim();
}

const products = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
const targets  = products.filter(p => !p.title_short);

console.log(`\n📝 title_short が未設定の商品: ${targets.length}件\n`);

if (!targets.length) {
  console.log('✅ すべての商品に title_short が設定済みです');
  process.exit(0);
}

let count = 0;
for (const p of targets) {
  process.stdout.write(`[${++count}/${targets.length}] ${p.title.slice(0, 40)}...`);
  p.title_short = await generateShortTitle(p.title);
  console.log(` → ${p.title_short}`);
  await new Promise(r => setTimeout(r, 200));
}

fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2), 'utf8');
console.log(`\n✅ ${targets.length}件の title_short を生成しました`);
