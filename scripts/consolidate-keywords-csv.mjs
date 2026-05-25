/**
 * キーワードデータ統合 → CSV 出力
 * data/keyword-csvs/ の全ファイルを1枚の CSV に統合
 * 出力: data/keyword-all.csv (UTF-8 BOM, タブ区切り)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CSV_DIR = path.join(ROOT, 'data', 'keyword-csvs');
const OUT_CSV = path.join(ROOT, 'data', 'keyword-all.csv');

const parseTsvLine = (line) =>
  line.split('\t').map(v => v.replace(/^"|"$/g, '').trim());

const readUtf8Csv = (filePath) =>
  fs.readFileSync(filePath, 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());

const readUtf16Csv = (filePath) =>
  fs.readFileSync(filePath).toString('utf16le').replace(/^﻿/, '').split(/\r?\n/).filter(l => l.trim());

const linesToRows = (lines) => {
  const headers = parseTsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseTsvLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });
};

const dateFromFilename = (f) => { const m = f.match(/(\d{4}-\d{2}-\d{2})/); return m ? m[1] : '2026-05-25'; };
const seedKwFromFilename = (f) => {
  const m = path.basename(f, '.csv').match(/^rakkokeyword_suggestKeywords_(.+)_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}$/);
  return m ? m[1] : '';
};

// 全カラム定義（ユニオン）
const COLUMNS = [
  'データ種別', 'シードKW', 'ソースファイル', '取得日',
  'No', '区分', '単語数', 'キーワード',
  'SEO難易度', '月間検索数', 'CPC ($)', '競合性', '出現時期',
  '検索順位', '推定流入数', 'URL',
];

const rows = [];

const csvFiles = fs.readdirSync(CSV_DIR).filter(f => f.endsWith('.csv')).sort();

for (const f of csvFiles) {
  const filePath = path.join(CSV_DIR, f);
  const fetchedAt = dateFromFilename(f);

  if (f === 'keyword-research-all.csv') {
    console.log(`📄 ${f}`);
    const lines = readUtf8Csv(filePath);
    for (const r of linesToRows(lines)) {
      rows.push({
        データ種別: 'suggest',
        シードKW: r['シードKW'] ?? '',
        ソースファイル: f,
        取得日: fetchedAt,
        No: r['No'] ?? '',
        区分: r['区分'] ?? '',
        単語数: r['単語数'] ?? '',
        キーワード: r['キーワード'] ?? '',
        SEO難易度: r['SEO難易度'] ?? '',
        月間検索数: r['月間検索数'] ?? '',
        'CPC ($)': r['CPC ($)'] ?? '',
        競合性: r['競合性'] ?? '',
        出現時期: r['出現時期'] ?? '',
        検索順位: '',
        推定流入数: '',
        URL: '',
      });
    }
    console.log(`   → ${rows.length} 件追加`);

  } else if (f.startsWith('rakkokeyword_suggestKeywords_')) {
    console.log(`📄 ${f}`);
    const prev = rows.length;
    const lines = readUtf16Csv(filePath);
    const seedKW = seedKwFromFilename(f);
    for (const r of linesToRows(lines)) {
      rows.push({
        データ種別: 'suggest',
        シードKW: seedKW,
        ソースファイル: f,
        取得日: fetchedAt,
        No: r['No'] ?? '',
        区分: r['区分'] ?? '',
        単語数: r['単語数'] ?? '',
        キーワード: r['キーワード'] ?? '',
        SEO難易度: r['SEO難易度'] ?? '',
        月間検索数: r['月間検索数'] ?? '',
        'CPC ($)': r['CPC ($)'] ?? '',
        競合性: r['競合性'] ?? '',
        出現時期: r['出現時期'] ?? '',
        検索順位: '',
        推定流入数: '',
        URL: '',
      });
    }
    console.log(`   → ${rows.length - prev} 件追加`);

  } else if (f.startsWith('rakkokeyword_influxKeywords_')) {
    console.log(`📄 ${f}`);
    const prev = rows.length;
    const lines = readUtf16Csv(filePath);
    for (const r of linesToRows(lines)) {
      rows.push({
        データ種別: 'influx',
        シードKW: '',
        ソースファイル: f,
        取得日: fetchedAt,
        No: r['No'] ?? '',
        区分: '',
        単語数: '',
        キーワード: r['キーワード'] ?? '',
        SEO難易度: r['SEO難易度'] ?? '',
        月間検索数: r['月間検索数'] ?? '',
        'CPC ($)': r['CPC ($)'] ?? '',
        競合性: r['競合性'] ?? '',
        出現時期: '',
        検索順位: r['検索順位'] ?? '',
        推定流入数: r['推定流入数'] ?? '',
        URL: r['URL'] ?? '',
      });
    }
    console.log(`   → ${rows.length - prev} 件追加`);
  }
}

// CSV 書き出し（UTF-8 BOM、タブ区切り）
const BOM = '﻿';
const header = COLUMNS.join('\t');
const body = rows.map(r => COLUMNS.map(c => {
  const v = String(r[c] ?? '');
  // タブ・改行を含む場合はダブルクォートで囲む
  return v.includes('\t') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
}).join('\t'));

fs.writeFileSync(OUT_CSV, BOM + header + '\n' + body.join('\n'), 'utf8');

const sizeMb = (fs.statSync(OUT_CSV).size / 1024 / 1024).toFixed(2);
console.log(`\n✅ 出力: ${OUT_CSV}`);
console.log(`   総行数: ${rows.length.toLocaleString()} 件 / ${sizeMb} MB`);
console.log(`   カラム: ${COLUMNS.join(', ')}`);
