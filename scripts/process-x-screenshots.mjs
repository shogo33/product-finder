/**
 * process-x-screenshots.mjs
 * X検索スクリーンショット（PNG）を分割してClaude Vision APIで解析し、
 * 記事の VOICE-START/END ブロックに注入する
 *
 * 使い方:
 *   node scripts/process-x-screenshots.mjs              # 全スクリーンショットを処理
 *   node scripts/process-x-screenshots.mjs todokanai    # slug指定で絞り込み
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
import Anthropic from '@anthropic-ai/sdk';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const RAW_DIR = path.resolve('public/x-data/raw');
const PUBLIC  = path.resolve('public');
const TODAY   = new Date().toISOString().slice(0, 7);

// ──────────────────────────────────────────────
// ファイル名 → 記事スラッグのマッピング
// ──────────────────────────────────────────────
const FILE_TO_ARTICLE = {
  'アリエク 届かない':         { slug: 'aliexpress-todokanai',     folder: 'shipping' },
  'アリエク 返金':             { slug: 'aliexpress-todokanai',     folder: 'shipping' },
  'アリエク 荷物 来ない':       { slug: 'aliexpress-todokanai',     folder: 'shipping' },
  'アリエクスプレス 届かない':  { slug: 'aliexpress-todokanai',     folder: 'shipping' },
  'アリエク 偽物':             { slug: 'aliexpress-ayashii',       folder: 'safety'   },
  'アリエクスプレス 偽物':      { slug: 'aliexpress-ayashii',       folder: 'safety'   },
  'アリエク 詐欺':             { slug: 'aliexpress-ayashii',       folder: 'safety'   },
  'アリエク 買ってみた':        { slug: 'aliexpress-ayashii',       folder: 'safety'   },
  'アリエク 追跡':             { slug: 'aliexpress-tracking-guide',folder: 'shipping' },
  'アリエク 税関':             { slug: 'aliexpress-tracking-guide',folder: 'shipping' },
  'アリエク 追跡番号':          { slug: 'aliexpress-tracking-guide',folder: 'shipping' },
  'アリエク 届いた':           { slug: 'aliexpress-nannichi',      folder: 'shipping' },
  'アリエク 配送':             { slug: 'aliexpress-nannichi',      folder: 'shipping' },
  'アリエク 遅':               { slug: 'aliexpress-nannichi',      folder: 'shipping' },
};

// ファイル名からクエリキーを抽出
function getQueryKey(filename) {
  for (const key of Object.keys(FILE_TO_ARTICLE)) {
    if (filename.includes(key)) return key;
  }
  return null;
}

// ──────────────────────────────────────────────
// 画像を縦方向に分割してbase64スライスを返す
// ──────────────────────────────────────────────
async function splitImage(filePath, sliceHeight = 3000) {
  const meta = await sharp(filePath).metadata();
  const { width, height } = meta;
  const slices = [];
  for (let y = 0; y < height; y += sliceHeight) {
    const h = Math.min(sliceHeight, height - y);
    const buf = await sharp(filePath)
      .extract({ left: 0, top: y, width, height: h })
      .resize({ width: 1200 }) // 読みやすいサイズに縮小
      .png()
      .toBuffer();
    slices.push(buf.toString('base64'));
  }
  return slices;
}

// ──────────────────────────────────────────────
// スライスからツイートテキストを抽出
// ──────────────────────────────────────────────
async function extractTweetsFromSlice(b64, query) {
  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: b64 } },
        { type: 'text', text: `これはX（旧Twitter）で「${query}」と検索した結果のスクリーンショットです。
画像内に見えるツイート本文をすべて読み取り、以下のJSON形式で出力してください。

{ "tweets": ["ツイート本文1", "ツイート本文2", ...] }

- 広告・公式アカウントのツイートは除外
- リプライは含めず、メインツイートのみ
- 読み取れないものはスキップ
- JSONのみ出力` }
      ]
    }]
  });
  try {
    const raw = res.content[0].text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(raw).tweets ?? [];
  } catch {
    return [];
  }
}

// ──────────────────────────────────────────────
// ツイート群 → 声ブロックHTML生成
// ──────────────────────────────────────────────
async function generateVoiceHtml(tweets, query, slug) {
  const tweetText = tweets.map((t, i) => `[${i+1}] ${t}`).join('\n');

  const res = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1200,
    messages: [{
      role: 'user',
      content: `X（旧Twitter）で「${query}など」と検索したツイート${tweets.length}件を分析し、
「生の声まとめ」をJSON形式で出力してください。

出力形式:
{
  "post_count": 分析件数,
  "sentiment": { "positive": 正割合(整数), "negative": 負割合, "neutral": 中立割合 },
  "voices": [
    {
      "emoji": "絵文字1文字",
      "category": "【高評価】など5文字以内",
      "title": "15文字以内の見出し",
      "body": "2〜3文。傾向要約（直接引用不可、「〜という声が多い」形式）",
      "action": "「対策：」で始まる実践的な1文"
    }
  ]
}

制約: voices3〜4件、日本語、数値表現を積極的に使う、JSONのみ出力

ツイートデータ:
${tweetText.slice(0, 6000)}`
    }]
  });

  const raw = res.content[0].text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  const data = JSON.parse(raw);

  const sentimentText = `満足の声が約${data.sentiment.positive}%、不満・トラブルの声が約${data.sentiment.negative}%`;
  const voiceItems = data.voices.map(v => `      <div class="voice-item">
        <div class="voice-label">${v.emoji} ${v.category}</div>
        <div class="voice-title">${v.title}</div>
        <p class="voice-body">${v.body}</p>
        <div class="voice-action">${v.action}</div>
      </div>`).join('\n');

  return `    <!-- VOICE-START -->
    <div class="reddit-voices">
      <div class="voices-header">
        <span class="voices-badge">X（旧Twitter）</span>
        <h3 class="voices-title">利用者のリアルな本音と注意点</h3>
        <p class="voices-meta">X上の直近の書き込み約${data.post_count}件をAIで分析（${TODAY}更新）。${sentimentText}でした。</p>
      </div>
${voiceItems}
    </div>
    <!-- VOICE-END -->`;
}

// ──────────────────────────────────────────────
// 記事に注入（gen-voices.mjs と同じロジック）
// ──────────────────────────────────────────────
const VOICE_CSS = `
    /* Xの生の声ブロック */
    .reddit-voices { background: #fff; border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; margin: 40px 0; }
    .voices-header { margin-bottom: 20px; }
    .voices-badge { display: inline-block; background: #000; color: #fff; font-size: 0.7rem; font-weight: 700; padding: 2px 10px; border-radius: 999px; margin-bottom: 8px; }
    .voices-title { font-size: 1.05rem; font-weight: 700; margin: 6px 0 8px; }
    .voices-meta { font-size: 0.8rem; color: var(--muted); line-height: 1.6; }
    .voice-item { border-top: 1px solid var(--border); padding: 16px 0; }
    .voice-item:last-child { padding-bottom: 0; }
    .voice-label { font-size: 0.78rem; font-weight: 700; color: var(--muted); margin-bottom: 4px; }
    .voice-title { font-size: 0.97rem; font-weight: 700; margin-bottom: 6px; }
    .voice-body { font-size: 0.88rem; line-height: 1.75; margin: 0 0 8px; }
    .voice-action { font-size: 0.85rem; background: #f0fdf4; border-left: 3px solid #86efac; padding: 8px 12px; border-radius: 0 6px 6px 0; color: #166534; }`;

function injectIntoArticle(filePath, voiceHtml) {
  let html = fs.readFileSync(filePath, 'utf8');
  const startMark = '<!-- VOICE-START -->';
  const endMark   = '<!-- VOICE-END -->';
  const si = html.indexOf(startMark);
  const ei = html.indexOf(endMark);

  if (si !== -1 && ei !== -1) {
    html = html.slice(0, si) + voiceHtml + html.slice(ei + endMark.length);
  } else {
    // 挿入ポイントを順番に探す：<hr> → <div class="related"> → まとめh2
    let insertAt = html.lastIndexOf('<hr>');
    if (insertAt === -1) insertAt = html.indexOf('<div class="related">');
    if (insertAt === -1) {
      const m = html.match(/<h2[^>]*>.*?まとめ/);
      if (m) insertAt = html.indexOf(m[0]);
    }
    if (insertAt === -1) { console.warn('  ⚠️ 挿入箇所なし'); return false; }
    html = html.slice(0, insertAt) + voiceHtml + '\n\n    ' + html.slice(insertAt);
  }

  if (!html.includes('.reddit-voices')) {
    const styleEnd = html.indexOf('</style>');
    if (styleEnd !== -1) html = html.slice(0, styleEnd) + VOICE_CSS + '\n  ' + html.slice(styleEnd);
  }

  fs.writeFileSync(filePath, html, 'utf8');
  return true;
}

// ──────────────────────────────────────────────
// メイン
// ──────────────────────────────────────────────
const targetSlug = process.argv[2] ?? null;

// スラッグ別にファイルをグループ化
const groups = {};
for (const f of fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.png'))) {
  const key = getQueryKey(f);
  if (!key) continue;
  const article = FILE_TO_ARTICLE[key];
  if (targetSlug && article.slug !== targetSlug) continue;
  if (!groups[article.slug]) groups[article.slug] = { ...article, files: [], queries: [] };
  groups[article.slug].files.push(path.join(RAW_DIR, f));
  groups[article.slug].queries.push(key);
}

for (const [slug, info] of Object.entries(groups)) {
  console.log(`\n📄 ${slug}（${info.files.length}ファイル）`);
  const allTweets = [];

  for (const filePath of info.files) {
    const query = info.queries[info.files.indexOf(filePath)];
    console.log(`  📸 ${path.basename(filePath)}`);
    const slices = await splitImage(filePath);
    console.log(`     → ${slices.length}分割で解析中...`);

    for (let i = 0; i < slices.length; i++) {
      try {
        const tweets = await extractTweetsFromSlice(slices[i], query);
        console.log(`     スライス${i+1}: ${tweets.length}件`);
        allTweets.push(...tweets);
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        console.warn(`     ⚠️ スライス${i+1}失敗: ${e.message}`);
      }
    }
  }

  console.log(`  📊 合計ツイート: ${allTweets.length}件`);
  if (allTweets.length < 5) { console.warn('  ⚠️ 件数不足、スキップ'); continue; }

  console.log('  🤖 Claude で声ブロック生成中...');
  const voiceHtml = await generateVoiceHtml(allTweets, info.queries.join('・'), slug);

  const filePath = path.join(PUBLIC, info.folder, `${slug}.html`);
  if (!fs.existsSync(filePath)) { console.warn(`  ⚠️ 記事ファイルなし: ${filePath}`); continue; }

  const ok = injectIntoArticle(filePath, voiceHtml);
  if (ok) console.log(`  ✅ 注入完了`);
}

console.log('\n✅ process-x-screenshots 完了');
