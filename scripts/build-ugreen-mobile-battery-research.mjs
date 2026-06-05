/**
 * UGREEN モバイルバッテリーおすすめ8選 用のリサーチJSON生成
 */
import fs from 'node:fs';

const PLAN_FILE = 'data/articles/ugreen-mobile-battery-osusume-plan.json';
const OUT = 'data/articles/ugreen-mobile-battery-osusume-research.json';

const JP_FILE = 'data/ugreen/ugreen-jp-products-enriched.json';
const JP_AFFILIATE_CSV = 'data/ugreen/ugreen-jp-products3.csv';
const AMZ_FILE = 'data/ugreen/amazon-ugreen-catalog.json';
const REVIEWS_FILE = 'data/ugreen/review-parsed.json';

const plan = JSON.parse(fs.readFileSync(PLAN_FILE, 'utf8'));
const jpProducts = JSON.parse(fs.readFileSync(JP_FILE, 'utf8'));
const amzProducts = JSON.parse(fs.readFileSync(AMZ_FILE, 'utf8'));
const reviewsData = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));

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

// === 採用8商品の定義（順序が記事の表示順）===
const PICKS = [
  { asin: 'B0CXHM5RY2', short: 'Nexode 25000mAh 200W', role: 'フラッグシップ大容量' },
  { asin: 'B0CXHNGDC1', short: 'Nexode 20000mAh 130W', role: 'バランス3ポート' },
  { asin: 'B0CXJ1F1M7', short: 'Nexode 12000mAh 100W', role: 'MacBook Air向け' },
  { asin: 'B0C3GTMX5M', short: 'Nexode 20000mAh 100W ケーブル付き', role: '売れ筋500+/月' },
  { asin: 'B0F37VLJQW', short: 'MagFlow Qi2 25W 10000mAh', role: 'Qi2 MagSafe' },
  { asin: 'B0F6NC41DZ', short: 'MagFlow Air 10000mAh 15W MagSafe', role: '薄型8.6mm' },
  { asin: 'B0DSPXHFBM', short: 'Nexode 巻き取り20000mAh 165W', role: 'ケーブル内蔵' },
  { asin: 'B0CXHRNVNW', short: 'Built-In USB-C 5000mAh 22.5W', role: '直挿し小型' },
];

// レビューから代表的なものを抽出（最大5件）：
// - 高評価2件（役立った数順）
// - 低評価1〜2件（★3以下、誠実なバランス用）
// - その他の長文1〜2件（具体ユースケース）
function pickReviews(reviews) {
  if (!reviews || reviews.length === 0) return [];
  const sorted = [...reviews].sort((a, b) => (b.helpful || 0) - (a.helpful || 0));
  const high = sorted.filter((r) => r.rating >= 4).slice(0, 3);
  const low = sorted.filter((r) => r.rating <= 3).slice(0, 2);
  const extra = sorted.filter((r) => r.body.length >= 200 && !high.includes(r) && !low.includes(r)).slice(0, 2);
  return [...high, ...low, ...extra].slice(0, 5);
}

