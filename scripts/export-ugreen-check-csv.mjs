import fs from 'node:fs';

const SRC = 'data/ugreen/ugreen-jp-products-enriched.json';
const MATCHES_FILE = 'data/ugreen/ugreen-aliexpress-matches.json';
const AMZ_FILE = 'data/ugreen/amazon-ugreen-catalog.json';
const ASIN_FILE = 'data/ugreen/ugreen-asin-list.json';
const OUT = 'data/ugreen/ugreen-check.csv';

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/\r?\n/g, ' / ').replace(/\s+/g, ' ').trim();
  if (/[",]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const matches = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf8'));
const byHandle = new Map(matches.map((m) => [m.handle, m]));
const amzCatalog = JSON.parse(fs.readFileSync(AMZ_FILE, 'utf8'));
const amzByAsin = new Map(amzCatalog.map((p) => [p.asin, p]));
const asinList = JSON.parse(fs.readFileSync(ASIN_FILE, 'utf8'));
const asinByHandle = new Map(asinList.map((a) => [a.handle, a.asin]));

function classifyJP(title, productType) {
  const t = (title || '').toLowerCase();
  const pt = (productType || '').toLowerCase();
  if (/power\s?station|powerroam|ポータブル電源/i.test(title + ' ' + pt)) return 'ポータブル電源';
  if (/solar|ソーラー/i.test(title)) return 'ソーラーパネル';
  if (/card\s?reader|カードリーダー|sdカード/i.test(title)) return 'SDカードリーダー';
  if (/車載|car\s?charger|カーチャージャー/i.test(title)) return '車載充電器';
  if (/モバイルバッテリー|power\s?bank|powerbank|mobile\s?battery/i.test(title + ' ' + pt)) return 'モバイルバッテリー';
  if (/ドッキング|thunderbolt|docking|ハブ|hub/i.test(title)) return 'USBハブ・ドック';
  if (/ワイヤレス|wireless|magsafe|qi2|qi充電/i.test(title)) return 'ワイヤレス充電器';
  if (/ケーブル|cable/i.test(title)) return 'ケーブル';
  if (/充電器|チャージャー|charger/i.test(title)) return '充電器';
  return 'その他';
}

const headers = [
  '商品名',
  'カテゴリ',
  'AmazonURL',
  'AliExpressURL',
  'マッチング精度',
  'Amazon価格',
  'Amazon型番',
  // 補助カラム
  'AmazonEnglishTitle',
  'AliExpressTitle',
];

const rows = data.map((p) => {
  const r = p.retailLinks || {};
  const match = byHandle.get(p.handle);
  const asin = asinByHandle.get(p.handle);
  const amz = asin ? amzByAsin.get(asin) : null;
  const modelAttr = amz?.attributes?.find((a) => /model.?number|製造元参照番号|品番|model.?no/i.test(a.key || ''));

  const amazonUrl = asin ? `https://www.amazon.co.jp/dp/${asin}` : (r.amazon || '');
  const aeUrl = match?.bestMatch?.promotion_link || match?.bestMatch?.url || '';
  const confidence = match?.confidence || 'low';
  const amzPrice = amz?.price?.value ? `${amz.price.currency}${amz.price.value.toLocaleString()}` : '';
  const amzModel = modelAttr?.value || '';

  const category = classifyJP(p.title, p.productType);

  return [
    p.title,
    category,
    amazonUrl,
    aeUrl,
    confidence,
    amzPrice,
    amzModel,
    amz?.title || '',
    match?.bestMatch?.title || '',
  ].map(csvCell).join(',');
});

const csv = '﻿' + headers.join(',') + '\r\n' + rows.join('\r\n') + '\r\n';
fs.writeFileSync(OUT, csv);
console.log(`Wrote ${rows.length} rows to ${OUT}`);

const cf = { high: 0, medium: 0, low: 0 };
matches.forEach((m) => cf[m.confidence]++);
console.log(`High: ${cf.high}, Medium: ${cf.medium}, Low: ${cf.low}`);
