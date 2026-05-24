/**
 * gen-all.mjs
 * 記事追加後に一発実行するマスタースクリプト
 * - sitemap.xml / sitemap.html を再生成
 * - index.html のおすすめカードを再生成
 * - OGP 画像を再生成
 * - 記事内の外部画像をローカルに保存（リンク切れ防止）
 *
 * 使い方: node scripts/gen-all.mjs
 */
import { execSync } from 'child_process';

const run = (cmd) => {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

run('node scripts/download-article-images.mjs');
run('node scripts/gen-sitemap.mjs');
run('node scripts/gen-top-cards.mjs');
run('node scripts/gen-faq-schema.mjs');
run('node scripts/gen-related-links.mjs');
run('node scripts/gen-ogp.mjs');

console.log('\n✅ 全生成完了');
