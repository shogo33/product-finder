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

  /* ── ヘッダー同期注入（FOUC防止）─────────────── */
  // <script id="site-header-inject"> タグをヘッダーに差し替える
  var injectScript = document.getElementById('site-header-inject');
  if (injectScript) {
    var headerEl = document.createElement('div');
    headerEl.innerHTML = HEADER_HTML;
    injectScript.replaceWith(headerEl.firstChild);
  }

  /* ── フッター・スティッキーCTAはDOMContentLoaded後 */
  document.addEventListener('DOMContentLoaded', function () {
    var footer = document.getElementById('site-footer');
    if (footer) footer.innerHTML = FOOTER_HTML;

    var cta = document.getElementById('cta-sticky');
    if (cta) cta.innerHTML = STICKY_CTA_HTML;
  });

})();
