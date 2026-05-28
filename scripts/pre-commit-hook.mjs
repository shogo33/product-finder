/**
 * pre-commit-hook.mjs
 * git commit 時にステージ済み記事HTMLの差分を解析し、
 * テキスト内容が実質的に変わっている記事だけ dateModified を今日の日付に更新する。
 *
 * "構造的変更のみ" とみなして日付を更新しないパターン:
 *   - cta-img 挿入, article-date バッジ, JSON-LD スキーマ更新
 *   - CSS クラス名・属性のみの変更, コメント行, 空行
 *   - src= / href= / alt= などの属性値のみの変更
 */

import { execSync } from 'child_process';
import fs from 'fs';

const DATES_FILE = 'data/article-dates.json';
const ARTICLE_RE = /^public\/(gadget|game|outdoor|guide|safety|payment|shipping)\/(.+)\.html$/;

// 構造変更のみとみなすパターン（これにマッチする行は無視）
const STRUCTURAL_PATTERNS = [
  /class="cta-img"/,
  /class="article-date"/,
  /"dateModified"/,
  /"datePublished"/,
  /"@type":\s*"Article"/,
  /"@type":\s*"BreadcrumbList"/,
  /application\/ld\+json/,
  /og:image/,
  /twitter:image/,
  /^\s*[+\-]?\s*<!--/,      // コメント行
  /^\s*[+\-]?\s*<\/?script/,// script タグ
  /^\s*[+\-]?\s*<\/?style/, // style タグ
  /^\s*[+\-]?\s*$/,         // 空行
  /loading="lazy"/,
  /data-carousel/,
  /carousel-track/,
  /cta-box|cta-lead|cta-sub|cta-buttons|cta-note/,
  /related-card|related-grid/,
  /amazon-rec/,
  /reddit-voices|reddit-quote/,
];

// 行がHTMLタグ/属性のみで構成されていて可視テキストを含まないか判定
function isMarkupOnlyLine(line) {
  // +/- プレフィックスを除去
  const content = line.replace(/^[+\-]/, '').trim();
  // HTMLタグを除去した残りが空または記号のみなら markup only
  const stripped = content.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').trim();
  // 1文字以上の単語文字が残っていれば可視テキストあり
  return stripped.length === 0 || !/[\p{L}\p{N}]{2,}/u.test(stripped);
}

function hasContentChange(slug, filePath) {
  let diff;
  try {
    diff = execSync(`git diff --cached -- "${filePath}"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
  } catch {
    return false;
  }

  if (!diff) return false;

  const lines = diff.split('\n');
  // + または - で始まる実際の変更行だけ抽出（diff header 除外）
  const changedLines = lines.filter(l =>
    (l.startsWith('+') || l.startsWith('-')) &&
    !l.startsWith('+++') &&
    !l.startsWith('---')
  );

  const contentLines = changedLines.filter(line => {
    if (STRUCTURAL_PATTERNS.some(p => p.test(line))) return false;
    if (isMarkupOnlyLine(line)) return false;
    return true;
  });

  if (contentLines.length > 0) {
    console.log(`📝 content change detected: ${slug} (${contentLines.length} lines)`);
  }
  return contentLines.length > 0;
}

// ── メイン ──────────────────────────────────────────────────────
const staged = execSync('git diff --cached --name-only', {
  encoding: 'utf8',
  stdio: ['pipe', 'pipe', 'ignore'],
}).trim().split('\n');

if (!fs.existsSync(DATES_FILE)) process.exit(0);
const dates = JSON.parse(fs.readFileSync(DATES_FILE, 'utf8'));
const today = new Date().toISOString().split('T')[0];

let updated = false;

for (const file of staged) {
  const m = file.match(ARTICLE_RE);
  if (!m) continue;
  const slug = m[2];
  if (!dates[slug]) continue;
  if (dates[slug].modified === today) continue; // すでに今日

  if (hasContentChange(slug, file)) {
    dates[slug].modified = today;
    updated = true;
    console.log(`📅 更新日を更新: ${slug} → ${today}`);
  }
}

if (updated) {
  fs.writeFileSync(DATES_FILE, JSON.stringify(dates, null, 2), 'utf8');
  // 更新した dates.json をステージに追加
  execSync(`git add "${DATES_FILE}"`, { stdio: 'inherit' });
}

process.exit(0);
