/**
 * UGREEN「どこの国」記事用のリサーチJSON手動ビルダー
 * Amazon8 + AliExpress5 = 計13商品を、curatedな構造で注入する
 */
import fs from 'node:fs';

const PLAN_FILE = 'data/articles/ugreen-doko-no-kuni-plan.json';
const OUT = 'data/articles/ugreen-doko-no-kuni-research.json';

const JP_FILE = 'data/ugreen/ugreen-jp-products-enriched.json';
const JP_AFFILIATE_CSV = 'data/ugreen/ugreen-jp-products3.csv';
const AMZ_FILE = 'data/ugreen/amazon-ugreen-catalog.json';
const AE_FILE = 'data/ugreen/aliexpress-store-catalog.json';
const MATCHES_FILE = 'data/ugreen/ugreen-aliexpress-matches.json';

// ============================================================
// データソース読み込み
// ============================================================
const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
const jpProducts = JSON.parse(fs.readFileSync(JP_FILE, 'utf8'));
const amzProducts = JSON.parse(fs.readFileSync(AMZ_FILE, 'utf8'));
const aeProducts = JSON.parse(fs.readFileSync(AE_FILE, 'utf8'));
const matches = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf8'));

// JP affiliate CSV を読んで amzn.to/XXX マップを作る
function parseCsv(s) {
  const lines = s.split(/\r?\n/);
  const parseRow = (l) => {
    const c = []; let cur = ''; let q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { q = !q; continue; }
      if (ch === ',' && !q) { c.push(cur); cur = ''; continue; }
      cur += ch;
    }
    c.push(cur);
    return c;
  };
  return lines.filter(Boolean).map(parseRow);
}

const csvRows = parseCsv(fs.readFileSync(JP_AFFILIATE_CSV, 'utf8'));
const csvHeader = csvRows[0];
const csvData = csvRows.slice(1);
const affiliateByHandle = new Map();
csvData.forEach((row) => {
  const handle = row[1];
  const affiliate = row[9];
  if (handle && affiliate && affiliate !== 'なし' && /^https?:/.test(affiliate)) {
    affiliateByHandle.set(handle, affiliate);
  }
});

const jpByHandle = new Map(jpProducts.map((p) => [p.handle, p]));
const amzByAsin = new Map(amzProducts.map((p) => [p.asin, p]));
const matchByHandle = new Map(matches.map((m) => [m.handle, m]));
const aeByPid = new Map(aeProducts.map((p) => [String(p.product_id), p]));

// ============================================================
// セレクション
// ============================================================
const AMAZON_PICKS = [
  {category: '充電器', handle: 'ugreen-nexode-65w-急速-充電器-4ポート'},
  {category: 'モバイルバッテリー', handle: 'nexode-25000mah-200w'},
  {category: 'USBハブ', handle: 'ugreen-revodok-105-usb-c-ハブ-5-in-1'},
  {category: 'USB-Cケーブル', handle: 'usb-c-lightning-cable'},
  {category: 'ワイヤレス充電器', handle: 'ugreen-magflow-ワイヤレス充電器-2-in-1-magsafe対応'},
  {category: 'SDカードリーダー', handle: 'ugreen-sd-card-reader-type-c-black'},
  {category: '車載充電器', handle: 'nexode-car-charger-60w-with-retractable-usb-c-cable'},
  {category: 'ポータブル電源', handle: 'powerroam600-gs600'},
];

const AE_PICKS = [
  {category: '充電器', product_id: '1005008702713918'},
  {category: 'USBハブ', product_id: '1005010255498921'},
  {category: 'USB-Cケーブル', product_id: '1005010264264682'},
  {category: 'SDカードリーダー', product_id: '1005006897972401'},
  {category: '車載充電器', product_id: '1005007009143875'},
];

// ============================================================
// Amazonコーナー商品を構築
// ============================================================
function getAmazonProduct(pick) {
  const jp = jpByHandle.get(pick.handle);
  if (!jp) { console.warn('JP not found:', pick.handle); return null; }

  // ASINを取得
  const asinMatch = jp.retailLinks?.amazon?.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/);
  const asin = asinMatch?.[1];
  const amzData = asin ? amzByAsin.get(asin) : null;
  const affiliate = affiliateByHandle.get(pick.handle);
  const match = matchByHandle.get(pick.handle);
  const aeLink = match?.bestMatch?.promotion_link;

  const modelAttr = amzData?.attributes?.find((a) => /model.?number|品番|model.?no|製造元参照番号/i.test(a.key || ''));
  const modelNo = modelAttr?.value || jp.specs?.['製品型番'] || '';

  // 画像: UGREEN.jp のCDN画像を優先
  const ugreenImages = (jp.images?.urls || []).slice(0, 6);
  const amzImages = amzData?.highResolutionImages || amzData?.galleryThumbnails || [];
  const images = ugreenImages.length > 0 ? ugreenImages : (amzImages.length > 0 ? amzImages : (amzData?.thumbnailImage ? [amzData.thumbnailImage] : []));

  return {
    product_id: asin || jp.id?.toString() || pick.handle,
    rawTitle: amzData?.title || jp.title,
    cleanName: jp.title,
    section: 'amazon',
    category: pick.category,
    price_jpy: amzData?.price?.value || '',
    original_price: amzData?.listPrice?.value || '',
    sales_count: amzData?.reviewsCount || 0,
    evaluate_rate: amzData?.stars || '',
    monthly_volume: amzData?.monthlyPurchaseVolume || '',
    modelNumber: modelNo,
    affiliateLink: aeLink || '',
    hasAffiliate: Boolean(aeLink),
    amazonUrl: affiliate || jp.retailLinks?.amazon || '',
    mainImage: images[0] || '',
    images: images,
    amazonPlaceholder: {
      status: affiliate ? 'verified' : 'pending',
      searchQuery: jp.title,
      asin: asin || null,
      url: affiliate || null,
    },
    specResult: amzData?.description ? {
      content: amzData.description.slice(0, 1000),
      source: 'amazon.co.jp',
    } : (jp.metaDescription ? { content: jp.metaDescription, source: 'ugreen.jp' } : null),
    features: amzData?.features?.slice(0, 5) || [],
    productOverview: amzData?.productOverview || [],
    redditReviews: [],
    notes: {
      whyTrust: `Amazon.co.jp で ${amzData?.reviewsCount?.toLocaleString() || '?'} 件レビュー / 星 ${amzData?.stars || '?'} の実績商品`,
    },
  };
}

