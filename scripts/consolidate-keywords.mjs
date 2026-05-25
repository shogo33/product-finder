/**
 * キーワードデータ統合スクリプト
 * data/keyword-csvs/ 以下の全CSVと data/keyword-research.json を
 * data/keyword-all.json に統合する（全データ項目を保持）
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CSV_DIR = path.join(ROOT, 'data', 'keyword-csvs');
const BASE_JSON = path.join(ROOT, 'data', 'keyword-research.json');
const OUT_JSON = path.join(ROOT, 'data', 'keyword-all.json');

// --- ユーティリティ ---

/** ダブルクォートを除去してタブ分割 */
const parseTsvLine = (line) =>
  line.split('\t').map(v => v.replace(/^"|"$/g, '').trim());

/** UTF-8 BOM 付きCSVを行配列に */
const readUtf8Csv = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '');
  return raw.split(/\r?\n/).filter(l => l.trim());
};

/** UTF-16LE BOM 付きCSVを行配列に */
const readUtf16Csv = (filePath) => {
  const buf = fs.readFileSync(filePath);
  const raw = buf.toString('utf16le').replace(/^﻿/, '');
  return raw.split(/\r?\n/).filter(l => l.trim());
};

/** ヘッダー行 + データ行 → オブジェクト配列 */
const linesToRows = (lines) => {
  const headers = parseTsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseTsvLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      // 数値に変換できる項目は数値に
      const v = vals[i] ?? '';
      const n = Number(v);
      obj[h] = v !== '' && !isNaN(n) ? n : v;
    });
    return obj;
  });
};

/** ファイル名から日時を抽出 (YYYY-MM-DD) */
const dateFromFilename = (filename) => {
  const m = filename.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '2026-05-25';
};

/** suggestKeywords ファイル名からシードKWを抽出 */
const seedKwFromFilename = (filename) => {
  // rakkokeyword_suggestKeywords_{seedKW}_{timestamp}.csv
  const base = path.basename(filename, '.csv');
  const m = base.match(/^rakkokeyword_suggestKeywords_(.+)_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
  return m ? m[1] : base;
};

// --- 読み込み処理 ---

console.log('📖 既存 keyword-research.json を読み込み中...');
const base = JSON.parse(fs.readFileSync(BASE_JSON, 'utf8'));

const csvFiles = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv'));

const suggestRows = [];   // 全 suggestKeywords（ファイル横断）
const influxGroups = [];  // influxKeywords（ファイル単位）
let allResearchRows = []; // keyword-research-all.csv

for (const f of csvFiles.sort()) {
  const filePath = path.join(CSV_DIR, f);
  const fetchedAt = dateFromFilename(f);

  if (f === 'keyword-research-all.csv') {
    console.log(`  📄 ${f} (UTF-8)`);
    const lines = readUtf8Csv(filePath);
    allResearchRows = linesToRows(lines);
    console.log(`     → ${allResearchRows.length} 件`);

  } else if (f.startsWith('rakkokeyword_suggestKeywords_')) {
    console.log(`  📄 ${f} (UTF-16LE suggest)`);
    const lines = readUtf16Csv(filePath);
    const seedKW = seedKwFromFilename(f);
    const rows = linesToRows(lines).map(r => ({ ...r, シードKW: seedKW, _sourceFile: f, _fetchedAt: fetchedAt }));
    suggestRows.push(...rows);
    console.log(`     → ${rows.length} 件 (seedKW: ${seedKW})`);

  } else if (f.startsWith('rakkokeyword_influxKeywords_')) {
    console.log(`  📄 ${f} (UTF-16LE influx)`);
    const lines = readUtf16Csv(filePath);
    const rows = linesToRows(lines);
    influxGroups.push({ sourceFile: f, fetchedAt, rowCount: rows.length, rows });
    console.log(`     → ${rows.length} 件`);
  }
}

// --- 重複排除（suggestKeywords: キーワード+シードKW でユニーク化） ---
console.log('\n🔧 suggestKeywords の重複を排除中...');
const seen = new Set();
const suggestUnique = suggestRows.filter(r => {
  const key = `${r['キーワード']}::${r['シードKW']}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
console.log(`  ${suggestRows.length} 件 → ${suggestUnique.length} 件（-${suggestRows.length - suggestUnique.length} 重複削除）`);

// keyword-research-all.csv も同じキーワードが含まれる場合は上書きしない（シードKW情報があるためsuggestを優先）
console.log('\n🔧 keyword-research-all.csv と suggestKeywords をマージ中...');
const suggestKwSet = new Set(suggestRows.map(r => r['キーワード']));
const allResearchUnique = allResearchRows.filter(r => !suggestKwSet.has(r['キーワード']));
console.log(`  keyword-research-all: ${allResearchRows.length} 件 → suggest と重複除外後 ${allResearchUnique.length} 件`);

// --- 出力 JSON 構築 ---
const output = {
  lastUpdated: '2026-05-25',
  note: 'ラッコキーワードAPI実データ統合版。suggestKeywords・influxKeywords・allResearchKeywords の全データを保持。',
  existingArticles: base.existingArticles,
  stats: {
    suggestKeywordsTotal: suggestUnique.length,
    allResearchKeywordsTotal: allResearchUnique.length,
    influxGroupsTotal: influxGroups.length,
    influxKeywordsTotal: influxGroups.reduce((s, g) => s + g.rowCount, 0),
    apiResultsTotal: base.results.reduce((s, r) => s + (r.keywords?.length ?? 0), 0),
  },
  // ラッコAPI（旧 keyword-research.json の results[]）
  apiResults: base.results,
  // suggestKeywords（全ファイル統合・重複除外）
  // カラム: No, 区分, 単語数, キーワード, SEO難易度, 月間検索数, CPC ($), 競合性, 出現時期, シードKW, _sourceFile, _fetchedAt
  suggestKeywords: suggestUnique,
  // keyword-research-all.csv（suggestと重複しない行のみ）
  // カラム: No, 区分, 単語数, キーワード, SEO難易度, 月間検索数, CPC ($), 競合性, 出現時期, シードKW
  allResearchKeywords: allResearchUnique,
  // influxKeywords（ファイル単位・全行保持）
  // カラム: No, キーワード, SEO難易度, 月間検索数, 検索順位, 推定流入数, CPC ($), 競合性, URL
  influxKeywords: influxGroups,
};

fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2), 'utf8');

const fileSizeMb = (fs.statSync(OUT_JSON).size / 1024 / 1024).toFixed(2);
console.log(`\n✅ 出力: ${OUT_JSON} (${fileSizeMb} MB)`);
console.log('\n📊 統計:');
console.log(`  suggestKeywords: ${output.stats.suggestKeywordsTotal} 件`);
console.log(`  allResearchKeywords (重複除外済み): ${output.stats.allResearchKeywordsTotal} 件`);
console.log(`  influxKeywords: ${output.stats.influxGroupsTotal} グループ / ${output.stats.influxKeywordsTotal} 件`);
console.log(`  APIResults (旧keyword-research.json): ${output.stats.apiResultsTotal} 件`);