function buildProduct(pick) {
  const amzData = amzByAsin.get(pick.asin);
  const jpData = jpByAsin.get(pick.asin);
  const affiliate = affiliateByAsin.get(pick.asin);
  const reviewBlock = reviewsData[pick.asin];
  const reviews = pickReviews(reviewBlock?.reviews || []);

  const modelAttr = amzData?.attributes?.find((a) => /model.?number|品番|model.?no|製造元参照番号/i.test(a.key || ''));
  const modelNo = modelAttr?.value || '';

  // 画像: UGREEN.jp CDNを優先、なければAmazon側
  const ugreenImages = jpData?.images?.urls?.slice(0, 6) || [];
  const amzImages = amzData?.highResolutionImages || amzData?.galleryThumbnails || [];
  const images = ugreenImages.length > 0 ? ugreenImages
    : amzImages.length > 0 ? amzImages
    : (amzData?.thumbnailImage ? [amzData.thumbnailImage] : []);

  // タイトル: UGREEN.jpの日本語名を優先
  const cleanName = jpData?.title || amzData?.title || pick.short;

  return {
    product_id: pick.asin,
    rawTitle: amzData?.title || jpData?.title || cleanName,
    cleanName,
    section: 'amazon',
    category: 'モバイルバッテリー',
    price_jpy: amzData?.price?.value || '',
    original_price: amzData?.listPrice?.value || '',
    sales_count: amzData?.reviewsCount || 0,
    evaluate_rate: amzData?.stars || '',
    monthly_volume: amzData?.monthlyPurchaseVolume || '',
    modelNumber: modelNo,
    role: pick.role,
    affiliateLink: '', // 公式AEストアに無い
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
    // step3-write は redditReviews を見るので Amazon レビューを互換変換しておく
    redditReviews: reviews.map((r) => ({
      subreddit: `Amazon★${r.rating}`,
      snippet: `${r.title ? '【' + r.title + '】 ' : ''}${r.body.replace(/\s+/g, ' ').slice(0, 300)}`,
      url: `https://www.amazon.co.jp/product-reviews/${pick.asin}`,
      author: r.author,
      date: r.date,
      rating: r.rating,
    })),
    notes: {
      whyTrust: amzData ? `Amazon.co.jp で ${amzData.reviewsCount?.toLocaleString() || '?'}件レビュー / 星 ${amzData.stars || '?'} の実績` : '',
    },
  };
}

const products = PICKS.map(buildProduct);

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
    keyCertifications: ['PSE', 'FCC', 'CE', 'RoHS', 'Apple MFi', 'Qi2', 'PD3.1'],
  },
  recallInfo: {
    formalRecalls: '発火・破裂を理由とした正式リコールは現時点（2026年6月）でなし',
    selfImprovements: [
      {
        date: '2024-10-21',
        model: 'PB311',
        issue: '電池パックのラベル表示が日本国内法規に対応していなかった',
        action: '新ラベルの貼付による自主改善（リコールではない）',
        source: 'https://ugreen.jp/blogs/news/improved-battery-markings',
        note: '発火事故・安全性の問題ではなく、表示ラベルの法令遵守対応',
      },
    ],
    competitorRecalls: [
      { brand: 'Anker', issue: '一部旧モデルのバッテリーセル不具合による発火懸念で自主回収', when: '2025年' },
      { brand: 'Romoss', issue: '中国国内で広範な3C認証取り消し', when: '2025年' },
    ],
    airplane: {
      jpDomestic: '100Wh以下（≒27,000mAh以下）まで機内持ち込み可・27,000〜43,000mAh超は受託禁止',
      jp25000mAh: 'OK（持ち込み可）',
      jp48000mAh: 'NG（容量超過で持ち込み・受託とも不可）',
    },
  },
  notesForWriter: {
    reviewQuoteRule: '各商品セクションで、amazonReviews配列の上位3件を <blockquote class="amazon-review"> で引用する。レビュアー名・★・日付・本文（200-300字）を必ず示す',
    recallSection: 'リコール独立セクション(section5)では、UGREEN自身の自主改善（PB311ラベル）は紹介するが、発火事故起因リコールではないと明示。Anker/Romossとの状況の違いも整理',
    aliexpressSection: 'AliExpress UGREEN公式ストア（shop_id=1103243235）にモバイルバッテリーの直近販売300+商品がなかった事実を明記。Amazon中心推奨の理由を提示',
  },
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(OUT, JSON.stringify(research, null, 2));
console.log(`✅ ${OUT}`);
console.log(`  products: ${products.length}`);
products.forEach((p, i) => {
  console.log(`  ${i + 1}. ${p.cleanName.slice(0, 50)} - reviews:${p.amazonReviews.length}, imgs:${p.images.length}`);
});
