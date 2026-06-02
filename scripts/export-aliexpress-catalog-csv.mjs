import fs from 'node:fs';

const SRC = 'data/ugreen/aliexpress-store-catalog.json';
const OUT = 'data/ugreen/aliexpress-store-catalog.csv';

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
  // Highest watt is usually the headline spec
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
      if (pickFeature(title, ['MagSafe', 'Qi2', 'マグネット'])) parts.push('MagSafe');
      break;
    case '充電器':
      parts.push('急速充電器');
      if (w) parts.push(w + 'W');
      if (pickFeature(title, ['GaN'])) parts.push('GaN');
      if (iny) parts.push(iny);
      else {
        const ports = title.match(/(\d{1,2})\s*ポート|(\d{1,2})\s*[-\s]?port/i);
        const pn = ports?.[1] || ports?.[2];
        if (pn) parts.push(pn + 'ポート');
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
      // Detect cable type
      if (pickFeature(title, ['Lightning'])) parts.push('Lightning ケーブル');
      else if (pickFeature(title, ['HDMI'])) parts.push('HDMI ケーブル');
      else if (pickFeature(title, ['DisplayPort', ' DP '])) parts.push('DP ケーブル');
      else if (pickFeature(title, ['LAN', 'CAT8', 'Ethernet'])) parts.push('LAN ケーブル');
      else if (pickFeature(title, ['USB C', 'USB-C', 'Type-C', 'Type C'])) parts.push('USB-C ケーブル');
      else if (pickFeature(title, ['USB A', 'USB-A'])) parts.push('USB-A ケーブル');
      else parts.push('ケーブル');
      if (w) parts.push(w + 'W');
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
      if (pickFeature(title, ['ノイズキャンセリング', 'ANC'])) parts.push('ANC');
      break;
    case 'トラッカー':
      parts.push('スマートトラッカー');
      if (pickFeature(title, ['SmartTrack', 'Smarttrack', 'FineTrack'])) {
        const m = title.match(/(SmartTrack|Smarttrack|FineTrack)/i);
        if (m) parts.push(m[1]);
      }
      break;
    case 'Bluetoothアダプター':
      parts.push('Bluetoothアダプター');
      const bt = title.match(/Bluetooth\s*(\d\.\d)/i);
      if (bt) parts.push('v' + bt[1]);
      break;
    case 'スマホアクセサリー':
      if (pickFeature(title, ['保護フィルム', 'スクリーン保護', 'screen protector', '強化ガラス', 'tempered'])) parts.push('スクリーン保護フィルム');
      else if (pickFeature(title, ['ケース', 'case'])) parts.push('スマホケース');
      else if (pickFeature(title, ['ホルダー', 'holder', 'スタンド', 'stand'])) parts.push('スマホホルダー');
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
      else if (pickFeature(title, ['アンプ', 'amp'])) parts.push('アンプ');
      else parts.push('オーディオ機器');
      break;
    case 'スピーカー':
      parts.push('スピーカー');
      if (pickFeature(title, ['Bluetooth'])) parts.push('Bluetooth');
      break;
    case 'カメラ・キャプチャ':
      if (pickFeature(title, ['webcam', 'ウェブカメラ', 'WebCam'])) parts.push('Webカメラ');
      else if (pickFeature(title, ['capture', 'キャプチャ'])) parts.push('キャプチャ');
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
      const cleaned = (title || '').replace(/^(UGREEN|UGREEB|Ugreen)[\s\-]*/i, '').split(/[,、]/)[0].slice(0, 40);
      parts.push(cleaned);
  }

  return parts.join(' ');
}

