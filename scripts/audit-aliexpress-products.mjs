/**
 * 全記事のAliExpress商品を API で実在性チェック
 * - 商品が見つからない（dead link）
 * - ブランド系記事で公式ストアと違うセラー
 * を炙り出す
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const APP_KEY = process.env.ALIEXPRESS_APP_KEY;
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET;
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID;
const DELAY = 400;

// 既知の公式ストア shop_id（CLAUDE.md ルール対象）
const OFFICIAL_SHOP_IDS = {
  ugreen: '1103243235',
};

// スラッグから期待ブランド名を推定
function inferBrand(slug) {
  const lc = slug.toLowerCase();
  if (lc.startsWith('ugreen-')) return 'ugreen';
  if (lc.startsWith('baseus-')) return 'baseus';
  if (lc.startsWith('naturehike-') || lc.includes('naturehike')) return 'naturehike';
  if (lc.startsWith('gamesir-')) return 'gamesir';
  if (lc.startsWith('8bitdo-')) return '8bitdo';
  if (lc.startsWith('anbernic-')) return 'anbernic';
  if (lc.startsWith('miyoo-')) return 'miyoo';
  if (lc.startsWith('retroid-')) return 'retroid';
  if (lc.startsWith('ajazz-')) return 'ajazz';
  if (lc.startsWith('epomaker-')) return 'epomaker';
  if (lc.startsWith('moondrop-')) return 'moondrop';
  if (lc.startsWith('kz-')) return 'kz';
  if (lc.startsWith('haylou-')) return 'haylou';
  if (lc.startsWith('onetigris-')) return 'onetigris';
  if (lc.startsWith('atk-')) return 'atk';
  if (lc.startsWith('gmktec-')) return 'gmktec';
  if (lc.startsWith('ayaneo-')) return 'ayaneo';
  if (lc.startsWith('sharge-')) return 'sharge';
  if (lc.startsWith('rainy')) return 'rainy';
  if (lc.startsWith('sf3000')) return 'sf3000';
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function sign(p) { return crypto.createHmac('sha256', APP_SECRET).update(Object.keys(p).sort().map(k => k + p[k]).join('')).digest('hex').toUpperCase(); }

async function getDetail(pid) {
  const params = {
    app_key: APP_KEY,
    method: 'aliexpress.affiliate.productdetail.get',
    sign_method: 'sha256',
    timestamp: String(Date.now()),
    tracking_id: TRACKING_ID,
    product_ids: pid,
    target_currency: 'JPY',
    target_language: 'JA',
    ship_to_country: 'JP',
    fields: 'product_id,product_title,shop_id,shop_url,shop_name,lastest_volume',
  };
  params.sign = sign(params);
  try {
    const r = await fetch('https://api-sg.aliexpress.com/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params),
    });
    const j = await r.json();
    return j?.aliexpress_affiliate_productdetail_get_response?.resp_result?.result?.products?.product?.[0] || null;
  } catch (e) {
    return null;
  }
}

const articlesDir = 'data/articles';
const files = fs.readdirSync(articlesDir).filter((f) => f.endsWith('-research.json'));
const issues = [];

for (const f of files) {
  const slug = f.replace(/-research\.json$/, '');
  const brand = inferBrand(slug);
  const r = JSON.parse(fs.readFileSync(path.join(articlesDir, f), 'utf8'));
  const products = (r.products || []).filter((p) => p.product_id && /^\d+$/.test(String(p.product_id)));
  if (products.length === 0) continue;

  console.log(`\n[${slug}] (brand:${brand || '-'}, products:${products.length})`);
  for (const p of products) {
    const detail = await getDetail(p.product_id);
    if (!detail) {
      const issue = { slug, brand, productId: p.product_id, name: p.cleanName, type: 'DEAD', detail: 'API応答なし（商品削除/非公開の可能性）' };
      issues.push(issue);
      console.log(`  ❌ ${p.product_id} | DEAD | ${p.cleanName?.slice(0, 50)}`);
    } else {
      const shopId = String(detail.shop_id);
      const shopName = detail.shop_name || '';
      const officialId = OFFICIAL_SHOP_IDS[brand];
      let issueType = null;
      if (officialId && shopId !== officialId) {
        issueType = 'NON_OFFICIAL_STORE';
      } else if (brand && !officialId) {
        // 公式shop_idが未登録ブランドの場合、shop_nameでヒューリスティック判定
        if (!shopName.toLowerCase().includes(brand.toLowerCase())) {
          issueType = 'BRAND_MISMATCH';
        }
      }
      if (issueType) {
        const issue = { slug, brand, productId: p.product_id, name: p.cleanName, type: issueType, shopId, shopName };
        issues.push(issue);
        console.log(`  ⚠️  ${p.product_id} | ${issueType} | shop:${shopId} (${shopName.slice(0, 30)})`);
      } else {
        console.log(`  ✅ ${p.product_id} | shop:${shopId} (${shopName.slice(0, 30)})`);
      }
    }
    await sleep(DELAY);
  }
}

fs.writeFileSync('data/articles/_audit-aliexpress-products.json', JSON.stringify(issues, null, 2));

console.log('\n\n========== サマリー ==========');
const dead = issues.filter((i) => i.type === 'DEAD');
const nonOfficial = issues.filter((i) => i.type === 'NON_OFFICIAL_STORE');
const brandMismatch = issues.filter((i) => i.type === 'BRAND_MISMATCH');
console.log(`DEAD (商品消失): ${dead.length}`);
console.log(`NON_OFFICIAL_STORE (公式ストア違反): ${nonOfficial.length}`);
console.log(`BRAND_MISMATCH (ブランド名不一致): ${brandMismatch.length}`);

// 記事ごと集計
const byArticle = {};
issues.forEach((i) => {
  if (!byArticle[i.slug]) byArticle[i.slug] = { dead: 0, nonOfficial: 0, brandMismatch: 0 };
  if (i.type === 'DEAD') byArticle[i.slug].dead++;
  else if (i.type === 'NON_OFFICIAL_STORE') byArticle[i.slug].nonOfficial++;
  else if (i.type === 'BRAND_MISMATCH') byArticle[i.slug].brandMismatch++;
});
console.log('\n=== 記事ごと問題件数 ===');
Object.entries(byArticle).sort((a, b) => {
  const sa = a[1].dead + a[1].nonOfficial + a[1].brandMismatch;
  const sb = b[1].dead + b[1].nonOfficial + b[1].brandMismatch;
  return sb - sa;
}).forEach(([slug, c]) => {
  const flags = [];
  if (c.dead) flags.push(`dead:${c.dead}`);
  if (c.nonOfficial) flags.push(`nonOfficial:${c.nonOfficial}`);
  if (c.brandMismatch) flags.push(`brandMismatch:${c.brandMismatch}`);
  console.log(`  ${slug}: ${flags.join(' / ')}`);
});

console.log('\nレポート保存: data/articles/_audit-aliexpress-products.json');
