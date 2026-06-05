/**
 * UGREEN記事リライト用のリサーチJSON生成（複数記事を1スクリプトで処理）
 * Usage: node scripts/build-ugreen-rewrite-research.mjs <slug>
 */
import fs from 'node:fs';

const slug = process.argv[2];
if (!slug) { console.error('Usage: node ... <slug>'); process.exit(1); }

const PLAN_FILE = `data/articles/${slug}-plan.json`;
const OUT = `data/articles/${slug}-research.json`;

const JP_FILE = 'data/ugreen/ugreen-jp-products-enriched.json';
const JP_AFFILIATE_CSV = 'data/ugreen/ugreen-jp-products3.csv';
const AMZ_FILE = 'data/ugreen/amazon-ugreen-catalog.json';
const AE_FILE = 'data/ugreen/aliexpress-store-catalog.json';
const REVIEWS_FILE = 'data/ugreen/review-parsed.json';

// 記事ごとの採用商品リスト
const PICKS_BY_SLUG = {
  'ugreen-gan-charger-osusume': [
    { asin: 'B0BZHZ56M9', role: '入門・iPhone単体' },
    { asin: 'B0CY56KRCX', role: 'MacBook Air・iPad万能' },
    { asin: 'B0CYZ52VPX', role: '4ポート同時充電' },
    { asin: 'B0D3XR6S47', role: 'MacBook Pro 100W' },
    { asin: 'B0B129DM9T', role: '140W大出力 ノートPC2台' },
  ],
  // AliExpressコーナー商品（slug別に追加）
  _aePicks: {
    'ugreen-gan-charger-osusume': [
      { product_id: '1005008702713918', role: '入門・iPhone単体 (10,823販売)' },
      { product_id: '1005009570758626', role: '万能W数切替型 (2,165販売)' },
      { product_id: '1005009118633225', role: '45W単機種 (1,682販売)' },
      { product_id: '1005008453117301', role: '3ポートPD3.0 (1,410販売)' },
    ],
    'ugreen-cable-osusume': [
      { product_id: '1005006982273210', role: '最人気USB-C 5A E-Marker (4,479販売)' },
      { product_id: '1005007707979951', role: 'PD100W定番 (4,122販売)' },
      { product_id: '1005007423436752', role: '8K HDMI 48Gbps (2,065販売)' },
      { product_id: '1005007706171004', role: 'UNO PD100W (1,164販売)' },
    ],
    'ugreen-docking-station-osusume': [
      { product_id: '1005007227813985', role: 'トリプルディスプレイ 8-in-1 100W (2,256販売)' },
      { product_id: '1005010255498921', role: 'Steam Deck 6-in-1 100W (1,515販売)' },
      { product_id: '1005009126321747', role: 'USB3.0 + Ethernet (1,133販売)' },
      { product_id: '1005007433155726', role: '4ポート USB-A スプリッター (1,122販売)' },
    ],
  },
  'ugreen-cable-osusume': [
    { asin: 'B07PYP57TQ', role: 'Lightning ケーブル定番' },
    { asin: 'B07V78HMDQ', role: 'USB-C/C 100W 長さ豊富' },
    { asin: 'B07PP2RB25', role: 'USB-A to USB-C 急速' },
    { asin: 'B083Q4SHPT', role: 'L型 100W スマート配線' },
    { asin: 'B0BHY76Y1K', role: 'PD3.1 240W MacBook Pro用' },
  ],
  'ugreen-docking-station-osusume': [
    { asin: 'B0BR3M8XHK', role: '5-in-1 入門・万能ハブ' },
    { asin: 'B0D1XLNWP2', role: '6-in-1 100W' },
    { asin: 'B0BXDQS4BD', role: 'Pro 10-in-1 多機能' },
    { asin: 'B0D2Q5XJY9', role: 'Uno 6-in-1 軽量' },
    { asin: 'B0BNBJFFB2', role: 'Revodok 9-in-1' },
  ],
  'ugreen-earphone-osusume': [
    { asin: 'B0DMZWD4JP', role: 'イヤーカフ型・2,400円・5,168件レビュー' },
  ],
};

