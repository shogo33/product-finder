/**
 * init-article-dates.mjs
 * data/article-dates.json を git log の初回コミット日付で初期化する（一回限り実行）。
 * modified は published と同じ値（=記事作成日）にリセット。
 * 以後は gen-article-schema.mjs がこのファイルを参照し、自動更新しない。
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const ARTICLE_DIRS = ['gadget','game','outdoor','guide','safety','payment','shipping'];
const SKIP = new Set(['admin','preview','template','nav','home','sitemap','index']);
const OUT = 'data/article-dates.json';

const dates = {};

for (const folder of ARTICLE_DIRS) {
  const dir = path.join('public', folder);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.html') || SKIP.has(path.basename(f, '.html'))) continue;
    const slug = path.basename(f, '.html');
    const filePath = path.join(dir, f);
    try {
      const first = execSync(
        `git log --follow --format="%ai" --diff-filter=A -- "${filePath}"`,
        { encoding: 'utf8', stdio: ['pipe','pipe','ignore'] }
      ).trim();
      const last = execSync(
        `git log --format="%ai" -1 -- "${filePath}"`,
        { encoding: 'utf8', stdio: ['pipe','pipe','ignore'] }
      ).trim();
      const published = (first || last).split(' ')[0];
      dates[slug] = { published, modified: published };
    } catch {
      const d = new Date().toISOString().split('T')[0];
      dates[slug] = { published: d, modified: d };
    }
  }
}

fs.writeFileSync(OUT, JSON.stringify(dates, null, 2), 'utf8');
console.log(`✅ ${OUT} を初期化しました（${Object.keys(dates).length} 記事）`);
