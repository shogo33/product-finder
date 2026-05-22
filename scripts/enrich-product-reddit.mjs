/**
 * enrich-product-reddit.mjs
 * 各商品のReddit実データを取得し、.callout を差し替える
 * 使い方: node scripts/enrich-product-reddit.mjs
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import { searchReddit } from './fetch-reddit-voices.mjs';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 商品ごとの検索設定 ────────────────────────────────────
const PRODUCT_SEARCHES = {
  'GameSir Cyclone Pro': [
    { subreddit: 'gamesir',        query: 'Cyclone Pro review' },
    { subreddit: 'NintendoSwitch', query: 'GameSir Cyclone Pro' },
  ],
  'GameSir T4 Mini': [
    { subreddit: 'gamesir',        query: 'T4 Mini review' },
    { subreddit: 'iosgaming',      query: 'GameSir T4 Mini' },
  ],
  'GameSir G7 SE': [
    { subreddit: 'gamesir',        query: 'G7 SE review hall effect' },
    { subreddit: 'xboxone',        query: 'GameSir G7 SE' },
  ],
  'GameSir X2s': [
    { subreddit: 'gamesir',        query: 'X2s review mobile gaming' },
    { subreddit: 'cloudygamer',    query: 'GameSir X2s' },
  ],
  'GameSir Nova Lite': [
    { subreddit: 'gamesir',        query: 'Nova Lite review switch' },
    { subreddit: 'NintendoSwitch', query: 'GameSir Nova Lite' },
  ],
  '8BitDo SN30 Pro': [
    { subreddit: 'NintendoSwitch', query: '8BitDo SN30 Pro review' },
    { subreddit: 'gaming',         query: '8BitDo SN30 Pro aliexpress' },
  ],
  '8BitDo Ultimate Controller': [
    { subreddit: 'NintendoSwitch', query: '8BitDo Ultimate Controller review' },
    { subreddit: 'gaming',         query: '8BitDo Ultimate 2C' },
  ],
  'Flydigi Vader 3 Pro': [
    { subreddit: 'gaming',         query: 'Flydigi Vader 3 Pro review' },
    { subreddit: 'pcgaming',       query: 'Flydigi Vader Pro aliexpress' },
  ],
};

// ── Reddit収集 ───────────────────────────────────────────
async function fetchProductPosts(productName) {
  const searches = PRODUCT_SEARCHES[productName] ?? [];
  const allPosts = [];

  for (const { subreddit, query } of searches) {
    try {
      console.log(`    🔍 r/${subreddit}: "${query}"`);
      const posts = await searchReddit(subreddit, query, { limit: 20, sort: 'relevance', t: 'year' });
      allPosts.push(...posts);
      await sleep(1000);
    } catch (e) {
      console.warn(`    ⚠️ 取得失敗: ${e.message}`);
    }
  }

  // 重複除去・スコア順
  const seen = new Set();
  return allPosts
    .filter(p => { if (seen.has(p.url)) return false; seen.add(p.url); return true; })
    .sort((a, b) => b.score - a.score)
    .slice(0, 25);
}

// ── Claude でcallout生成 ─────────────────────────────────
async function generateCallout(productName, posts) {
  if (posts.length === 0) return null;

  const postText = posts.map((p, i) =>
    `[${i+1}] スコア:${p.score}\nタイトル: ${p.title}\n本文: ${p.text?.slice(0, 200) || '（なし）'}`
  ).join('\n\n');

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `以下のReddit投稿を元に、「${productName}」についての購入者の本音を1〜2文で要約してください。

制約：
- 日本語で出力
- 直接引用（" "）は使わず「〜という声が多い」「〜という評判」という表現を使う
- 肯定・否定両方あれば両方触れる
- 50〜80文字以内
- テキストのみ（HTMLタグ不要）

投稿データ（${posts.length}件）：
${postText}`,
    }],
  });

  return res.content[0].text.trim();
}

// ── HTML内のcalloutを商品名で特定して置換 ─────────────────
function replaceCallout(html, productName, newText) {
  // product-carousel 内の alt="PRODUCT_NAME 全体" または alt="PRODUCT_NAME" を起点に
  // その後に来る最初の .callout を置換する
  const escapedName = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // カルーセルの開始位置を見つける
  const carouselRe = new RegExp(`alt="${escapedName}(?:[^"]*)?"`);
  const carouselMatch = html.search(carouselRe);
  if (carouselMatch === -1) {
    console.warn(`    ⚠️ carousel not found for "${productName}"`);
    return html;
  }

  // その位置以降の最初の .callout を探す
  const afterCarousel = html.slice(carouselMatch);
  const calloutRe = /<div class="callout">([^<]+)<\/div>/;
  const calloutMatch = afterCarousel.match(calloutRe);
  if (!calloutMatch) {
    console.warn(`    ⚠️ callout not found after carousel for "${productName}"`);
    return html;
  }

  const absPos = carouselMatch + afterCarousel.indexOf(calloutMatch[0]);
  const newCallout = `<div class="callout">${newText}</div>`;
  return html.slice(0, absPos) + newCallout + html.slice(absPos + calloutMatch[0].length);
}

// ── 記事処理 ─────────────────────────────────────────────
async function processArticle(filePath, products) {
  let html = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const productName of products) {
    console.log(`\n  📦 ${productName}`);
    const posts = await fetchProductPosts(productName);
    console.log(`    取得: ${posts.length}件`);

    if (posts.length === 0) {
      console.log(`    スキップ（投稿なし）`);
      continue;
    }

    const callout = await generateCallout(productName, posts);
    if (!callout) continue;
    console.log(`    callout: ${callout.slice(0, 60)}...`);

    html = replaceCallout(html, productName, callout);
    changed = true;
    await sleep(1500);
  }

  if (changed) {
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`\n  ✅ 保存: ${filePath}`);
  }
}

// ── メイン ───────────────────────────────────────────────
console.log('\n🎮 商品別Redditデータ注入開始\n');

console.log('━━ gamesir-controller-osusume.html ━━');
await processArticle('public/basics/gamesir-controller-osusume.html', [
  'GameSir Cyclone Pro',
  'GameSir T4 Mini',
  'GameSir G7 SE',
  'GameSir X2s',
  'GameSir Nova Lite',
]);

await sleep(2000);

console.log('\n━━ aliexpress-gamepad-osusume.html ━━');
await processArticle('public/basics/aliexpress-gamepad-osusume.html', [
  'GameSir Cyclone Pro',
  'GameSir T4 Mini',
  'GameSir G7 SE',
  'GameSir X2s',
  '8BitDo SN30 Pro',
  '8BitDo Ultimate Controller',
  'Flydigi Vader 3 Pro',
]);

console.log('\n✅ 完了\n');
