/**
 * Vercel serverless function: 商品採用管理 API
 * GET    /api/admin?action=products  → キュレーション済み商品リスト（承認状態付き）
 * PATCH  /api/admin?action=approve   → 承認状態を一括更新 (body: {updates:[{id,approved}]})
 * POST   /api/admin?action=generate  → GitHub Actions ワークフロー手動起動
 *
 * 必要な Vercel 環境変数:
 *   ADMIN_TOKEN   ← 管理画面ログイン用パスワード
 *   GITHUB_TOKEN  ← repo 書き込み権限付き Personal Access Token
 */

const OWNER         = 'shogo33';
const REPO          = 'product-finder';
const APPROVED_PATH = 'data/approved.json';
const PRODUCTS_PATH = 'data/products.json';

// ── Curation (generate-public-products.mjs と同一ロジック) ──────────────
const PRICE_TIER_GAP = 1500;
const TOP_PERCENT    = 0.30;
const NO_DEDUP_TYPES = new Set([
  'カードゲーム','チェスセット','ジグソーパズル','ダイスセット','カードスリーブ','ボードゲーム',
]);

function curate(all) {
  const under10k = all.filter(p => p.active !== false && parseFloat(p.price_jpy) <= 10000);
  const scored   = under10k
    .map(p => ({ ...p, _score: (Number(p.sales_count)||0) * (parseFloat(p.evaluate_rate)||0) }))
    .sort((a, b) => b._score - a._score);
  const topN    = Math.max(10, Math.ceil(scored.length * TOP_PERCENT));
  const popular = new Set(scored.slice(0, topN));
  const seen    = new Set();
  const result  = [];
  for (const p of scored) {
    const isPopular = popular.has(p);
    const ptype     = p.product_type ?? p.tag ?? 'その他';
    if (NO_DEDUP_TYPES.has(ptype)) {
      if (isPopular) result.push(p);
      continue;
    }
    const tier = Math.floor(parseFloat(p.price_jpy) / PRICE_TIER_GAP);
    const key  = `${ptype}_${tier}`;
    if (isPopular && !seen.has(key)) {
      seen.add(key); result.push(p);
    } else if (!isPopular && !result.some(q => (q.product_type ?? q.tag) === ptype)) {
      seen.add(key); result.push(p);
    }
  }
  return result;
}

// ── GitHub API helpers ────────────────────────────────────────────────────
const GH_HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'product-finder-admin',
});

async function ghGetJson(token, filePath) {
  const r = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
    { headers: GH_HEADERS(token) }
  );
  if (r.status === 404) return { data: null, sha: null };
  if (!r.ok) throw new Error(`GitHub GET ${filePath}: ${r.status}`);
  const meta = await r.json();
  let text;
  if (!meta.content || meta.encoding === 'none') {
    // Large file (>1MB): use the authenticated download_url
    const dl = await fetch(meta.download_url);
    text = await dl.text();
  } else {
    text = Buffer.from(meta.content, 'base64').toString('utf8');
  }
  return { data: JSON.parse(text), sha: meta.sha };
}

async function ghPutJson(token, filePath, data, sha, message) {
  const content = Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64');
  const body    = { message, content };
  if (sha) body.sha = sha;
  const r = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/contents/${filePath}`,
    {
      method:  'PUT',
      headers: { ...GH_HEADERS(token), 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    }
  );
  const result = await r.json();
  if (!r.ok) throw new Error(result.message || `GitHub PUT ${filePath}: ${r.status}`);
  return result;
}

// ── Main handler ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }

  // Auth
  const adminToken = (process.env.ADMIN_TOKEN || '').trim();
  const token      = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  console.log('[admin] token_set:', !!adminToken, 'token_len:', adminToken.length, 'input_len:', token.length, 'match:', adminToken === token);
  if (!adminToken || token !== adminToken) {
    res.status(401).json({ error: 'Unauthorized' }); return;
  }

  const ghToken = process.env.GITHUB_TOKEN;
  if (!ghToken) {
    res.status(500).json({ error: 'GITHUB_TOKEN not configured' }); return;
  }

  const action = req.query?.action;

  try {
    // ── GET products ──────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'products') {
      const [{ data: all }, { data: approvedMap }] = await Promise.all([
        ghGetJson(ghToken, PRODUCTS_PATH),
        ghGetJson(ghToken, APPROVED_PATH),
      ]);
      const map     = approvedMap || {};
      const curated = curate(all);
      res.status(200).json(curated.map(p => ({
        product_id:      p.product_id,
        title:           p.title_short ?? p.title,
        title_full:      p.title,
        price_jpy:       p.price_jpy,
        original_price:  p.original_price_jpy,
        image_url:       p.image_url,
        affiliate_link:  p.affiliate_link,
        evaluate_rate:   p.evaluate_rate,
        sales_count:     p.sales_count,
        commission_rate: p.commission_rate,
        product_type:    p.product_type,
        tag:             p.tag,
        approved:        map[String(p.product_id)] ?? null,
      })));
      return;
    }

    // ── PATCH approve ─────────────────────────────────────────────────
    // body: { updates: [{id: string, approved: true|false|null}, ...] }
    if (req.method === 'PATCH' && action === 'approve') {
      const { updates } = req.body || {};
      if (!Array.isArray(updates) || updates.length === 0) {
        res.status(400).json({ error: 'updates[] required' }); return;
      }
      const { data: map, sha } = await ghGetJson(ghToken, APPROVED_PATH);
      const approvedMap = map || {};
      for (const { id, approved } of updates) {
        if (approved === null || approved === undefined) {
          delete approvedMap[String(id)];
        } else {
          approvedMap[String(id)] = Boolean(approved);
        }
      }
      await ghPutJson(ghToken, APPROVED_PATH, approvedMap, sha,
        `chore: update ${updates.length}件の採用状態`);
      res.status(200).json({ ok: true, count: updates.length });
      return;
    }

    // ── POST generate ─────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'generate') {
      const r = await fetch(
        `https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/refresh-prices.yml/dispatches`,
        {
          method:  'POST',
          headers: { ...GH_HEADERS(ghToken), 'Content-Type': 'application/json' },
          body:    JSON.stringify({ ref: 'main' }),
        }
      );
      res.status(r.ok ? 200 : 500).json({ ok: r.ok, status: r.status });
      return;
    }

    res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('[admin API]', err);
    res.status(500).json({ error: err.message });
  }
}
