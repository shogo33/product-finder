/**
 * fetch-reddit-voices.mjs
 * Reddit JSON API から指定クエリの投稿を取得する
 * 使い方: node scripts/fetch-reddit-voices.mjs
 * （gen-voices.mjs から呼び出されることが多い）
 */

const REDDIT_BASE = 'https://www.reddit.com';
const UA = 'aliswipe-voices-bot/1.0 (research; contact: aliswipe.com)';

/**
 * subreddit + query で投稿を検索して返す
 * @param {string} subreddit - e.g. "Aliexpress"
 * @param {string} query     - e.g. "dispute refund not received"
 * @param {object} opts
 * @param {number} opts.limit  - 最大取得件数（max 100）
 * @param {string} opts.sort   - relevance | new | top
 * @param {string} opts.t      - month | week | year | all
 */
export async function searchReddit(subreddit, query, { limit = 100, sort = 'relevance', t = 'month' } = {}) {
  const url = `${REDDIT_BASE}/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&sort=${sort}&t=${t}&limit=${limit}&restrict_sr=1`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Reddit API error: ${res.status} ${url}`);
  const json = await res.json();
  return (json.data?.children ?? []).map(c => {
    const p = c.data;
    return {
      title:    p.title ?? '',
      text:     (p.selftext ?? '').slice(0, 400),
      score:    p.score ?? 0,
      comments: p.num_comments ?? 0,
      url:      `https://www.reddit.com${p.permalink}`,
      created:  new Date(p.created_utc * 1000).toISOString().slice(0, 10),
    };
  });
}

/**
 * 上位投稿のコメントを取得する（上位5件まで）
 * @param {string} permalink - e.g. "/r/Aliexpress/comments/abc123/..."
 */
export async function fetchTopComments(permalink, limit = 20) {
  const url = `${REDDIT_BASE}${permalink}.json?limit=${limit}&sort=top`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const json = await res.json();
  const comments = json[1]?.data?.children ?? [];
  return comments
    .filter(c => c.kind === 't1' && c.data.score > 1)
    .slice(0, 5)
    .map(c => ({
      text:  (c.data.body ?? '').slice(0, 300),
      score: c.data.score,
    }));
}
