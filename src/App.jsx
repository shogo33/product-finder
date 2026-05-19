import { useState, useMemo, memo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { Heart, X, Package, Sparkles, TrendingUp, Layers, Filter, BarChart3, Smartphone } from 'lucide-react';


// 画像ギャラリー独立コンポーネント
const ImageGallery = memo(({ images, image, emoji, name }) => {
  const src = images?.[0] || image;
  if (src) {
    return <img src={src} alt={name} className="w-full h-full object-cover" />;
  }
  return <div className="w-full h-full flex items-center justify-center text-9xl">{emoji}</div>;
});

// 背景カード（2,3枚目）
const BackgroundCard = memo(({ card, index, x }) => {
  // index 1: 2枚目 - 通常 scale 0.95, y 20。 スワイプ中(|x|>100) → scale 1, y 0
  // index 2: 3枚目 - 通常 scale 0.9, y 40。 スワイプ中(|x|>100) → scale 0.95, y 20
  const baseScale = index === 1 ? 0.95 : 0.9;
  const targetScale = index === 1 ? 1 : 0.95;
  const baseY = index === 1 ? 20 : 40;
  const targetY = index === 1 ? 0 : 20;

  // 絶対値ベースで補間（左右どちらにスワイプしても同じ動き）
  const cardScale = useTransform(x, (latest) => {
    const abs = Math.abs(latest);
    const progress = Math.min(abs / 150, 1);
    return baseScale + (targetScale - baseScale) * progress;
  });
  const cardY = useTransform(x, (latest) => {
    const abs = Math.abs(latest);
    const progress = Math.min(abs / 150, 1);
    return baseY + (targetY - baseY) * progress;
  });

  return (
    <motion.div 
      className="absolute w-full h-full rounded-3xl bg-white border-4 border-stone-300 shadow-lg pointer-events-none overflow-hidden flex flex-col"
      style={{
        top: 0,
        left: 0,
        zIndex: 3 - index,
        scale: cardScale,
        y: cardY,
        transformOrigin: 'center top'
      }}
    >
      {/* 画像エリア（70%） */}
      <div className="relative w-full bg-gradient-to-br from-stone-50 to-stone-100 overflow-hidden" style={{ height: '70%' }}>
        {card.images && card.images.length > 0 ? (
          <img src={card.images[0]} alt={card.name} className="w-full h-full object-cover" />
        ) : card.image ? (
          <img src={card.image} alt={card.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-9xl">{card.emoji}</div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <div className="text-[10px] tracking-widest text-white/80 uppercase font-bold mb-1">{card.category}</div>
          <div className="text-lg font-bold text-white drop-shadow-lg">{card.name}</div>
        </div>
      </div>
      {/* 下部情報エリア（30%） */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-2">
        {card.tags && (
          <div className="flex flex-wrap gap-1 justify-center">
            {card.tags.map((tag, idx) => (
              <span key={idx} className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="text-2xl font-black text-stone-800 leading-none">¥{card.price.toLocaleString()}</div>
        <div className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold text-sm shadow-lg">
          AliExpressで見る
        </div>
      </div>
    </motion.div>
  );
});

// 最前面カード（1枚目） - ドラッグ可能
const SwipeCard = ({ card, x, y, rotate, scale, cardOpacity, likeOpacity, nopeOpacity, amazonUrl, onSwipeRight, onSwipeLeft, selectedTag, setSelectedTag }) => {
  const [exitX, setExitX] = useState(0);

  const handleSwipe = async (direction) => {
    const targetX = direction === 'right' ? 1000 : -1000;
    animate(y, -80, { duration: 0.3, ease: 'easeOut' });
    animate(x, targetX, {
      duration: 0.3,
      ease: 'easeOut',
      onComplete: () => {
        if (direction === 'right') onSwipeRight();
        else onSwipeLeft();
        requestAnimationFrame(() => {
          x.set(0);
          y.set(0);
        });
      }
    });
  };

  return (
    <motion.div
      className="absolute w-full h-full cursor-grab active:cursor-grabbing rounded-3xl overflow-hidden bg-white flex flex-col shadow-2xl border-4 border-stone-300"
      style={{
        x,
        y,
        rotate,
        scale,
        opacity: cardOpacity,
        top: 0,
        zIndex: 10
      }}
      drag={true}
      dragConstraints={false}
      dragMomentum={false}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100 || info.velocity.x > 500) {
          handleSwipe('right');
        } else if (info.offset.x < -100 || info.velocity.x < -500) {
          handleSwipe('left');
        } else {
          animate(x, 0, { type: 'spring', stiffness: 500, damping: 30 });
          animate(y, 0, { type: 'spring', stiffness: 500, damping: 30 });
        }
      }}
    >
      {/* 画像エリア（70%） */}
      <div className="relative w-full bg-gradient-to-br from-stone-50 to-stone-100 overflow-hidden" style={{ height: '70%' }}>
        <ImageGallery 
          images={card.images}
          image={card.image}
          emoji={card.emoji}
          name={card.name}
        />
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none z-20">
          <div className="text-[10px] tracking-widest text-white/80 uppercase font-bold mb-1">{card.category}</div>
          <div className="text-lg font-bold text-white drop-shadow-lg">{card.name}</div>
        </div>
      </div>

      {/* 下部情報エリア（30%） */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-2">
        {card.tags && (
          <div className="flex flex-wrap gap-1 justify-center">
            {card.tags.map((tag, idx) => (
              <motion.span 
                key={idx} 
                className="text-[10px] px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold cursor-pointer hover:bg-red-200 transition-all"
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                {tag}
              </motion.span>
            ))}
          </div>
        )}
        
        <div className="text-2xl font-black text-stone-800 leading-none">
          ¥{card.price.toLocaleString()}
        </div>

        <a
          href={amazonUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-6 py-2 bg-red-600 text-white rounded-xl font-bold text-sm hover:shadow-xl transition-all active:scale-95 shadow-lg"
        >
          AliExpressで見る
        </a>
      </div>

      {/* GOOD/SKIP オーバーレイ：スワイプ方向と逆側に配置（常に見える） */}
      <motion.div
        className="absolute top-12 left-6 px-4 py-1.5 border-[4px] border-red-500 rounded-lg -rotate-12 bg-white/40 backdrop-blur z-30"
        style={{ opacity: likeOpacity }}
      >
        <span className="text-red-600 font-black text-xl tracking-wider">GOOD!</span>
      </motion.div>
      <motion.div
        className="absolute top-12 right-6 px-4 py-1.5 border-[4px] border-blue-500 rounded-lg rotate-12 bg-white/40 backdrop-blur z-30"
        style={{ opacity: nopeOpacity }}
      >
        <span className="text-blue-600 font-black text-xl tracking-wider">SKIP</span>
      </motion.div>
    </motion.div>
  );
};

// products.json が未配置の場合のフォールバック
const FALLBACK_PRODUCTS = [];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function App() {
  const [allProducts, setAllProducts] = useState(FALLBACK_PRODUCTS);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [deck, setDeck] = useState([]);
  const [cycleCount, setCycleCount] = useState(0);
  const [liked, setLiked] = useState([]);
  const [view, setView] = useState('swipe');
  const [showModal, setShowModal] = useState(true);
  const [swipeCount, setSwipeCount] = useState(0);
  const [selectedTag, setSelectedTag] = useState(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState(null);
  const celebrationTimerRef = useRef(null);




  // /products.json を取得してデッキにセット
  useEffect(() => {
    fetch('/products.json')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (!data.length) return;
        setAllProducts(data);
        setDeck(shuffle(data).map((p, i) => ({ ...p, uid: `${p.id}-0-${i}` })));
      })
      .catch(() => {});
  }, []);

  const closeModal = () => {
    setShowModal(false);
    // モーダルを閉じた後にスワイプヒントアニメを再生
    setTimeout(() => {
      animate(x, 70, { duration: 0.3, ease: 'easeOut' })
        .then(() => animate(x, -50, { duration: 0.35, ease: 'easeInOut' }))
        .then(() => animate(x, 0, { type: 'spring', stiffness: 300, damping: 18 }));
    }, 400);
  };

  const filteredDeck = useMemo(() => {
    return deck.filter(p => {
      const priceMatch = p.price <= maxPrice;
      const tagMatch = selectedTag ? p.tags.includes(selectedTag) : true;
      return priceMatch && tagMatch;
    });
  }, [deck, maxPrice, selectedTag]);

  const current = filteredDeck[0];

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-20, 20]);
  const likeOpacity = useTransform(x, [0, 80], [0, 1]);
  const nopeOpacity = useTransform(x, [-80, 0], [1, 0]);
  const scale = useTransform(x, [-200, 0, 200], [0.95, 1, 0.95]);
  const cardOpacity = useTransform(x, [-300, -200, -100, 0, 100, 200, 300], [0, 0.2, 0.6, 1, 0.6, 0.2, 0]);

  const showCelebration = (message, emoji, type) => {
    if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
    setCelebrationMessage({ message, emoji, type });
    celebrationTimerRef.current = setTimeout(() => {
      setCelebrationMessage(null);
      celebrationTimerRef.current = null;
    }, 2500);
  };

  const advance = (direction) => {
    if (!current) return;

    const newSwipeCount = swipeCount + 1;
    setSwipeCount(newSwipeCount);
    setDeck(prev => {
      const remaining = prev.filter(p => p.uid !== current.uid);
      if (remaining.length <= 2) {
        const newCycle = cycleCount + 1;
        const refill = shuffle(allProducts).map((p, i) => ({ ...p, uid: `${p.id}-${newCycle}-${i}` }));
        setCycleCount(newCycle);
        return [...remaining, ...refill];
      }
      return remaining;
    });

    if (direction === 'right') {
      const newLiked = [{ ...current, likedAt: Date.now() }, ...liked];
      setLiked(newLiked);
      
      // お気に入り数による褒めメッセージ
      const likedMilestones = {
        5: { message: 'センスありますね！', emoji: '✨' },
        10: { message: 'コレクター気質ですね', emoji: '👑' },
        20: { message: '目利きですね！', emoji: '🎯' },
        50: { message: 'プロのバイヤー級！', emoji: '🏆' },
      };
      if (likedMilestones[newLiked.length]) {
        setTimeout(() => {
          showCelebration(likedMilestones[newLiked.length].message, likedMilestones[newLiked.length].emoji, 'liked');
        }, 600);
      }
    }

    // スワイプ数マイルストーン
    const swipeMilestones = {
      10: { message: '良いペース！', emoji: '🚀' },
      25: { message: 'すばらしい！', emoji: '⭐' },
      50: { message: '止まらない！', emoji: '🔥' },
      100: { message: 'もう100スワイプ！', emoji: '💎' },
      200: { message: '神の領域！', emoji: '⚡' },
      500: { message: '伝説の閲覧者！', emoji: '👑' },
    };
    if (swipeMilestones[newSwipeCount]) {
      setTimeout(() => {
        showCelebration(swipeMilestones[newSwipeCount].message, swipeMilestones[newSwipeCount].emoji, 'swipe');
      }, 600);
    }
  };

  const amazonUrl = current ? current.url : '#';
  const cartUrl = current ? `https://www.amazon.co.jp/gp/aws/cart/add.html?ASIN.1=${current.asin}&Quantity.1=1` : '#';
  const priceLabel = `〜 ¥${maxPrice.toLocaleString()}`;

  // 全タグを集計
  const allTags = useMemo(() => {
    const tagSet = new Set();
    allProducts.forEach(p => p.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet);
  }, [allProducts]);

  // タグの出現数をカウント
  const tagCounts = useMemo(() => {
    const counts = {};
    filteredDeck.forEach(p => {
      p.tags.forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    });
    return counts;
  }, [filteredDeck]);

  // ----- CELEBRATION OVERLAY -----
  const CelebrationOverlay = () => (
    <AnimatePresence>
      {celebrationMessage && (
        <motion.div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -30 }}
        >
          {/* 紙吹雪パーティクル */}
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full"
              style={{
                backgroundColor: ['#fbbf24', '#e8253a', '#a855f7', '#ec4899', '#10b981'][i % 5],
                left: '50%',
                top: '50%'
              }}
              initial={{ scale: 0, x: 0, y: 0 }}
              animate={{
                scale: [0, 1, 0],
                x: (Math.random() - 0.5) * 300,
                y: (Math.random() - 0.5) * 200,
                rotate: Math.random() * 720,
              }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />
          ))}
          
          {/* メインメッセージ - 横長デザイン */}
          <motion.div
            className="bg-white/95 backdrop-blur rounded-2xl px-5 py-3 shadow-2xl border-2 border-red-200 flex items-center gap-3"
            initial={{ scale: 0.8 }}
            animate={{ scale: [0.8, 1.05, 1] }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <motion.div 
              className="text-3xl"
              animate={{ 
                rotate: [0, -10, 10, 0],
                scale: [1, 1.2, 1]
              }}
              transition={{ duration: 0.8 }}
            >
              {celebrationMessage.emoji}
            </motion.div>
            <div>
              <div className="text-base font-black bg-gradient-to-r from-red-600 via-red-600 to-rose-600 bg-clip-text text-transparent">
                {celebrationMessage.message}
              </div>
              <div className="text-[10px] text-stone-500 font-semibold">
                {celebrationMessage.type === 'liked' 
                  ? `お気に入り ${liked.length}件` 
                  : `${swipeCount}スワイプ達成`}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ----- HELP MODAL -----
  const HelpModal = () => (
    <AnimatePresence>
      {showModal && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="bg-white rounded-3xl p-8 max-w-2xl shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
          >
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Package className="w-8 h-8 text-white" />
              </div>
              <img src="/logo.png" alt="アリエクSwipe" className="h-12 w-auto mx-auto" />
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-lg">👉</div>
                <div>
                  <p className="font-semibold text-stone-800 text-sm">スワイプで商品判定</p>
                  <p className="text-xs text-stone-600 mt-0.5">右スワイプ：お気に入り</p>
                  <p className="text-xs text-stone-600">左スワイプ：スキップ</p>
                </div>
              </div>
              
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-lg">💰</div>
                <div>
                  <p className="font-semibold text-stone-800 text-sm">予算でフィルター</p>
                  <p className="text-xs text-stone-600 mt-0.5">予算タブで上限金額を設定</p>
                </div>
              </div>
              
              <div className="flex gap-3 items-start">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0 text-lg">❤️</div>
                <div>
                  <p className="font-semibold text-stone-800 text-sm">お気に入りを管理</p>
                  <p className="text-xs text-stone-600 mt-0.5">お気に入りタブで確認・購入</p>
                </div>
              </div>
            </div>

            <button
              onClick={closeModal}
              className="w-full py-3.5 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-xl hover:shadow-lg transition-all active:scale-95 text-sm tracking-wide"
            >
              さっそく始める
            </button>
            
            <p className="text-xs text-stone-400 text-center mt-4">※ 最初の1回のみ表示されます</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ----- INSTALL MODAL -----
  const InstallModal = () => (
    <AnimatePresence>
      {showInstallModal && (
        <motion.div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setShowInstallModal(false)}
        >
          <motion.div
            className="bg-white rounded-3xl p-6 max-w-2xl shadow-2xl overflow-hidden"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
                <Smartphone className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-black text-stone-800">ホーム画面に追加</h2>
              <p className="text-xs text-stone-500 mt-1">アプリのように使えるようになります</p>
            </div>

            <div className="space-y-4">
              {/* iOS手順 */}
              <div className="border border-stone-200 rounded-xl p-4">
                <h3 className="font-bold text-sm text-stone-800 mb-2 flex items-center gap-1.5">
                  <span className="text-lg">📱</span>
                  <span>iPhone (Safari)</span>
                </h3>
                <ol className="space-y-1.5 text-xs text-stone-600">
                  <li className="flex gap-2"><span className="font-bold text-red-600">1.</span> 下部の「共有」ボタンをタップ</li>
                  <li className="flex gap-2"><span className="font-bold text-red-600">2.</span> 「ホーム画面に追加」を選択</li>
                  <li className="flex gap-2"><span className="font-bold text-red-600">3.</span> 右上の「追加」をタップ</li>
                </ol>
              </div>

              {/* Android手順 */}
              <div className="border border-stone-200 rounded-xl p-4">
                <h3 className="font-bold text-sm text-stone-800 mb-2 flex items-center gap-1.5">
                  <span className="text-lg">🤖</span>
                  <span>Android (Chrome)</span>
                </h3>
                <ol className="space-y-1.5 text-xs text-stone-600">
                  <li className="flex gap-2"><span className="font-bold text-red-600">1.</span> 右上の「︙」メニューをタップ</li>
                  <li className="flex gap-2"><span className="font-bold text-red-600">2.</span> 「ホーム画面に追加」を選択</li>
                  <li className="flex gap-2"><span className="font-bold text-red-600">3.</span> 「追加」をタップ</li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => setShowInstallModal(false)}
              className="mt-5 w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold rounded-xl hover:shadow-lg transition-all active:scale-95 text-sm"
            >
              閉じる
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ----- SWIPE VIEW -----
  const SwipeView = () => {
    if (!current) {
      return (
        <div className="flex-1 flex items-center justify-center px-6 overflow-y-auto">
          <div className="text-center">
            <p className="text-stone-600 text-sm">商品がありません</p>
          </div>
        </div>
      );
    }

    // 3枚分のカードを描画用に取得
    const cards = filteredDeck.slice(0, 3);

    return (
      <div className="flex-1 flex flex-col items-center justify-start px-2 pt-1 pb-4 overflow-hidden relative min-h-0">
        {/* カードスタックエリア */}
        <div className="w-full relative flex-1 min-h-0">
          {/* 後ろのカードから先に描画（zIndexで前面に配置） */}
          {cards.map((card, index) => {
            if (index === 0) {
              // 1枚目（最前面） - ドラッグ可能
              return (
                <SwipeCard
                  key="front-card"
                  card={card}
                  x={x}
                  y={y}
                  rotate={rotate}
                  scale={scale}
                  cardOpacity={cardOpacity}
                  likeOpacity={likeOpacity}
                  nopeOpacity={nopeOpacity}
                  amazonUrl={amazonUrl}
                  onSwipeRight={() => advance('right')}
                  onSwipeLeft={() => advance('left')}
                  selectedTag={selectedTag}
                  setSelectedTag={setSelectedTag}
                />
              );
            } else {
              // 2,3枚目（背景） - 静的、スワイプで前面に上がる
              return (
                <BackgroundCard
                  key={`bg-card-${index}`}
                  card={card}
                  index={index}
                  x={x}
                />
              );
            }
          })}
        </div>

      </div>
    );
  };

  // ----- BUDGET VIEW -----
  const BudgetView = () => (
    <div className="flex-1 flex flex-col overflow-y-auto px-6 py-4 h-full">
      <div className="bg-gradient-to-br from-red-500 via-red-600 to-rose-600 rounded-3xl p-6 text-white shadow-lg mb-6">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <div className="text-xs font-semibold opacity-90 mb-0.5">価格帯</div>
            <motion.div
              className="text-2xl font-black tracking-tight"
              key={maxPrice}
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
            >
              {priceLabel}
            </motion.div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-90">該当商品</div>
            <div className="text-2xl font-bold">{filteredDeck.length}</div>
          </div>
        </div>

        <div>
          <div className="flex justify-between text-[10px] opacity-80 mb-1">
            <span>上限</span>
            <span>¥{maxPrice.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min="0"
            max="10000"
            step="100"
            value={maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value))}
            className="w-full h-2 bg-white/30 rounded-lg appearance-none cursor-pointer accent-white"
          />
          <div className="flex justify-between text-[10px] opacity-70 mt-1">
            <span>¥0</span>
            <span>¥10,000</span>
          </div>
        </div>
      </div>

      
      <div className="mt-4 p-3 bg-stone-100 rounded-lg text-xs text-stone-600">
        <p className="mb-2 font-semibold">ご利用上の注意</p>
        <p>本サービスはAliExpressの商品情報を紹介しています。商品の最新情報・価格・在庫状況については、必ずAliExpressの商品ページでご確認ください。</p>
      </div>
    </div>
  );

  // ----- LIKED VIEW -----
  const LikedView = () => (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <div className="px-6 py-4 border-b border-stone-200 bg-gradient-to-r from-red-50 to-red-100 flex-shrink-0 min-h-[68px]">
        <h3 className="text-sm font-bold text-stone-800">お気に入り</h3>
        <p className="text-xs text-stone-500 mt-0.5">{liked.length}件</p>
      </div>
      
      {liked.length > 0 && (
        <div className="mx-3 mt-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-xl">
          <div className="flex items-start gap-2">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="text-[11px] font-bold text-stone-800 mb-0.5">お気に入りはブラウザに保存されます</p>
              <p className="text-[10px] text-stone-600 leading-relaxed">
                ブラウザのキャッシュをクリアすると消えてしまう可能性があります。気に入った商品は<span className="font-bold text-orange-600">AliExpressのカートに追加</span>しておくと安心です。
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {liked.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Heart className="w-12 h-12 text-stone-300 mx-auto mb-2" fill="currentColor" />
              <p className="text-xs text-stone-500">商品をお気に入りに追加できます</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {liked.map((product, idx) => (
              <motion.a
                key={product.uid}
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.05, y: -4 }}
                className="bg-white border-2 border-red-200 rounded-xl p-3 hover:border-red-500 hover:shadow-md transition-all cursor-pointer"
              >
                <div className={`w-full h-20 rounded-lg bg-gradient-to-br ${product.color} flex items-center justify-center mb-2 shadow-sm overflow-hidden`}>
                  {product.images && product.images.length > 0 ? (
                    <img 
                      src={product.images[0]} 
                      alt={product.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : product.image ? (
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl">{product.emoji}</span>
                  )}
                </div>
                <div className="text-[10px] font-bold text-stone-800 truncate">{product.name}</div>
                <div className="text-xs font-bold text-red-600 mt-1">¥{product.price.toLocaleString()}</div>
                <div className="flex flex-wrap gap-0.5 mt-1">
                  {product.tags && product.tags.slice(0, 2).map((tag, tidx) => (
                    <span key={tidx} className="text-[8px] px-1 py-0.5 bg-red-50 text-red-600 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ----- STATS VIEW -----
  const StatsView = () => {
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return (
      <div className="flex-1 flex flex-col overflow-y-auto px-6 py-4 h-full">
        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-3xl p-6 text-white shadow-lg mb-6">
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-xs font-semibold opacity-90 mb-0.5">スワイプ数</div>
              <motion.div 
                className="text-4xl font-black"
                key={swipeCount}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
              >
                {swipeCount}
              </motion.div>
            </div>
            <TrendingUp className="w-12 h-12 opacity-30" />
          </div>
        </div>

        <h3 className="text-xs font-bold text-stone-700 mb-2">人気タグ TOP 5</h3>
        <div className="space-y-2 mb-6">
          {topTags.map(([tag, count], idx) => (
            <div key={tag} className="flex items-center gap-3">
              <div className="text-xs font-bold text-stone-500 w-4">{idx + 1}</div>
              <div className="flex-1">
                <div className="text-xs font-semibold text-stone-800 mb-0.5">{tag}</div>
                <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-red-500 to-red-600"
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / Math.max(...Object.values(tagCounts))) * 100}%` }}
                    transition={{ delay: idx * 0.1 }}
                  />
                </div>
              </div>
              <div className="text-xs font-bold text-stone-600">{count}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-red-50 rounded-xl p-4 border-2 border-red-200">
            <p className="text-[10px] text-stone-600 mb-1">総商品数</p>
            <p className="text-2xl font-black text-red-600">{allProducts.length}</p>
          </div>
          <div className="bg-rose-50 rounded-xl p-4 border-2 border-rose-200">
            <p className="text-[10px] text-stone-600 mb-1">お気に入り数</p>
            <p className="text-2xl font-black text-rose-600">{liked.length}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-[100svh] bg-gradient-to-b from-stone-50 to-stone-100 flex items-center justify-center sm:p-4 overflow-hidden">
      <HelpModal />
      <InstallModal />
      <CelebrationOverlay />
      <div className="w-full max-w-md h-full bg-white sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
           style={{ fontFamily: "'Hiragino Sans', 'Yu Gothic', sans-serif" }}>

        <div className="px-4 pt-2 pb-1.5 flex flex-col border-b border-red-100 flex-shrink-0 bg-gradient-to-br from-red-50 via-rose-50 to-pink-50 relative overflow-hidden shadow-md">
          {/* 装飾的な背景パターン */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-200/40 to-rose-200/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-pink-200/30 to-red-200/20 rounded-full blur-2xl"></div>

          <div className="flex items-center justify-between relative z-10">
            <div>
              <img src="/logo.png" alt="アリエクSwipe" className="h-8 w-auto" />
            </div>
            <div className="flex gap-1.5 items-center">
              <button
                onClick={() => setShowInstallModal(true)}
                className="px-2.5 h-8 rounded-full bg-white/80 backdrop-blur hover:bg-white shadow-md flex items-center gap-1 transition-all active:scale-95 text-stone-600"
                title="ホーム画面に追加"
              >
                <Smartphone className="w-3 h-3" />
                <span className="text-[9px] font-bold whitespace-nowrap">追加</span>
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="w-8 h-8 rounded-full bg-white/80 backdrop-blur hover:bg-white shadow-md flex items-center justify-center transition-all active:scale-95"
                title="使い方を表示"
              >
                <span className="text-sm font-bold text-stone-600">?</span>
              </button>
            </div>
          </div>

          {/* 記事リンク */}
          <a
            href="/home.html"
            className="mt-1 relative z-10 flex items-center gap-1.5 self-start px-2.5 py-0.5 rounded-full bg-white/70 backdrop-blur hover:bg-white shadow-sm transition-all text-[9px] font-bold text-red-600 border border-red-100"
          >
            <span>📰</span>
            <span>アリエクに関する記事はこちら</span>
            <span>›</span>
          </a>

          {/* 進捗バー */}
          <div className="mt-1 relative z-10">
            <div className="flex justify-between items-center mb-1">
              <div className="flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 text-red-400" />
                <span className="text-[9px] font-semibold text-stone-500">今日のスワイプ</span>
              </div>
              <span className="text-[9px] font-bold text-stone-600">
                <span className="text-red-600">{swipeCount}</span> / 500
              </span>
            </div>
            <div className="w-full h-1 bg-red-100 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-red-500 to-rose-400 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((swipeCount / 500) * 100, 100)}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>

        <div className="px-4 pt-1.5 pb-1 flex-shrink-0">
          <div className="flex gap-1 bg-stone-100 rounded-full p-0.5">
            {[
              { id: 'swipe', icon: Layers },
              { id: 'budget', icon: Filter },
              { id: 'liked', icon: Heart, count: liked.length },
              { id: 'stats', icon: BarChart3 },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setView(tab.id)}
                  className={`flex-1 py-1.5 rounded-full flex items-center justify-center transition-all relative ${
                    view === tab.id ? 'bg-white shadow text-red-600' : 'text-stone-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="absolute -top-1 -right-1 text-[9px] bg-red-500 text-white rounded-full px-1 min-w-[16px] text-center">{tab.count}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {view === 'swipe' && <SwipeView />}
          {view === 'budget' && <BudgetView />}
          {view === 'liked' && <LikedView />}
          {view === 'stats' && <StatsView />}
        </div>
      </div>
    </div>
  );
}
