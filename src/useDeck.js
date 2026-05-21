import { useState, useRef, useCallback, useEffect } from 'react';

const BUFFER   = 20;
const LS_SCORES = 'aliex_tag_scores';

function getScores() {
  try { return JSON.parse(localStorage.getItem(LS_SCORES) || '{}'); }
  catch { return {}; }
}

function buildPool(allProducts, maxPrice, selectedCategory) {
  const scores   = getScores();
  const filtered = allProducts.filter(p =>
    p.price <= maxPrice && (!selectedCategory || p.tags.includes(selectedCategory))
  );
  if (!filtered.length) return [];

  // スコアリング: タグ好み + Choice ボーナス
  const scored = filtered.map(p => ({
    ...p,
    _s: p.tags.reduce((s, t) => s + (scores[t] || 0), 0) + (p.is_choice ? 1 : 0),
  }));
  scored.sort((a, b) => b._s - a._s);

  // 50件バケット内でシャッフル（毎サイクル同じ順にならないように）
  const out = [];
  for (let i = 0; i < scored.length; i += 50) {
    const bucket = scored.slice(i, i + 50);
    for (let j = bucket.length - 1; j > 0; j--) {
      const k = Math.floor(Math.random() * (j + 1));
      [bucket[j], bucket[k]] = [bucket[k], bucket[j]];
    }
    out.push(...bucket);
  }
  return out.map(({ _s, ...p }) => p);
}

export function useDeck({ allProducts, maxPrice, selectedCategory }) {
  const poolRef    = useRef([]);
  const headRef    = useRef(0);
  const counterRef = useRef(0);

  const [cards, setCards]                 = useState([]);
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [remaining, setRemaining]         = useState(0);

  // フィルター変更 or データ読み込み時にプールを再構築
  useEffect(() => {
    if (!allProducts.length) return;
    const pool = buildPool(allProducts, maxPrice, selectedCategory);
    poolRef.current  = pool;
    headRef.current  = 0;
    setFilteredTotal(pool.length);
    setRemaining(pool.length);
    setCards(pool.slice(0, BUFFER).map(p => ({ ...p, uid: `${p.id}-${++counterRef.current}` })));
  }, [allProducts, maxPrice, selectedCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback((uid, direction, product) => {
    // ライク → タグスコアをバンプ（次回以降の優先度に反映）
    if (direction === 'right' && product?.tags) {
      const s = getScores();
      product.tags.forEach(t => { s[t] = (s[t] || 0) + 1; });
      localStorage.setItem(LS_SCORES, JSON.stringify(s));
    }

    const pool = poolRef.current;
    if (!pool.length) return;

    const newHead = (headRef.current + 1) % pool.length;
    headRef.current = newHead;
    const newRem  = newHead === 0 ? pool.length : pool.length - newHead;
    const nextIdx = (newHead + BUFFER - 1) % pool.length;
    const nextCard = { ...pool[nextIdx], uid: `${pool[nextIdx].id}-${++counterRef.current}` };

    setRemaining(newRem);
    setCards(prev => [...prev.filter(c => c.uid !== uid), nextCard]);
  }, []);

  return { cards, advance, filteredTotal, remaining };
}
