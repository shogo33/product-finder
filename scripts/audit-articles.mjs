/**
 * 既存記事の品質チェッカー
 * 使い方: node scripts/audit-articles.mjs [slug]
 * slug 省略時は全記事をスキャンしてスコア順に出力
 */
import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.resolve('public');
const CATEGORIES = ['gadget', 'game', 'outdoor', 'guide', 'safety', 'payment', 'shipping'];

// 禁止表現
const BANNED_WORDS = [
  'コスパ最強', '圧倒的', '非常に優秀', '革命的', 'コスパが最強',
  '誰にでもおすすめ', '完璧', '高性能', '使いました', '実際に試しました',
  'に定評があります', 'の一品です',
];

// 必須要素チェック
function checkArticle(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  let score = 0; // 高いほど要修正

  // 1. 結論ブロックが冒頭にあるか
  const hasConclusion = html.includes('article-conclusion') || html.includes('class="conclusion"');
  if (!hasConclusion) {
    issues.push('❌ 結論ブロックなし（冒頭に結論・推奨用途を追加）');
    score += 3;
  }

  // 2. 「こんな人向け」があるか
  const hasForWho = html.includes('for-who') || html.includes('こんな人向け') || html.includes('こんな方向け') || html.includes('こんな人にオススメ') || html.includes('向けの記事');
  if (!hasForWho) {
    issues.push('❌ 「こんな人向け」ブロックなし');
    score += 2;
  }

  // 3. 比較表があるか
  const hasTable = html.includes('<table');
  if (!hasTable) {
    issues.push('❌ 比較表なし（table を追加）');
    score += 2;
  }

  // 4. デメリット記述があるか
  const hasDemerits = /デメリット|注意点|欠点|弱点|惜しい|残念|発熱|重め|大きめ|遅い|初期不良/.test(html);
  if (!hasDemerits) {
    issues.push('⚠️  デメリット・注意点の記述が薄い');
    score += 2;
  }

  // 5. 禁止表現チェック
  const foundBanned = BANNED_WORDS.filter(w => html.includes(w));
  if (foundBanned.length > 0) {
    issues.push(`⚠️  禁止表現あり: ${foundBanned.join('、')}`);
    score += foundBanned.length;
  }

  // 6. Reddit声があるか
  const hasReddit = html.includes('reddit-quote') || html.includes('reddit-voices') || html.includes('VOICE-START');
  if (!hasReddit) {
    issues.push('❌ Reddit声なし（gen-voices.mjs を実行）');
    score += 3;
  }

  // 7. FAQがあるか
  const hasFaq = /faq|よくある質問|FAQ/.test(html);
  if (!hasFaq) {
    issues.push('⚠️  FAQなし');
    score += 1;
  }

  // 8. 本文中内部リンクが少ないか（関連記事以外のリンク）
  const inTextLinks = (html.match(/本文中.*href|href.*aliswipe\.com/g) ?? []).length;
  const relatedSection = html.includes('related-grid');
  if (!relatedSection) {
    issues.push('⚠️  関連記事セクションなし');
    score += 1;
  }

  return { score, issues };
}

function scanAll() {
  const results = [];

  for (const cat of CATEGORIES) {
    const dir = path.join(PUBLIC_DIR, cat);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html');
    for (const file of files) {
      const filePath = path.join(dir, file);
      const slug = `${cat}/${file.replace('.html', '')}`;
      try {
        const { score, issues } = checkArticle(filePath);
        if (score > 0) results.push({ slug, score, issues });
      } catch {
        // skip unreadable
      }
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

const targetSlug = process.argv[2];

if (targetSlug) {
  // 単記事チェック
  const parts = targetSlug.replace('.html', '').split('/');
  const filePath = parts.length === 2
    ? path.join(PUBLIC_DIR, parts[0], parts[1] + '.html')
    : path.join(PUBLIC_DIR, targetSlug + '.html');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ ファイルが見つかりません: ${filePath}`);
    process.exit(1);
  }

  const { score, issues } = checkArticle(filePath);
  console.log(`\n📋 ${targetSlug}  スコア: ${score}`);
  if (issues.length === 0) {
    console.log('✅ 問題なし');
  } else {
    issues.forEach(i => console.log('  ' + i));
  }
} else {
  // 全記事スキャン
  console.log('\n📊 記事品質チェック結果（スコア高い順）\n');
  const results = scanAll();

  if (results.length === 0) {
    console.log('✅ 全記事チェック通過');
  } else {
    console.log(`要修正: ${results.length} 件\n`);
    for (const r of results) {
      console.log(`[スコア:${r.score}] ${r.slug}`);
      r.issues.forEach(i => console.log('    ' + i));
      console.log('');
    }

    // サマリー
    const totalBanned = results.filter(r => r.issues.some(i => i.includes('禁止表現'))).length;
    const noConclusion = results.filter(r => r.issues.some(i => i.includes('結論ブロック'))).length;
    const noDemerits = results.filter(r => r.issues.some(i => i.includes('デメリット'))).length;
    console.log('─'.repeat(50));
    console.log(`禁止表現あり: ${totalBanned} 件`);
    console.log(`結論ブロックなし: ${noConclusion} 件`);
    console.log(`デメリット不足: ${noDemerits} 件`);
  }
}