const picks = PICKS_BY_SLUG[slug];
if (!picks) { console.error('No picks defined for slug:', slug); process.exit(1); }
const aePicks = PICKS_BY_SLUG._aePicks?.[slug] || [];

const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
const jpProducts = JSON.parse(fs.readFileSync(JP_FILE, 'utf8'));
const amzProducts = JSON.parse(fs.readFileSync(AMZ_FILE, 'utf8'));
const aeProducts = fs.existsSync(AE_FILE) ? JSON.parse(fs.readFileSync(AE_FILE, 'utf8')) : [];
const aeByPid = new Map(aeProducts.map((p) => [String(p.product_id), p]));
const reviewsData = fs.existsSync(REVIEWS_FILE) ? JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8')) : {};

function parseCsv(s) {
  return s.split(/\r?\n/).filter(Boolean).map((l) => {
    const c = []; let cur = ''; let q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { q = !q; continue; }
      if (ch === ',' && !q) { c.push(cur); cur = ''; continue; }
      cur += ch;
    }
    c.push(cur);
    return c;
  });
}

const csvRows = parseCsv(fs.readFileSync(JP_AFFILIATE_CSV, 'utf8'));
const affiliateByAsin = new Map();
csvRows.slice(1).forEach((row) => {
  const amazonUrl = row[8];
  const affiliate = row[9];
  const m = amazonUrl?.match(/\/dp\/([A-Z0-9]{10})/);
  if (m && affiliate && affiliate !== 'なし' && /^https?:/.test(affiliate)) {
    affiliateByAsin.set(m[1], affiliate);
  }
});

const jpByAsin = new Map();
jpProducts.forEach((p) => {
  const m = p.retailLinks?.amazon?.match(/\/dp\/([A-Z0-9]{10})/);
  if (m) jpByAsin.set(m[1], p);
});
const amzByAsin = new Map(amzProducts.map((p) => [p.asin, p]));

function pickReviews(reviews, mode = 'standard') {
  if (!reviews || reviews.length === 0) return [];
  const sorted = [...reviews].sort((a, b) => (b.helpful || 0) - (a.helpful || 0));
  const limits = mode === 'deep' ? { high: 5, low: 5 } : { high: 2, low: 1 };
  const high = sorted.filter((r) => r.rating >= 4).slice(0, limits.high);
  const low = sorted.filter((r) => r.rating <= 3).slice(0, limits.low);
  return [...high, ...low];
}

// 単一商品深堀り型の記事には deep モード
const DEEP_REVIEW_SLUGS = new Set(['ugreen-earphone-osusume']);
const reviewMode = DEEP_REVIEW_SLUGS.has(slug) ? 'deep' : 'standard';

