/**
 * inject-product-callout.mjs
 * 商品記事の各商品セクションにRedditベースのcalloutを注入する
 * calloutがない記事: cta-btn-aliex の直前に挿入
 * calloutがある記事: 既存calloutを置換
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import { searchReddit } from './fetch-reddit-voices.mjs';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const TARGETS = [
  {
    file: 'public/basics/ugreen-mouse-osusume.html',
    products: [
      { name: 'UGREEN Wireless Mouse 4000DPI',     subreddit: 'MouseReview', query: 'budget wireless mouse aliexpress review' },
      { name: 'UGREEN Wireless Silent Mouse',       subreddit: 'MouseReview', query: 'silent wireless mouse budget review' },
      { name: 'UGREEN Vertical Wireless Mouse',     subreddit: 'MouseReview', query: 'vertical ergonomic mouse budget review' },
      { name: 'UGREEN Bluetooth Mouse',             subreddit: 'MouseReview', query: 'bluetooth mouse budget review aliexpress' },
    ],
  },
  {
    file: 'public/basics/ugreen-cable-osusume.html',
    products: [
      { name: 'UGREEN USB-C to USB-C 100W',        subreddit: 'Aliexpress', query: 'UGREEN cable USB-C review quality' },
      { name: 'UGREEN 90度 USB-C ケーブル',         subreddit: 'Aliexpress', query: 'UGREEN angled USB cable review' },
      { name: 'UGREEN USB-C to Lightning',         subreddit: 'Aliexpress', query: 'UGREEN lightning cable review' },
      { name: 'UGREEN USB-A to USB-C',             subreddit: 'Aliexpress', query: 'UGREEN USB cable charging quality' },
      { name: 'UGREEN USB-C to HDMI',              subreddit: 'Aliexpress', query: 'UGREEN HDMI adapter review' },
    ],
  },
  {
    file: 'public/basics/ugreen-earphone-osusume.html',
    products: [
      { name: 'UGREEN HiTune P3',   subreddit: 'headphones', query: 'UGREEN HiTune open ear review' },
      { name: 'UGREEN HiTune T3 Pro', subreddit: 'headphones', query: 'budget ANC earbuds aliexpress review' },
      { name: 'UGREEN HiTune Max5c', subreddit: 'headphones', query: 'cheap over ear headphones aliexpress review' },
      { name: 'UGREEN HiTune S5',    subreddit: 'headphones', query: 'UGREEN earbuds review sound quality' },
      { name: 'UGREEN HiTune S3',    subreddit: 'headphones', query: 'budget TWS earbuds under 30 review' },
    ],
  },
];

async function fetchPosts(subreddit, query) {
  try {
    const posts = await searchReddit(subreddit, query, { limit: 15, sort: 'relevance', t: 'year' });
    await sleep(800);
    return posts;
  } catch (e) {
    console.warn(`    ⚠️ ${e.message}`);
    return [];
  }
}

async function generateCallout(productName, posts) {
  if (posts.length === 0) return null;
  const postText = posts.slice(0, 15).map((p, i) =>
    `[${i+1}] スコア:${p.score}\n${p.title}\n${(p.text||'').slice(0,150)}`
  ).join('\n\n');

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `以下のReddit投稿から「${productName}」に関連する購入者の本音を1〜2文（60文字以内）で要約してください。「〜という声が多い」表現を使い、良い点・気になる点の両方に触れてください。テキストのみ出力。\n\n${postText}`,
    }],
  });
  return res.content[0].text.trim();
}

function hasCallouts(html) {
  return html.includes('class="callout"');
}

// calloutなし記事: cta-btn-aliex の直前に挿入
function insertCalloutBeforeCta(html, productAltText, calloutText) {
  // 商品名を含むcarouselの直後の最初のcta-btn-aliexを探す
  const escapedAlt = productAltText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const carouselRe = new RegExp(`alt="${escapedAlt}"`);
  const carouselPos = html.search(carouselRe);
  if (carouselPos === -1) return html;

  const afterCarousel = html.slice(carouselPos);
  const ctaPos = afterCarousel.indexOf('class="cta-btn-aliex"');
  if (ctaPos === -1) return html;

  const absCta = carouselPos + afterCarousel.lastIndexOf('<a ', ctaPos);
  const calloutHtml = `<div class="callout">${calloutText}</div>\n`;
  return html.slice(0, absCta) + calloutHtml + html.slice(absCta);
}

for (const { file, products } of TARGETS) {
  console.log(`\n━━ ${file.split('/').pop()} ━━`);
  let html = fs.readFileSync(file, 'utf8');
  const alreadyHasCallouts = hasCallouts(html);
  let changed = false;

  for (const { name, subreddit, query } of products) {
    console.log(`  📦 ${name}`);
    const posts = await fetchPosts(subreddit, query);
    console.log(`    取得: ${posts.length}件`);
    if (posts.length === 0) continue;

    const callout = await generateCallout(name, posts);
    if (!callout) continue;
    console.log(`    callout: ${callout.slice(0, 60)}`);
    await sleep(1200);

    if (alreadyHasCallouts) {
      // 既存calloutを置換
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`(alt="${escapedName}[^"]*"[\\s\\S]{0,2000}?)<div class="callout">[^<]+<\\/div>`);
      if (re.test(html)) {
        html = html.replace(re, `$1<div class="callout">${callout}</div>`);
        changed = true;
      }
    } else {
      // calloutなし: cta前に挿入
      const newHtml = insertCalloutBeforeCta(html, name, callout);
      if (newHtml !== html) {
        html = newHtml;
        changed = true;
      } else {
        console.log(`    ⚠️ 挿入箇所見つからず`);
      }
    }
  }

  if (changed) {
    fs.writeFileSync(file, html, 'utf8');
    console.log(`  ✅ 保存完了`);
  }
}

console.log('\n✅ 完了');