// ============================================================
// AliExpressコーナー商品を構築
// ============================================================
function getAeProduct(pick) {
  const ae = aeByPid.get(pick.product_id);
  if (!ae) { console.warn('AE not found:', pick.product_id); return null; }

  // タイトル簡潔化（手動）
  const cleanTitleMap = {
    '1005008702713918': 'UGREEN GaN 20W/30W mini USB-C 充電器',
    '1005010255498921': 'UGREEN Steam Deck USB-C ハブ 6-in-1 100W',
    '1005010264264682': 'UGREEN 240W PD3.1 デジタル表示 USB-C ケーブル',
    '1005006897972401': 'UGREEN USB3.0+USB-C SDカードリーダー',
    '1005007009143875': 'UGREEN USBカーチャージャー 30W急速',
  };

  const images = [
    ae.product_main_image_url,
    ...(ae.product_small_image_urls?.string || []),
  ].filter(Boolean).slice(0, 6);

  return {
    product_id: ae.product_id,
    rawTitle: ae.product_title,
    cleanName: cleanTitleMap[pick.product_id] || ae.product_title,
    section: 'aliexpress',
    category: pick.category,
    price_jpy: ae.target_sale_price || ae.sale_price || '',
    original_price: ae.target_original_price || ae.original_price || '',
    sales_count: ae.lastest_volume || 0,
    evaluate_rate: ae.evaluate_rate || '',
    affiliateLink: ae.promotion_link || ae.product_detail_url,
    hasAffiliate: Boolean(ae.promotion_link),
    amazonUrl: '', // AE中心商品は Amazon 対応なし（PENDINGになる）
    mainImage: images[0] || '',
    images: images,
    amazonPlaceholder: {
      status: 'pending',
      searchQuery: cleanTitleMap[pick.product_id] || ae.product_title.slice(0, 50),
      asin: null,
      url: null,
    },
    specResult: null,
    redditReviews: [],
    notes: {
      whyTrust: `UGREEN公式ストアで直近${ae.lastest_volume?.toLocaleString()}件販売の実績`,
    },
  };
}

// ============================================================
// 統合
// ============================================================
const aeProductsList = AE_PICKS.map(getAeProduct).filter(Boolean);
const aePidsInAeCorner = new Set(aeProductsList.map((p) => String(p.product_id)));

const amazonProductsList = AMAZON_PICKS.map(getAmazonProduct).filter(Boolean).map((p) => {
  // AmazonコーナーのAEマッチが、AliExpressコーナーにある商品と同じだったらAEリンクを外す（重複防止）
  if (p.affiliateLink) {
    const aePidMatch = matches.find((m) => m.handle === AMAZON_PICKS.find((a) => a.category === p.category)?.handle)?.bestMatch?.product_id;
    if (aePidMatch && aePidsInAeCorner.has(String(aePidMatch))) {
      p.affiliateLink = '';
      p.hasAffiliate = false;
    }
  }
  return p;
});

const products = [...amazonProductsList, ...aeProductsList];

const research = {
  ...plan,
  researchedAt: new Date().toISOString().slice(0, 10),
  products,
  tavilyResults: [],
  brandInfo: {
    name: 'UGREEN',
    nameJp: 'ユーグリーン',
    companyName: 'Shenzhen Ugreen Technology Co., Ltd.',
    companyNameJp: '深セン緑联科技股份有限公司',
    founded: 2012,
    headquarters: '中国・広東省深セン市',
    countriesOperating: '100+',
    stockListing: '深セン証券取引所（300893）',
    japanEntity: 'Ugreen Japan合同会社',
    keyCertifications: ['PSE', 'FCC', 'CE', 'RoHS', 'Apple MFi', 'USB-IF', 'Thunderbolt'],
    similarBrands: [
      {name: 'Anker', founded: 2011, hq: '中国・深セン', strength: 'モバイルバッテリー・充電器'},
      {name: 'Baseus', founded: 2011, hq: '中国・深セン', strength: '車載・カー周辺・小物'},
      {name: 'UGREEN', founded: 2012, hq: '中国・深セン', strength: 'USBハブ・ドック・NAS'},
    ],
  },
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(OUT, JSON.stringify(research, null, 2), 'utf8');
console.log(`✅ research JSON 生成完了: ${OUT}`);
console.log(`  - Amazon corner products: ${AMAZON_PICKS.length}`);
console.log(`  - AliExpress corner products: ${AE_PICKS.length}`);
console.log(`  - Total products: ${products.length}`);
console.log('');
console.log('Verification:');
products.forEach((p, i) => {
  const flags = [];
  if (p.hasAffiliate) flags.push('AE');
  if (p.amazonUrl) flags.push('Amazon');
  if (p.images.length) flags.push(`${p.images.length}imgs`);
  console.log(`  ${i + 1}. [${p.section}/${p.category}] ${p.cleanName.slice(0, 50)} (${flags.join(',')})`);
});