function buildProduct(pick) {
  const amzData = amzByAsin.get(pick.asin);
  const jpData = jpByAsin.get(pick.asin);
  const affiliate = affiliateByAsin.get(pick.asin);
  const reviews = pickReviews(reviewsData[pick.asin]?.reviews || [], reviewMode);
  const modelAttr = amzData?.attributes?.find((a) => /model.?number|品番|model.?no|製造元参照番号/i.test(a.key || ''));
  const modelNo = modelAttr?.value || '';

  const ugreenImages = jpData?.images?.urls?.slice(0, 6) || [];
  const amzImages = amzData?.highResolutionImages || amzData?.galleryThumbnails || [];
  const images = ugreenImages.length > 0 ? ugreenImages
    : amzImages.length > 0 ? amzImages
    : (amzData?.thumbnailImage ? [amzData.thumbnailImage] : []);

  const cleanName = jpData?.title || amzData?.title || `UGREEN ${pick.asin}`;

  return {
    product_id: pick.asin,
    rawTitle: amzData?.title || jpData?.title || cleanName,
    cleanName,
    section: 'amazon',
    role: pick.role,
    price_jpy: amzData?.price?.value || '',
    original_price: amzData?.listPrice?.value || '',
    sales_count: amzData?.reviewsCount || 0,
    evaluate_rate: amzData?.stars || '',
    monthly_volume: amzData?.monthlyPurchaseVolume || '',
    modelNumber: modelNo,
    affiliateLink: '',
    hasAffiliate: false,
    amazonUrl: affiliate || amzData?.url || `https://www.amazon.co.jp/dp/${pick.asin}`,
    mainImage: images[0] || '',
    images,
    amazonPlaceholder: {
      status: affiliate ? 'verified' : 'pending',
      searchQuery: cleanName,
      asin: pick.asin,
      url: affiliate || null,
    },
    specResult: amzData?.description ? {
      content: amzData.description.slice(0, 1200),
      source: 'amazon.co.jp',
    } : (jpData?.metaDescription ? { content: jpData.metaDescription, source: 'ugreen.jp' } : null),
    features: amzData?.features?.slice(0, 5) || [],
    productOverview: amzData?.productOverview || [],
    amazonReviews: reviews,
    redditReviews: reviews.map((r) => ({
      subreddit: `Amazon★${r.rating}`,
      snippet: `${r.title ? '【' + r.title + '】 ' : ''}${r.body.replace(/\s+/g, ' ').slice(0, 300)}`,
      url: `https://www.amazon.co.jp/product-reviews/${pick.asin}`,
      author: r.author,
      date: r.date,
      rating: r.rating,
    })),
    notes: {
      whyTrust: amzData ? `Amazon.co.jp で ${amzData.reviewsCount?.toLocaleString() || '?'}件レビュー / 星 ${amzData.stars || '?'}` : '',
    },
  };
}