function classifyJP(title) {
  const t = title || '';
  // === Exclusion gates first (specific non-charging accessories) ===
  if (/保護フィルム|スクリーン保護|screen protector|tempered glass|強化ガラス/i.test(t)) return 'スマホアクセサリー';
  if (/ケース|case\s|case,|phone case|スマホケース/i.test(t)) return 'スマホアクセサリー';
  if (/マウス|mouse(?!\s?pad)/i.test(t)) return 'マウス';
  if (/キーボード|keyboard/i.test(t)) return 'キーボード';
  if (/dac|dap|アンプ|amplifier/i.test(t)) return 'オーディオ機器';
  if (/スピーカー|speaker/i.test(t)) return 'スピーカー';
  if (/カメラ|camera|webcam|capture/i.test(t)) return 'カメラ・キャプチャ';
  if (/トラッカー|tracker|smarttrack|finetrack|airtag/i.test(t)) return 'トラッカー';
  // Phone holders/stands (not chargers)
  if (/(?:ホルダー|holder|スタンド|stand)/i.test(t) && !/充電|charging|charger/i.test(t)) return 'スマホアクセサリー';
  // HDMI extender/switcher/splitter
  if (/hdmi.*(?:エクステンダー|extender|switcher|スイッチャー|splitter|スプリッター|matrix)/i.test(t)) return 'HDMI関連';
  // SSD/HDD enclosures
  if (/ssd|hdd|nvme|m\.2|エンクロージャ|enclosure/i.test(t)) return 'SSD・HDDケース';
  // NAS/network
  if (/\bnas\b|router|ルーター/i.test(t)) return 'ネットワーク機器';

  // === Main categories ===
  if (/power\s?station|powerroam|ポータブル電源/i.test(t)) return 'ポータブル電源';
  if (/solar|ソーラー/i.test(t)) return 'ソーラーパネル';
  if (/card\s?reader|カードリーダー|sdカードリーダー/i.test(t)) return 'SDカードリーダー';
  if (/車載充電|car\s?charger|カーチャージャー/i.test(t)) return '車載充電器';
  if (/モバイルバッテリー|power\s?bank|powerbank|mobile\s?battery|モバイル.*バッテリー/i.test(t)) return 'モバイルバッテリー';
  if (/ドッキング|docking|thunderbolt\s?(?:4|5)|ハブ|\bhub\b|usb hub/i.test(t)) return 'USBハブ・ドック';
  if (/ワイヤレス充電|wireless\s?charg|magsafe.*(?:充電|charg)|qi2|qi充電/i.test(t)) return 'ワイヤレス充電器';
  if (/ケーブル|cable|cord/i.test(t)) return 'ケーブル';
  if (/急速充電器|急速充電|fast\s?charg|gan充電|gan\s?charger|充電器|チャージャー|charger/i.test(t)) return '充電器';
  if (/イヤホン|earphone|earbud|headphone|ヘッドホン/i.test(t)) return 'イヤホン・ヘッドホン';
  if (/bluetooth/i.test(t)) return 'Bluetoothアダプター';
  return 'その他';
}

const data = JSON.parse(fs.readFileSync(SRC, 'utf8'))
  .filter((p) => Number(p.lastest_volume || 0) >= 300);

const headers = [
  'product_id',
  '商品名（簡潔）',
  'カテゴリ',
  '販売価格(JPY)',
  '元価格(JPY)',
  '割引',
  '評価',
  '直近販売数',
  '商品URL',
  'アフィリエイトURL',
  'メイン画像',
  'カテゴリ大',
  'カテゴリ中',
  'shop_id',
  'shop_name',
  '元タイトル',
];

const rows = data.map((p) => [
  p.product_id,
  buildShortName(p.product_title),
  classifyJP(p.product_title),
  p.target_sale_price,
  p.target_original_price,
  p.discount,
  p.evaluate_rate,
  p.lastest_volume,
  p.product_detail_url,
  p.promotion_link,
  p.product_main_image_url,
  p.first_level_category_name,
  p.second_level_category_name,
  p.shop_id,
  p.shop_name,
  p.product_title,
].map(csvCell).join(','));

const csv = '﻿' + headers.join(',') + '\r\n' + rows.join('\r\n') + '\r\n';
fs.writeFileSync(OUT, csv);
console.log(`Wrote ${rows.length} rows × ${headers.length} cols to ${OUT}`);
