/**
 * gen-voices.mjs
 * Reddit の生の声を Claude で要約し、記事の VOICE-START/END ブロックに注入する
 * 使い方: node scripts/gen-voices.mjs [slug]
 *   slug を省略すると ARTICLE_CONFIG の全記事を処理する
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { searchReddit, fetchTopComments } from './fetch-reddit-voices.mjs';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const PUBLIC = path.resolve('public');
const TODAY  = new Date().toISOString().slice(0, 7); // YYYY-MM

// ──────────────────────────────────────────────
// 記事ごとの設定
// ──────────────────────────────────────────────
const ARTICLE_CONFIG = [
  {
    slug:      'aliexpress-todokanai',
    folder:    'shipping',
    subreddit: 'Aliexpress',
    queries:   ['item not received dispute refund', 'package not arrived', 'open dispute not delivered'],
    topic:     'AliExpressで荷物が届かない・返金申請（Dispute）のリアルな体験談',
  },
  {
    slug:      'aliexpress-safety',
    folder:    'safety',
    subreddit: 'Aliexpress',
    queries:   ['fake counterfeit product', 'scam seller fraud', 'safe to buy trustworthy'],
    topic:     'AliExpressの安全性・偽物・詐欺セラーに関するリアルな体験談',
  },
  {
    slug:      'aliexpress-ayashii',
    folder:    'safety',
    subreddit: 'Aliexpress',
    queries:   ['fake item counterfeit suspicious', 'seller scam', 'quality different from photo'],
    topic:     'AliExpressの怪しい商品・偽物・品質に関するリアルな体験談',
  },
  {
    slug:      'aliexpress-tracking-guide',
    folder:    'shipping',
    subreddit: 'Aliexpress',
    queries:   ['tracking not updating stuck customs', 'where is my package tracking'],
    topic:     'AliExpressの追跡が止まる・更新されない・税関通過に関する体験談',
  },
  {
    slug:      'aliexpress-nannichi',
    folder:    'shipping',
    subreddit: 'Aliexpress',
    queries:   ['how long does shipping take Japan delivery time', 'fast shipping to Japan'],
    topic:     'AliExpressから日本への配送日数に関するリアルな体験談',
  },
  {
    slug:      'gamesir-controller-osusume',
    folder:    'game',
    subreddit: 'gamesir',
    queries:   ['review', 'aliexpress buy', 'hall effect drift'],
    topic:     'GameSirコントローラーのAliExpress購入に関するリアルな評判・体験談',
  },
  {
    slug:      'aliexpress-gamepad-osusume',
    folder:    'game',
    subreddit: 'NintendoSwitch',
    queries:   ['gamesir controller aliexpress', 'aliexpress controller recommend', 'cheap controller hall effect switch'],
    topic:     'AliExpressで買えるゲームパッド・コントローラーのリアルな評判・体験談',
  },
  {
    slug:      'ugreen-mouse-osusume',
    folder:    'gadget',
    subreddit: 'MouseReview',
    queries:   ['UGREEN mouse review', 'cheap aliexpress mouse', 'budget wireless mouse review'],
    topic:     'UGREENマウスのリアルな評判・体験談',
  },
  {
    slug:      'ugreen-cable-osusume',
    folder:    'gadget',
    subreddit: 'Aliexpress',
    queries:   ['UGREEN cable review quality', 'UGREEN USB cable aliexpress', 'UGREEN charging cable'],
    topic:     'UGREENケーブルのAliExpress購入に関するリアルな評判・体験談',
  },
  {
    slug:      'ugreen-earphone-osusume',
    folder:    'gadget',
    subreddit: 'headphones',
    queries:   ['UGREEN HiTune review', 'cheap aliexpress earbuds review', 'budget TWS earphones aliexpress'],
    topic:     'UGREENイヤホンのリアルな評判・体験談',
  },
  {
    slug:      'ugreen-stand-osusume',
    folder:    'gadget',
    subreddit: 'Aliexpress',
    queries:   ['UGREEN desk accessories review', 'aliexpress phone stand review', 'aliexpress desk organizer'],
    topic:     'UGREENスマホスタンドのAliExpress購入に関するリアルな評判・体験談',
  },
  {
    slug:      'ugreen-smart-tracker-osusume',
    folder:    'gadget',
    subreddit: 'Aliexpress',
    queries:   ['tracker find my item', 'AirTag alternative buy', 'lost item tracker bluetooth'],
    topic:     'UGREENスマートトラッカーのリアルな評判・体験談',
  },
  {
    slug:      'baseus-mobile-battery-osusume',
    folder:    'gadget',
    subreddit: 'Aliexpress',
    queries:   ['Baseus power bank', 'mobile battery powerbank review', 'Baseus brand quality'],
    topic:     'Baseusモバイルバッテリーのリアルな評判・体験談',
  },
  {
    slug:      'naturehike-tent-osusume',
    folder:    'outdoor',
    subreddit: 'CampingandHiking',
    queries:   ['Naturehike tent review', 'Naturehike Cloud Up review', 'aliexpress tent camping'],
    topic:     'Naturehikeテントのリアルな評判・体験談',
  },
  {
    slug:      'naturehike-airmat-osusume',
    folder:    'outdoor',
    subreddit: 'CampingandHiking',
    queries:   ['Naturehike sleeping pad mat review', 'aliexpress camping mat', 'inflatable sleeping pad review'],
    topic:     'Naturehikeエアーマットのリアルな評判・体験談',
  },
  {
    slug:      'naturehike-sleeping-bag-osusume',
    folder:    'outdoor',
    subreddit: 'CampingandHiking',
    queries:   ['Naturehike sleeping bag review', 'aliexpress down sleeping bag cheap', 'budget down sleeping bag camping'],
    topic:     'Naturehikeシュラフのリアルな評判・体験談',
  },
  {
    slug:      'xiaomi-band10-strap-osusume',
    folder:    'gadget',
    subreddit: 'Xiaomi',
    queries:   ['Xiaomi Band 9 10 strap band review', 'aliexpress xiaomi band strap', 'Mi band replacement strap'],
    topic:     'Xiaomi Bandバンドのリアルな評判・体験談',
  },
  {
    slug:      'aliexpress-vs-temu',
    folder:    'guide',
    subreddit: 'Aliexpress',
    queries:   ['Temu vs AliExpress which is better', 'Temu comparison AliExpress', 'AliExpress better than Temu quality'],
    topic:     'TemuとAliExpressの比較・どっちがいいかというリアルな評判・体験談',
  },
  {
    slug:      'ugreen-gan-charger-osusume',
    folder:    'gadget',
    subreddit: 'Aliexpress',
    queries:   ['UGREEN Nexode GaN charger review', 'UGREEN charger aliexpress quality', 'GaN charger compact fast charging review'],
    topic:     'UGREEN GaN充電器のリアルな評判・体験談',
  },
  {
    slug:      'ugreen-usb-hub-osusume',
    folder:    'gadget',
    subreddit: 'Aliexpress',
    queries:   ['UGREEN USB hub review aliexpress', 'USB hub dock station quality', 'UGREEN hub docking station experience'],
    topic:     'UGREEN USBハブのリアルな評判・体験談',
  },
  {
    slug:      'ugreen-docking-station-osusume',
    folder:    'gadget',
    subreddit: 'Aliexpress',
    queries:   ['UGREEN Revodok docking station review', 'UGREEN dock station aliexpress experience', 'USB C docking station MacBook review'],
    topic:     'UGREEN ドッキングステーションのリアルな評判・体験談',
  },
];

// ──────────────────────────────────────────────
// Reddit 投稿を収集してテキストにまとめる
// ──────────────────────────────────────────────
async function collectPosts(config) {
  const allPosts = [];
  for (const query of config.queries) {
    try {
      console.log(`  🔍 Reddit検索: "${query}"`);
      const posts = await searchReddit(config.subreddit, query, { limit: 35, sort: 'relevance', t: 'month' });
      allPosts.push(...posts);
      await new Promise(r => setTimeout(r, 1200)); // レート制限対策
    } catch (e) {
      console.warn(`  ⚠️ 取得失敗 (${query}): ${e.message}`);
    }
  }

  // 重複除去・スコア順
  const seen = new Set();
  const unique = allPosts
    .filter(p => { if (seen.has(p.url)) return false; seen.add(p.url); return true; })
    .sort((a, b) => b.score - a.score)
    .slice(0, 80);

  // 上位3件のコメントも取得
  for (const post of unique.slice(0, 3)) {
    try {
      const permalink = post.url.replace('https://www.reddit.com', '');
      post.topComments = await fetchTopComments(permalink);
      await new Promise(r => setTimeout(r, 800));
    } catch (_) { post.topComments = []; }
  }

  return unique;
}

// ──────────────────────────────────────────────
// Claude で要約ブロックを生成
// ──────────────────────────────────────────────
async function generateVoiceBlock(config, posts) {
  const postText = posts.slice(0, 60).map((p, i) => {
    const comments = (p.topComments ?? []).map(c => `    コメント(${c.score}pt): ${c.text}`).join('\n');
    return `[${i+1}] スコア:${p.score} コメント数:${p.comments}\nタイトル: ${p.title}\n本文: ${p.text || '（なし）'}${comments ? '\n' + comments : ''}`;
  }).join('\n\n');

  const prompt = `あなたはSEOライターです。以下のReddit（r/${config.subreddit}）の投稿データ（直近1ヶ月、約${posts.length}件）を分析し、
「${config.topic}」についての「生の声まとめブロック」をJSON形式で出力してください。

## 出力形式（JSON）
{
  "post_count": 実際に分析した投稿数,
  "sentiment": { "positive": 正の割合(0-100の整数), "negative": 負の割合, "neutral": 中立の割合 },
  "voices": [
    {
      "emoji": "絵文字1文字",
      "category": "【高評価】または【トラブル多発】または【対策・傾向】など5文字以内",
      "title": "15文字以内の見出し",
      "body": "2〜3文。傾向の要約（直接引用は使わず、「〜という声が多い」「〜する傾向がある」という表現で）",
      "action": "「対策：」で始まる1文の実践的なアドバイス"
    }
  ]
}

## 制約
- voicesは3〜4件
- 日本語で出力
- 直接引用（" "）は使わない。傾向・割合の言葉で表現する
- 数値的な表現（「〜割の声」「〜件中〜件」）を積極的に使う
- JSONのみ出力（マークダウンのコードブロック不要）

## 投稿データ
${postText}`;

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();
  // コードブロックが入ってきた場合の除去
  const cleaned = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(cleaned);
}

// ──────────────────────────────────────────────
// HTML ブロック生成
// ──────────────────────────────────────────────
function buildHtml(data, subreddit) {
  const positivePct = data.sentiment.positive;
  const negativePct = data.sentiment.negative;
  const sentimentText = `満足の声が約${positivePct}%、不満・トラブルの声が約${negativePct}%`;

  const voiceItems = data.voices.map(v => `      <div class="voice-item">
        <div class="voice-label">${v.emoji} ${v.category}</div>
        <div class="voice-title">${v.title}</div>
        <p class="voice-body">${v.body}</p>
        <div class="voice-action">${v.action}</div>
      </div>`).join('\n');

  return `    <!-- VOICE-START -->
    <div class="reddit-voices">
      <div class="voices-header">
        <span class="voices-badge">Reddit r/${subreddit}</span>
        <h3 class="voices-title">利用者のリアルな本音と注意点</h3>
        <p class="voices-meta">直近1ヶ月のRedditの書き込み約${data.post_count}件をAIで分析（${TODAY}更新）。${sentimentText}でした。</p>
      </div>
${voiceItems}
    </div>
    <!-- VOICE-END -->`;
}

// ──────────────────────────────────────────────
// 記事に注入
// ──────────────────────────────────────────────
function injectIntoArticle(filePath, voiceHtml) {
  let html = fs.readFileSync(filePath, 'utf8');
  const startMark = '<!-- VOICE-START -->';
  const endMark   = '<!-- VOICE-END -->';
  const si = html.indexOf(startMark);
  const ei = html.indexOf(endMark);

  if (si !== -1 && ei !== -1) {
    // 既存ブロックを置き換え
    html = html.slice(0, si) + voiceHtml + html.slice(ei + endMark.length);
  } else {
    // <hr> の直前に挿入（なければ </div>\n</div> の手前）
    const hrPos = html.lastIndexOf('<hr>');
    const insertAt = hrPos !== -1 ? hrPos : html.lastIndexOf('    </div>\n  </div>');
    if (insertAt === -1) {
      console.warn('  ⚠️ 挿入箇所が見つかりません。スキップします。');
      return false;
    }
    html = html.slice(0, insertAt) + voiceHtml + '\n\n    ' + html.slice(insertAt);
  }

  // VOICE用CSSがなければ <style> ブロック末尾に追加
  if (!html.includes('.reddit-voices')) {
    const styleEnd = html.indexOf('</style>');
    if (styleEnd !== -1) {
      html = html.slice(0, styleEnd) + VOICE_CSS + '\n  ' + html.slice(styleEnd);
    }
  }

  fs.writeFileSync(filePath, html, 'utf8');
  return true;
}

// ──────────────────────────────────────────────
// 声セクション用CSS
// ──────────────────────────────────────────────
const VOICE_CSS = `
    /* Reddit生の声ブロック */
    .reddit-voices { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; margin: 40px 0; }
    .voices-header { margin-bottom: 20px; }
    .voices-badge { display: inline-block; background: #ff4500; color: #fff; font-size: 0.7rem; font-weight: 700; padding: 2px 10px; border-radius: 999px; margin-bottom: 8px; }
    .voices-title { font-size: 1.05rem; font-weight: 700; margin: 6px 0 8px; }
    .voices-meta { font-size: 0.8rem; color: var(--muted); line-height: 1.6; }
    .voice-item { border-top: 1px solid var(--border); padding: 16px 0; }
    .voice-item:last-child { padding-bottom: 0; }
    .voice-label { font-size: 0.78rem; font-weight: 700; color: var(--muted); margin-bottom: 4px; }
    .voice-title { font-size: 0.97rem; font-weight: 700; margin-bottom: 6px; }
    .voice-body { font-size: 0.88rem; line-height: 1.75; margin: 0 0 8px; }
    .voice-action { font-size: 0.85rem; background: #f0fdf4; border-left: 3px solid #86efac; padding: 8px 12px; border-radius: 0 6px 6px 0; color: #166534; }`;

// ──────────────────────────────────────────────
// メイン
// ──────────────────────────────────────────────
const targetSlug = process.argv[2] ?? null;
const configs = targetSlug
  ? ARTICLE_CONFIG.filter(c => c.slug === targetSlug)
  : ARTICLE_CONFIG;

if (configs.length === 0) {
  console.error(`❌ slug "${targetSlug}" が ARTICLE_CONFIG に見つかりません`);
  process.exit(1);
}

for (const config of configs) {
  console.log(`\n📄 ${config.slug}`);
  const filePath = path.join(PUBLIC, config.folder, `${config.slug}.html`);
  if (!fs.existsSync(filePath)) {
    console.warn(`  ⚠️ ファイルが見つかりません: ${filePath}`);
    continue;
  }

  try {
    const posts = await collectPosts(config);
    console.log(`  📥 取得: ${posts.length}件`);

    if (posts.length < 5) {
      console.warn('  ⚠️ 投稿数が少なすぎます。スキップします。');
      continue;
    }

    console.log('  🤖 Claude で要約中...');
    const data = await generateVoiceBlock(config, posts);

    const voiceHtml = buildHtml(data, config.subreddit);
    const ok = injectIntoArticle(filePath, voiceHtml);
    if (ok) console.log(`  ✅ 注入完了（声${data.voices.length}件、センチメント 満足${data.sentiment.positive}% / 不満${data.sentiment.negative}%）`);
  } catch (e) {
    console.error(`  ❌ エラー: ${e.message}`);
  }
}

console.log('\n✅ gen-voices 完了');
