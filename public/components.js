/**
 * サイト共通パーツ
 * ヘッダー・フッター・スティッキーCTAをここで一元管理する
 */
(function () {

  /* ── ナビメニュー カテゴリリスト ─────────────── */
  var NAV_ITEMS = [
    { label: '🛒 おすすめ商品・比較', url: '/#recommend' },
    { label: '📘 入門・基礎知識',     url: '/#beginner' },
    { label: '💳 支払い・決済',       url: '/#payment'  },
    { label: '📦 配送・追跡',         url: '/#shipping' },
    { label: '🔒 安全性・トラブル対策', url: '/#safety' },
  ];

  /* ── ヘッダー ─────────────────────────────────── */
  var HEADER_HTML =
    '<header class="site-header">' +
      '<div class="site-header-left"></div>' +
      '<a class="site-logo" href="/"><img src="/logo.png" alt="アリエクSwipe" style="height:36px;width:auto;display:block;"></a>' +
      '<button class="hamburger-btn" aria-label="メニューを開く" aria-expanded="false">' +
        '<span></span><span></span><span></span>' +
      '</button>' +
    '</header>' +
    '<div class="nav-overlay"></div>' +
    '<nav class="nav-drawer" aria-hidden="true">' +
      '<div class="nav-drawer-header">' +
        '<img src="/logo.png" alt="アリエクswipe" style="height:28px;width:auto;">' +
        '<button class="nav-close" aria-label="閉じる">✕</button>' +
      '</div>' +
      '<div class="nav-drawer-body">' +
        '<div class="nav-section">記事をカテゴリから探す</div>' +
        NAV_ITEMS.map(function(item) {
          return '<a class="nav-link" href="' + item.url + '">' + item.label + '<span class="nav-arrow">›</span></a>';
        }).join('') +
      '</div>' +
    '</nav>';

  /* ── 監修者ボックス ────────────────────────────── */
  var SUPERVISOR_HTML =
    '<div class="supervisor-box">' +
      '<div class="supervisor-inner">' +
        '<div class="supervisor-avatar">👨‍👧</div>' +
        '<div>' +
          '<div class="supervisor-label">この記事の監修者</div>' +
          '<div class="supervisor-name">アリエクパパ</div>' +
          '<div class="supervisor-meta">都内在住・30歳・一児のパパ</div>' +
          '<p class="supervisor-bio">キャンプ・ガジェット・自転車が趣味のアリエクヘビーユーザー。自腹で数え切れないほどのアイテムを購入してきた実体験をもとに、コスパ最強の格安商品を紹介しています。</p>' +
          '<a href="/info/about.html" class="supervisor-link">詳しいプロフィールを見る →</a>' +
        '</div>' +
      '</div>' +
    '</div>';

  /* ── スティッキーCTA ───────────────────────────── */
  var STICKY_CTA_HTML =
    '<a href="https://aliswipe.com/app/" target="_blank" rel="noopener" style="display:block;color:#fff;text-decoration:none;">' +
      '<div style="font-weight:700;font-size:0.92rem;">おすすめ商品を見る</div>' +
      '<div class="sub">アリエクSwipeでお得な商品をチェック</div>' +
    '</a>';

  /* ── フッター ─────────────────────────────────── */
  var FOOTER_HTML =
    '<div class="footer-links">' +
      '<a href="/info/privacy.html">プライバシーポリシー</a>' +
      '<a href="/info/contact.html">お問い合わせ</a>' +
      '<a href="/info/about.html">運営者情報</a>' +
      '<a href="/sitemap.html">サイトマップ</a>' +
    '</div>' +
    '<div>© 2026 アリエクswipe｜ガチ検証で選ぶアリエクの神コスパ商品. All rights reserved.</div>' +
    '<div class="footer-aff-notice">' +
      '本サイトはAliExpressのアフィリエイトプログラムに参加しています。' +
      '記事内のリンクから購入された場合、当サイトに報酬が発生することがあります。' +
      'ただし、商品の評価・内容は独自の基準で作成しています。' +
    '</div>';

  /* ── 共通CSS ──────────────────────────────────── */
  var SHARED_CSS =
    /* ヘッダー */
    '.site-header{position:sticky!important;top:0!important;z-index:200!important;background:#fff!important;border-bottom:1px solid #e5e7eb!important;display:grid!important;grid-template-columns:44px 1fr 44px!important;align-items:center!important;padding:0 12px!important;height:56px!important;}' +
    '.site-header-left{width:44px;}' +
    '.site-logo{justify-self:center;}' +
    /* ハンバーガーボタン */
    '.hamburger-btn{justify-self:end;width:40px;height:40px;background:none;border:none;cursor:pointer;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:5px;padding:0;border-radius:8px;transition:background .15s;}' +
    '.hamburger-btn:hover{background:#f5f5f5;}' +
    '.hamburger-btn span{display:block;width:22px;height:2px;background:#374151;border-radius:2px;transition:all .25s;}' +
    '.hamburger-btn.is-open span:nth-child(1){transform:translateY(7px) rotate(45deg);}' +
    '.hamburger-btn.is-open span:nth-child(2){opacity:0;}' +
    '.hamburger-btn.is-open span:nth-child(3){transform:translateY(-7px) rotate(-45deg);}' +
    /* オーバーレイ */
    '.nav-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:300;opacity:0;transition:opacity .25s;}' +
    '.nav-overlay.is-open{display:block;opacity:1;}' +
    /* ドロワー */
    '.nav-drawer{position:fixed;top:0;right:0;bottom:0;width:min(300px,85vw);background:#fff;z-index:400;transform:translateX(100%);transition:transform .28s cubic-bezier(.4,0,.2,1);overflow-y:auto;display:flex;flex-direction:column;}' +
    '.nav-drawer.is-open{transform:translateX(0);}' +
    '.nav-drawer-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #e5e7eb;position:sticky;top:0;background:#fff;z-index:1;}' +
    '.nav-close{background:none;border:none;font-size:1.2rem;cursor:pointer;color:#6b7280;padding:4px 8px;border-radius:6px;transition:background .15s;}' +
    '.nav-close:hover{background:#f5f5f5;color:#374151;}' +
    '.nav-drawer-body{padding:8px 0 24px;}' +
    '.nav-section{font-size:.72rem;font-weight:700;color:#9ca3af;letter-spacing:.08em;padding:16px 16px 6px;text-transform:uppercase;}' +
    '.nav-link{display:flex;align-items:center;justify-content:space-between;padding:13px 16px;font-size:.9rem;color:#374151;text-decoration:none;transition:background .12s;border-bottom:1px solid #f3f4f6;}' +
    '.nav-link:hover{background:#fff1f2;color:#e8253a;}' +
    '.nav-arrow{color:#d1d5db;font-size:1.1rem;}' +
    '.nav-link:hover .nav-arrow{color:#e8253a;}' +
    /* CTA共通 */
    '.cta-box{background:linear-gradient(135deg,#fff1f2 0%,#fff8f8 100%);border:2px solid #fecdcf;border-left:5px solid #e8253a;border-radius:16px;padding:28px 20px;margin:40px 0;text-align:center;}' +
    '.cta-lead{font-size:.93rem;font-weight:700;color:#1a1a1a;margin:0 0 18px;line-height:1.7;}' +
    '.cta-sub{font-size:.8rem;color:#6b7280;margin:0 0 18px;line-height:1.6;}' +
    '.cta-buttons{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}' +
    '.cta-btn-aliex,.cta-btn-amazon,.cta-btn-app{position:relative;overflow:hidden;display:inline-flex;align-items:center;gap:6px;padding:13px 28px;border-radius:999px;font-size:.88rem;font-weight:700;text-decoration:none;transition:opacity .15s,transform .1s;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,.12);}' +
    '.cta-btn-aliex:hover,.cta-btn-amazon:hover,.cta-btn-app:hover{opacity:.88;transform:translateY(-2px);}' +
    '.cta-btn-aliex:active,.cta-btn-amazon:active,.cta-btn-app:active{transform:scale(.97);}' +
    '.cta-btn-aliex{background:#e8253a;color:#fff;}' +
    '.cta-btn-amazon{background:#FF9900;color:#fff;}' +
    '.cta-btn-app{background:linear-gradient(135deg,#e8253a,#c2185b);color:#fff;}' +
    '.cta-note{font-size:.72rem;color:#9ca3af;margin:12px 0 0;}' +
    '.promo-notice{font-size:.72rem;color:#9ca3af;margin:4px 0 0;}' +
    '#cta-sticky a{position:relative;overflow:hidden;}' +
    '#cta-sticky{padding:9px 20px!important;}' +
    /* パンくず位置のブランドバッジ */
    '.site-brand-nav{padding:7px 16px;background:#fafaf8;border-bottom:1px solid #e5e7eb;}' +
    '.site-brand-nav a{display:inline-flex;align-items:center;text-decoration:none;opacity:.75;transition:opacity .15s;}' +
    '.site-brand-nav a:hover{opacity:1;}' +
    /* 監修者ボックス */
    '.supervisor-box{max-width:760px;margin:0 auto;padding:0 20px 40px;}' +
    '.supervisor-inner{display:flex;gap:16px;align-items:flex-start;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px 24px;}' +
    '.supervisor-avatar{width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#f97316);display:flex;align-items:center;justify-content:center;font-size:1.8rem;flex-shrink:0;}' +
    '.supervisor-label{font-size:.7rem;font-weight:700;color:#9ca3af;margin-bottom:4px;letter-spacing:.04em;text-transform:uppercase;}' +
    '.supervisor-name{font-size:1.05rem;font-weight:700;margin-bottom:2px;}' +
    '.supervisor-meta{font-size:.78rem;color:#6b7280;margin-bottom:8px;}' +
    '.supervisor-bio{font-size:.84rem;line-height:1.7;color:#374151;margin-bottom:10px;}' +
    '.supervisor-link{font-size:.78rem;color:#e8253a;text-decoration:none;font-weight:700;}' +
    '.supervisor-link:hover{text-decoration:underline;}' +
    '@media(max-width:480px){.supervisor-inner{flex-direction:column;align-items:center;text-align:center;}}';

  var styleEl = document.createElement('style');
  styleEl.textContent = SHARED_CSS;
  document.head.appendChild(styleEl);

  /* ── DOMContentLoaded後に全注入 ──────────────── */
  document.addEventListener('DOMContentLoaded', function () {

    /* ヘッダー注入 */
    var injectScript = document.getElementById('site-header-inject');
    if (injectScript) {
      var wrap = document.createElement('div');
      wrap.innerHTML = HEADER_HTML;
      var frag = document.createDocumentFragment();
      while (wrap.firstChild) frag.appendChild(wrap.firstChild);
      injectScript.replaceWith(frag);
    }

    /* フッター */
    var footer = document.getElementById('site-footer');
    if (footer) footer.innerHTML = FOOTER_HTML;

    /* スティッキーCTA */
    var cta = document.getElementById('cta-sticky');
    if (cta) cta.innerHTML = STICKY_CTA_HTML;

    /* 監修者ボックスをフッター直前に注入 */
    var siteFooter = document.querySelector('footer.site-footer');
    if (siteFooter) {
      var supWrap = document.createElement('div');
      supWrap.innerHTML = SUPERVISOR_HTML;
      siteFooter.parentNode.insertBefore(supWrap.firstChild, siteFooter);
    }

    /* パンくずを非表示 */
    var breadcrumb = document.querySelector('nav.breadcrumb');
    if (breadcrumb) breadcrumb.remove();

    /* ハンバーガーメニュー開閉 */
    var btn      = document.querySelector('.hamburger-btn');
    var drawer   = document.querySelector('.nav-drawer');
    var overlay  = document.querySelector('.nav-overlay');
    var closeBtn = document.querySelector('.nav-close');

    function openNav() {
      btn.classList.add('is-open');
      btn.setAttribute('aria-expanded', 'true');
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
    function closeNav() {
      btn.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    if (btn)      btn.addEventListener('click', openNav);
    if (closeBtn) closeBtn.addEventListener('click', closeNav);
    if (overlay)  overlay.addEventListener('click', closeNav);
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeNav(); });
  });

})();
