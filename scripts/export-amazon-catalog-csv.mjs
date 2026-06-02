import fs from 'node:fs';

const SRC = 'data/ugreen/amazon-ugreen-catalog.json';
const OUT = 'data/ugreen/amazon-ugreen-catalog.csv';

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = String(v).replace(/\r?\n/g, ' / ').replace(/\s+/g, ' ').trim();
  if (/[",]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function pickMainWatt(title) {
  const t = title || '';
  const matches = [...t.matchAll(/(\d{2,4})\s*[Ww](?![a-z])/g)].map((m) => parseInt(m[1], 10)).filter((v) => v >= 5 && v <= 3000);
  if (!matches.length) return null;
  return Math.max(...matches);
}

function pickMah(title) {
  const t = (title || '').replace(/(\d),(\d)/g, '$1$2');
  const matches = [...t.matchAll(/(\d{4,6})\s*mah/gi)].map((m) => parseInt(m[1], 10)).filter((v) => v >= 1000);
  if (!matches.length) return null;
  return Math.max(...matches);
}

function pickInY(title) {
  const m = (title || '').match(/(\d{1,2})\s*[-\s]?in[-\s]?(\d{1,2})/i);
  return m ? `${m[1]}-in-${m[2]}` : null;
}

function pickCableLen(title) {
  const m = (title || '').match(/(\d+(?:\.\d+)?)\s*m\b/i);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return (v >= 0.3 && v <= 5) ? v + 'm' : null;
}

function pickFeature(title, words) {
  const t = (title || '').toLowerCase();
  for (const w of words) if (t.includes(w.toLowerCase())) return w;
  return null;
}

function classifyJP(title) {
  const t = title || '';
  // Specific accessories first
  if (/保護フィルム|スクリーン保護|screen protector|tempered glass|強化ガラス|privacy screen/i.test(t)) return 'スマホアクセサリー';
  if (/(?:ケース|case\s|case,| case$)|phone case|スマホケース|silicone case/i.test(t)) return 'スマホアクセサリー';
  if (/マウス|\bmouse\b/i.test(t)) return 'マウス';
  if (/キーボード|\bkeyboard\b/i.test(t)) return 'キーボード';
  if (/\bdac\b|\bdap\b|アンプ|amplifier|headphone amp/i.test(t)) return 'オーディオ機器';
  if (/スピーカー|\bspeaker\b/i.test(t)) return 'スピーカー';
  if (/webcam|web\s?camera|ウェブカメラ|finecam|capture\s?card/i.test(t)) return 'カメラ・キャプチャ';
  if (/トラッカー|tracker|smarttrack|finetrack|airtag/i.test(t)) return 'トラッカー';
  if (/(?:ホルダー|holder|スタンド|stand|mount)/i.test(t) && !/充電|charging|charger/i.test(t)) return 'スマホアクセサリー';
  if (/hdmi.*(?:エクステンダー|extender|switcher|スイッチャー|splitter|スプリッター|matrix)/i.test(t)) return 'HDMI関連';
  if (/\bssd\b|\bhdd\b|\bnvme\b|m\.2|enclosure|エンクロージャ|drive\s?case/i.test(t)) return 'SSD・HDDケース';
  if (/\bnas\b|router|ルーター/i.test(t)) return 'ネットワーク機器';
  if (/\blan\s?cable|ethernet\s?cable|cat[678]/i.test(t)) return 'LANケーブル';
  if (/extension\s?cable|延長ケーブル|延長コード/i.test(t)) return 'USB延長ケーブル';

  // Main categories
  if (/power\s?station|powerroam|ポータブル電源/i.test(t)) return 'ポータブル電源';
  if (/solar|ソーラー/i.test(t)) return 'ソーラーパネル';
  if (/card\s?reader|カードリーダー/i.test(t)) return 'SDカードリーダー';
  if (/車載充電|car\s?charger|カーチャージャー/i.test(t)) return '車載充電器';
  if (/モバイルバッテリー|power\s?bank|powerbank|mobile\s?battery/i.test(t)) return 'モバイルバッテリー';
  if (/ドッキング|docking|thunderbolt\s?(?:4|5)|usb-?c\s?hub|usb\s?hub|usbハブ|\bhub\b/i.test(t)) return 'USBハブ・ドック';
  if (/ワイヤレス充電|wireless\s?charg|magsafe.*(?:充電|charg)|qi2|qi充電/i.test(t)) return 'ワイヤレス充電器';
  if (/cable|ケーブル|cord/i.test(t)) return 'ケーブル';
  if (/急速充電器|急速充電|fast\s?charg|gan\s?charger|gan充電|充電器|チャージャー|charger/i.test(t)) return '充電器';
  if (/イヤホン|earphone|earbud|headphone|ヘッドホン/i.test(t)) return 'イヤホン・ヘッドホン';
  if (/bluetooth/i.test(t)) return 'Bluetoothアダプター';
  return 'その他';
}

function buildShortName(title) {
  const cat = classifyJP(title);
  const w = pickMainWatt(title);
  const mah = pickMah(title);
  const iny = pickInY(title);
  const len = pickCableLen(title);
  const parts = [];

  switch (cat) {
    case 'モバイルバッテリー':
      parts.push('モバイルバッテリー');
      if (mah) parts.push(mah.toLocaleString() + 'mAh');
      if (w) parts.push(w + 'W');
      if (pickFeature(title, ['MagSafe', 'Qi2', 'マグネット', 'magnetic'])) parts.push('MagSafe');
      break;
    case '充電器':
      parts.push('急速充電器');
      if (w) parts.push(w + 'W');
      if (pickFeature(title, ['GaN'])) parts.push('GaN');
      if (iny) parts.push(iny);
      else {
        const ports = title.match(/(\d{1,2})\s*[-\s]?(?:port|ポート)/i);
        if (ports) parts.push(ports[1] + 'ポート');
      }
      break;
    case '車載充電器':
      parts.push('車載充電器');
      if (w) parts.push(w + 'W');
      if (pickFeature(title, ['ワイヤレス', 'wireless', 'MagSafe'])) parts.push('ワイヤレス');
      break;
    case 'ワイヤレス充電器':
      parts.push('ワイヤレス充電器');
      if (w) parts.push(w + 'W');
      if (iny) parts.push(iny);
      if (pickFeature(title, ['MagSafe', 'Qi2'])) parts.push('MagSafe');
      break;
    case 'USBハブ・ドック':
      if (pickFeature(title, ['Thunderbolt 5', 'Thunderbolt5'])) parts.push('Thunderbolt 5 ドック');
      else if (pickFeature(title, ['Thunderbolt 4', 'Thunderbolt4', 'Thunderbolt'])) parts.push('Thunderbolt 4 ドック');
      else parts.push('USB-Cハブ');
      if (iny) parts.push(iny);
      if (w) parts.push(w + 'W');
      break;
    case 'ケーブル':
      if (pickFeature(title, ['Lightning'])) parts.push('Lightning ケーブル');
      else if (pickFeature(title, ['HDMI'])) parts.push('HDMI ケーブル');
      else if (pickFeature(title, ['DisplayPort', ' DP '])) parts.push('DP ケーブル');
      else if (pickFeature(title, ['USB C', 'USB-C', 'Type-C', 'Type C'])) parts.push('USB-C ケーブル');
      else if (pickFeature(title, ['USB A', 'USB-A'])) parts.push('USB-A ケーブル');
      else parts.push('ケーブル');
      if (w) parts.push(w + 'W');
      if (len) parts.push(len);
      break;
    case 'LANケーブル':
      parts.push('LAN ケーブル');
      const cat8 = title.match(/CAT([678])/i);
      if (cat8) parts.push('CAT' + cat8[1]);
      if (len) parts.push(len);
      break;
    case 'USB延長ケーブル':
      parts.push('USB 延長ケーブル');
      if (pickFeature(title, ['USB 3.0', 'USB3.0'])) parts.push('USB 3.0');
      if (len) parts.push(len);
      break;
    case 'SDカードリーダー':
      parts.push('SDカードリーダー');
      if (pickFeature(title, ['Type-C', 'Type C', 'USB-C'])) parts.push('Type-C');
      break;
    case 'ソーラーパネル':
      parts.push('ソーラーパネル');
      if (w) parts.push(w + 'W');
      break;
    case 'ポータブル電源':
      parts.push('ポータブル電源');
      if (w) parts.push(w + 'W');
      const wh = title.match(/(\d+(?:[,.]?\d+)*)\s*wh/i);
      if (wh) parts.push(wh[1].replace(/[,.](?=\d{3})/g, '') + 'Wh');
      break;
    case 'イヤホン・ヘッドホン':
      parts.push('イヤホン');
      if (pickFeature(title, ['Bluetooth'])) parts.push('Bluetooth');
      if (pickFeature(title, ['ノイズキャンセリング', 'ANC', 'noise cancel'])) parts.push('ANC');
      break;
    case 'トラッカー':
      parts.push('スマートトラッカー');
      const m = (title || '').match(/(SmartTrack|Smarttrack|FineTrack)/i);
      if (m) parts.push(m[1]);
      break;
    case 'Bluetoothアダプター':
      parts.push('Bluetoothアダプター');
      const bt = title.match(/Bluetooth\s*(\d\.\d)/i);
      if (bt) parts.push('v' + bt[1]);
      break;
    case 'スマホアクセサリー':
      if (pickFeature(title, ['保護フィルム', 'スクリーン保護', 'screen protector', '強化ガラス', 'privacy screen'])) parts.push('スクリーン保護フィルム');
      else if (pickFeature(title, ['ケース', 'case'])) parts.push('スマホケース');
      else if (pickFeature(title, ['ホルダー', 'holder', 'スタンド', 'stand', 'mount'])) parts.push('スマホホルダー');
      else parts.push('スマホアクセサリー');
      if (pickFeature(title, ['MagSafe'])) parts.push('MagSafe');
      break;
    case 'マウス':
      parts.push('マウス');
      if (pickFeature(title, ['ワイヤレス', 'wireless'])) parts.push('ワイヤレス');
      const dpi = title.match(/(\d{3,5})\s*dpi/i);
      if (dpi) parts.push(dpi[1] + 'DPI');
      break;
    case 'キーボード':
      parts.push('キーボード');
      if (pickFeature(title, ['ワイヤレス', 'wireless'])) parts.push('ワイヤレス');
      break;
    case 'オーディオ機器':
      if (pickFeature(title, ['DAC'])) parts.push('DAC');
      else if (pickFeature(title, ['DAP'])) parts.push('DAP');
      else if (pickFeature(title, ['アンプ', 'amplifier', 'amp'])) parts.push('アンプ');
      else parts.push('オーディオ機器');
      break;
    case 'スピーカー':
      parts.push('スピーカー');
      if (pickFeature(title, ['Bluetooth'])) parts.push('Bluetooth');
      break;
    case 'カメラ・キャプチャ':
      if (pickFeature(title, ['webcam', 'ウェブカメラ', 'WebCam', 'FineCam'])) parts.push('Webカメラ');
      else if (pickFeature(title, ['capture', 'キャプチャ'])) parts.push('キャプチャカード');
      else parts.push('カメラ');
      break;
    case 'HDMI関連':
      if (pickFeature(title, ['エクステンダー', 'extender'])) parts.push('HDMIエクステンダー');
      else if (pickFeature(title, ['switcher', 'スイッチャー'])) parts.push('HDMIスイッチャー');
      else if (pickFeature(title, ['splitter', 'スプリッター'])) parts.push('HDMIスプリッター');
      else parts.push('HDMI関連');
      break;
    case 'SSD・HDDケース':
      parts.push('SSD/HDDケース');
      if (pickFeature(title, ['NVMe'])) parts.push('NVMe');
      else if (pickFeature(title, ['M.2'])) parts.push('M.2');
      else if (pickFeature(title, ['SATA'])) parts.push('SATA');
      break;
    case 'ネットワーク機器':
      if (pickFeature(title, ['NAS'])) parts.push('NAS');
      else if (pickFeature(title, ['router', 'ルーター'])) parts.push('ルーター');
      else parts.push('ネットワーク機器');
      break;
    default:
      const cleaned = (title || '').replace(/^(UGREEN|UGREEB|Ugreen)[\s\-,]*/i, '').split(/[,、]/)[0].slice(0, 40);
      parts.push(cleaned);
  }

  return parts.join(' ');
}

function getModelNumber(p) {
  const a = p.attributes?.find((at) => /model.?number|品番|model.?no|製造元参照番号/i.test(at.key || ''));
  return a?.value || '';
}

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const headers = [
  'ASIN',
  '商品名（簡潔）',
  'カテゴリ',
  '価格(JPY)',
  '元価格(JPY)',
  '星評価',
  'レビュー数',
  '月間販売数',
  '型番',
  '在庫',
  '商品URL',
  'メイン画像',
  '元タイトル',
];

const rows = data.map((p) => [
  p.asin,
  buildShortName(p.title),
  classifyJP(p.title),
  p.price?.value || '',
  p.listPrice?.value || '',
  p.stars || '',
  p.reviewsCount || '',
  p.monthlyPurchaseVolume || '',
  getModelNumber(p),
  p.inStockText || (p.inStock === true ? '在庫あり' : p.inStock === false ? '在庫なし' : ''),
  p.url || `https://www.amazon.co.jp/dp/${p.asin}`,
  p.thumbnailImage || '',
  p.title || '',
].map(csvCell).join(','));

const csv = '﻿' + headers.join(',') + '\r\n' + rows.join('\r\n') + '\r\n';
fs.writeFileSync(OUT, csv);
console.log(`Wrote ${rows.length} rows × ${headers.length} cols to ${OUT}`);

// Category breakdown
const cats = new Map();
data.forEach((p) => {
  const c = classifyJP(p.title);
  cats.set(c, (cats.get(c) || 0) + 1);
});
console.log('\nCategory distribution:');
[...cats.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log('  ' + n + ' | ' + k));
