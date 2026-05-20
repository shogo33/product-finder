/**
 * サイト共通パーツ
 * ヘッダー・フッター・スティッキーCTAをここで一元管理する
 */
(function () {

  /* ── ヘッダー ─────────────────────────────────── */
  const HEADER_HTML =
    '<header class="site-header">' +
      '<a class="site-logo" href="/"><img src="/logo.png" alt="アリエクSwipe" style="height:36px;width:auto;display:block;"></a>' +
      '<a class="header-cta" href="https://aliswipe.com/app/" target="_blank" rel="noopener">おすすめ商品を見る</a>' +
    '</header>';

  /* ── スティッキーCTA ───────────────────────────── */
  const STICKY_CTA_HTML =
    '<a href="https://aliswipe.com/app/" target="_blank" rel="noopener">おすすめ商品を見る</a>' +
    '<div class="sub">アリエクSwipeでお得な商品をチェック</div>';

  /* ── フッター ─────────────────────────────────── */
  const FOOTER_HTML =
    '<div class="footer-links">' +
      '<a href="/info/privacy.html">プライバシーポリシー</a>' +
      '<a href="/info/contact.html">お問い合わせ</a>' +
      '<a href="/info/about.html">運営者情報</a>' +
      '<a href="/sitemap.html">サイトマップ</a>' +
    '</div>' +
    '<div>© 2026 アリエクswipe｜お得情報・格安商品. All rights reserved.</div>' +
    '<div class="footer-aff-notice">' +
      '本サイトはAliExpressのアフィリエイトプログラムに参加しています。' +
      '記事内のリンクから購入された場合、当サイトに報酬が発生することがあります。' +
      'ただし、商品の評価・内容は独自の基準で作成しています。' +
    '</div>';

  /* ── CTA共通CSS ───────────────────────────────── */
  var CTA_CSS =
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
    /* シマー共通 */
    '.cta-btn-aliex::after,.cta-btn-amazon::after,.cta-btn-app::after,.header-cta::after,#cta-sticky a::after{content:"";position:absolute;top:0;left:-80%;width:55%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.32),transparent);animation:cta-shimmer 3.5s ease-in-out infinite;pointer-events:none;}' +
    '.header-cta{position:relative;overflow:hidden;}' +
    '#cta-sticky a{position:relative;overflow:hidden;}' +
    '@keyframes cta-shimmer{0%{left:-80%}18%{left:120%}100%{left:120%}}';

  var styleEl = document.createElement('style');
  styleEl.textContent = CTA_CSS;
  document.head.appendChild(styleEl);

  /* ── ヘッダー同期注入（FOUC防止）─────────────── */
  // <script id="site-header-inject"> タグをヘッダーに差し替える
  var injectScript = document.getElementById('site-header-inject');
  if (injectScript) {
    var headerEl = document.createElement('div');
    headerEl.innerHTML = HEADER_HTML;
    injectScript.replaceWith(headerEl.firstChild);
  }

  /* ── フッター・スティッキーCTA・ヒーローブランドはDOMContentLoaded後 */
  document.addEventListener('DOMContentLoaded', function () {
    var footer = document.getElementById('site-footer');
    if (footer) footer.innerHTML = FOOTER_HTML;

    var cta = document.getElementById('cta-sticky');
    if (cta) cta.innerHTML = STICKY_CTA_HTML;

    /* ── article-hero の先頭にブランドバッジを挿入 ── */
    var hero = document.querySelector('.article-hero');
    if (hero) {
      var badge = document.createElement('a');
      badge.href = '/';
      badge.style.cssText = 'display:inline-flex;align-items:center;gap:8px;text-decoration:none;margin-bottom:16px;opacity:.85;transition:opacity .15s;';
      badge.onmouseenter = function(){ this.style.opacity = '1'; };
      badge.onmouseleave = function(){ this.style.opacity = '.85'; };
      badge.innerHTML =
        '<img src="/logo.png" alt="アリエクswipe" style="height:28px;width:auto;display:block;">' +
        '<span style="font-size:.75rem;font-weight:700;color:#e8253a;letter-spacing:.04em;">アリエクswipe</span>';
      hero.insertBefore(badge, hero.firstChild);
    }
  });

})();
