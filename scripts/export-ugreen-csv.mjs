import fs from 'node:fs';

const SRC = 'data/ugreen/ugreen-jp-products-enriched.json';
const MATCHES_FILE = 'data/ugreen/ugreen-aliexpress-matches.json';
const AMZ_FILE = 'data/ugreen/amazon-ugreen-catalog.json';
const ASIN_FILE = 'data/ugreen/ugreen-asin-list.json';
const OUT = 'data/ugreen/ugreen-jp-products.csv';

let matches = [];
try { matches = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf8')); } catch {}
const byHandle = new Map(matches.map((m) => [m.handle, m]));

let amzCatalog = [];
try { amzCatalog = JSON.parse(fs.readFileSync(AMZ_FILE, 'utf8')); } catch {}
const amzByAsin = new Map(amzCatalog.map((p) => [p.asin, p]));

let asinList = [];
try { asinList = JSON.parse(fs.readFileSync(ASIN_FILE, 'utf8')); } catch {}
const asinByHandle = new Map(asinList.map((a) => [a.handle, a.asin]));

function getAmazonInfo(handle) {
  const asin = asinByHandle.get(handle);
  if (!asin) return { asin: '', title: '', model: '', price: '' };
  const a = amzByAsin.get(asin);
  if (!a) return { asin, title: '', model: '', price: '' };
  const modelAttr = a.attributes?.find((at) => /model.?number|製造元参照番号|品番|model.?no/i.test(at.key || ''));
  return {
    asin,
    title: a.title || '',
    model: modelAttr?.value || '',
    price: a.price?.value ? `${a.price.currency}${a.price.value}` : '',
  };
}

const TOP_SPEC_KEYS = [
  '製品型番',
  '商品重量',
  'サイズ',
  '製品サイズ',
  '商品の寸法',
  '対応機種',
  'USBポートの総数',
  'ポート数',
  '容量mAh',
  '入力',
  '出力',
  '合計出力',
  'ワット数',
  '入力電圧',
  'ケーブル長',
  'その他機能',
];

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/\r?\n/g, ' / ').replace(/\s+/g, ' ').trim();
  if (/[",]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const headers = [
  'id', 'handle', 'title', 'productType', 'tags', 'url',
  'metaDescription', 'description',
  'amazon', 'amazonAsin', 'amazonEnglishTitle', 'amazonModelNumber', 'amazonPrice',
  'rakuten', 'yodobashi', 'bic',
  'aliexpress', 'aliexpressTitle', 'aliexpressConfidence', 'aliexpressScore', 'aliexpressMatchReasons',
  ...TOP_SPEC_KEYS,
  'otherSpecs',
  'imageCount', 'firstImage',
];

const rows = data.map((p) => {
  const r = p.retailLinks || {};
  const specs = p.specs || {};
  const used = new Set(TOP_SPEC_KEYS);
  const otherSpecs = Object.entries(specs)
    .filter(([k]) => !used.has(k))
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');

  const match = byHandle.get(p.handle);
  const aeUrl = match?.bestMatch?.promotion_link || match?.bestMatch?.url || '';
  const aeTitle = match?.bestMatch?.title || '';
  const aeConf = match?.confidence || 'low';
  const aeScore = match?.bestMatch?.score ?? '';
  const aeReasons = match?.bestMatch?.reasons?.join(' | ') || '';
  const amz = getAmazonInfo(p.handle);

  return [
    p.id,
    p.handle,
    p.title,
    p.productType,
    (p.tags || []).join(';'),
    p.url,
    p.metaDescription,
    p.description,
    r.amazon || '',
    amz.asin,
    amz.title,
    amz.model,
    amz.price,
    r.rakuten || '',
    r.yodobashi || '',
    r.bic || '',
    aeUrl,
    aeTitle,
    aeConf,
    aeScore,
    aeReasons,
    ...TOP_SPEC_KEYS.map((k) => specs[k] || ''),
    otherSpecs,
    (p.images || []).length,
    (p.images || [])[0]?.src || (p.images || [])[0] || '',
  ].map(csvCell).join(',');
});

const csv = '﻿' + headers.join(',') + '\r\n' + rows.join('\r\n') + '\r\n';
fs.writeFileSync(OUT, csv);
console.log(`Wrote ${rows.length} rows × ${headers.length} cols to ${OUT}`);