function buildCleanAeName(rawTitle) {
  const t = rawTitle || '';
  if (t.length <= 60 && /UGREEN/i.test(t)) return t;

  const parts = ['UGREEN'];

  // シリーズ名
  const series = t.match(/\b(UNO|Nexode\s?Pro|Nexode\s?Air|Nexode\s?Mini|Nexode|Revodok\s?Pro|Revodok|MagFlow\s?Air|MagFlow|Maxidok|DigiNest\s?Pro|DigiNest|PowerRoam)\b/i);
  if (series) parts.push(series[1]);

  // 製品タイプ（判定順が重要：複合製品は具体的なカテゴリを先に判定）
  let type = null;
  // ハブ・ドック系（HDMI出力ありの製品が多いが、ハブが主機能）を先に判定
  if (/ドッキング|docking|thunderbolt\s?[45]/i.test(t)) type = 'ドッキングステーション';
  else if (/(?:usb-?c\s?)?ハブ|usb\s?hub|usb-?c\s?hub/i.test(t)) type = 'USB-Cハブ';
  else if (/sd\s?カード\s?リーダー|sd\s?card\s?reader|card\s?reader/i.test(t)) type = 'SDカードリーダー';
  // ケーブル系
  else if (/HDMI.*ケーブル|HDMI\s?cable|hdmi.*cord|hdmi[\s,].*\d+k/i.test(t)) type = 'HDMI ケーブル';
  else if (/displayport|\bdp\b.*ケーブル/i.test(t)) type = 'DisplayPort ケーブル';
  else if (/lightning/i.test(t)) type = 'Lightning ケーブル';
  else if (/lan\s?ケーブル|cat[678]/i.test(t)) type = 'LAN ケーブル';
  else if (/usb[-\s]?c.*usb[-\s]?c|type[-\s]?c\s?(?:to|→)\s?type[-\s]?c|usb-c\s?\/\s?c/i.test(t)) type = 'USB-C/C ケーブル';
  else if (/usb[-\s]?a.*usb[-\s]?c|type[-\s]?a.*type[-\s]?c/i.test(t)) type = 'USB-A/C ケーブル';
  else if (/ケーブル|cable/i.test(t)) type = 'USB-C ケーブル';
  // その他
  else if (/充電器|チャージャー|charger/i.test(t)) type = '充電器';

  // ハブのポート構成（X-in-Y or Nポート）
  const inY = t.match(/(\d{1,2})\s*[-\s]?in[-\s]?(\d{1,2})/i);
  if (inY) parts.push(`${inY[1]}-in-${inY[2]}`);
  else {
    const ports = t.match(/(\d{1,2})\s*[-\s]?(?:port|ポート)/i);
    if (ports) parts.push(`${ports[1]}ポート`);
  }

  // ハブの特徴
  if (/ethernet|rj45|有線lan|1000mbps/i.test(t)) parts.push('LAN対応');
  if (/steam\s?deck/i.test(t)) parts.push('Steam Deck対応');
  if (/トリプル|triple/i.test(t)) parts.push('トリプルディスプレイ');
  if (/スプリッター|splitter/i.test(t)) parts.push('スプリッター');

  // 解像度
  const reso = t.match(/\b(8K|4K|2K)(?:@\d+Hz)?\b/i);
  if (reso) parts.push(reso[0]);

  // ワット数
  const w = t.match(/(?:pd\s*)?(\d{2,4})\s*[wW]/);
  if (w) parts.push(w[1] + 'W');

  // 通信速度
  const speed = t.match(/(\d{1,3})\s*Gbps/i);
  if (speed) parts.push(speed[0]);

  // E-Marker / MFi
  if (/e-?marker/i.test(t)) parts.push('E-Marker');
  if (/mfi\s?認証/i.test(t)) parts.push('MFi認証');

  // 容量
  const mah = t.match(/(\d{4,6})\s*mAh/i);
  if (mah) parts.push(mah[0]);

  if (type) parts.push(type);

  // 同じ単語が重複するのを除く
  const seen = new Set();
  const dedup = parts.filter((p) => {
    const k = p.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return dedup.join(' ');
}

function buildAeProduct(pick) {
  const ae = aeByPid.get(String(pick.product_id));
  if (!ae) { console.warn('AE not found:', pick.product_id); return null; }
  const images = [ae.product_main_image_url, ...(ae.product_small_image_urls?.string || [])].filter(Boolean).slice(0, 6);
  const t = ae.product_title || '';
  return {
    product_id: ae.product_id,
    rawTitle: t,
    cleanName: buildCleanAeName(t),
    section: 'aliexpress',
    role: pick.role,
    price_jpy: ae.target_sale_price || ae.sale_price || '',
    original_price: ae.target_original_price || ae.original_price || '',
    sales_count: ae.lastest_volume || 0,
    evaluate_rate: ae.evaluate_rate || '',
    affiliateLink: ae.promotion_link || ae.product_detail_url,
    hasAffiliate: Boolean(ae.promotion_link),
    amazonUrl: '',
    mainImage: images[0] || '',
    images,
    amazonPlaceholder: { status: 'pending', searchQuery: t.slice(0, 50), asin: null, url: null },
    specResult: null,
    features: [],
    amazonReviews: [],
    redditReviews: [],
    notes: { whyTrust: `UGREEN公式ストアで直近${ae.lastest_volume?.toLocaleString()}件販売の実績` },
  };
}

const amazonProducts = picks.map(buildProduct);
const aeProductsList = aePicks.map(buildAeProduct).filter(Boolean);
const products = [...amazonProducts, ...aeProductsList];

const research = {
  ...plan,
  researchedAt: new Date().toISOString().slice(0, 10),
  products,
  tavilyResults: [],
  brandInfo: {
    name: 'UGREEN',
    nameJp: 'ユーグリーン',
    companyName: 'Shenzhen Ugreen Technology Co., Ltd.',
    founded: 2012,
    headquarters: '中国・広東省深セン市',
    stockListing: '深セン証券取引所（300893）',
    japanEntity: 'Ugreen Japan合同会社',
    keyCertifications: ['PSE', 'FCC', 'CE', 'RoHS', 'Apple MFi', 'PD3.1'],
  },
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(OUT, JSON.stringify(research, null, 2));
console.log(`✅ ${OUT}`);
products.forEach((p, i) => console.log(`  ${i + 1}. ${p.cleanName.slice(0, 55)} (reviews:${p.amazonReviews.length}, imgs:${p.images.length})`));
