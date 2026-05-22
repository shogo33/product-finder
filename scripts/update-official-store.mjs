/**
 * 公式ストア商品のみに絞る更新スクリプト
 * - 非公式セラー商品を削除/置換
 * - アフィリエイトリンクを公式ストア版に更新
 * - Amazonで見る（確認中）ボタンを削除
 */
import fs from 'fs';
import path from 'path';

const BASE = path.resolve('public/basics');

// ============================================================
// 1. ugreen-earphone-osusume.html
// ============================================================
function updateEarphone() {
  const file = path.join(BASE, 'ugreen-earphone-osusume.html');
  let html = fs.readFileSync(file, 'utf8');

  // --- Intro: X6 → P3 ---
  html = html.replace(
    '<strong>UGREEN HiTune X6 / T3 Pro / Max5c / S5 / S3</strong>の5モデルを徹底比較します',
    '<strong>UGREEN HiTune P3 / T3 Pro / Max5c / S5 / S3</strong>の5モデルを徹底比較します'
  );

  // --- Product 1 section: X6 → P3 ---
  const x6SectionStart = '    <!-- @product-start id="1005008120529417" type="ガジェット" tag="ガジェット" -->';
  const x6SectionEnd = '    <!-- @product-end -->\n\n    <!-- @product-start id="1005007302181092"';
  const x6Start = html.indexOf(x6SectionStart);
  const x6End = html.indexOf('    <!-- @product-end -->\n\n    <!-- @product-start id="1005007302181092"');
  if (x6Start !== -1 && x6End !== -1) {
    const p3Section = `    <!-- @product-start id="1005007090781035" type="ガジェット" tag="ガジェット" -->
    <h2>【第1位】UGREEN HiTune P3 ｜公式ストア最安・コスパ最強のオープンイヤー</h2>

    <div class="product-carousel" data-carousel>
      <div class="carousel-track">
        <img src="https://ae-pic-a1.aliexpress-media.com/kf/S9e7e5ef3a5964a7cac80a74a4e2e37aaU.jpg" alt="UGREEN HiTune P3" loading="lazy">
      </div>
      <button class="carousel-btn prev" aria-label="前の画像">&#8249;</button>
      <button class="carousel-btn next" aria-label="次の画像">&#8250;</button>
      <div class="carousel-dots"></div>
    </div>

    <p>結論から言います。<strong>UGREEN HiTune P3は「Ugreen Official Store」から3,000円台で買えるオープンイヤーTWS</strong>です。UGREENブランドを初めて試す人の入口として、そして毎日の軽量モデルとして、これほどコスパに優れた選択肢はありません。</p>

    <h3>スペック・使い心地・スポーツ適性</h3>

    <p>UGREEN HiTune P3の主要スペックをまとめます。</p>

    <ul>
      <li><strong>装着方式</strong>：オープンイヤー（耳かけクリップ型）</li>
      <li><strong>連続再生時間</strong>：イヤホン単体約9時間・ケース込み最大36時間</li>
      <li><strong>接続方式</strong>：Bluetooth 5.3</li>
      <li><strong>対応コーデック</strong>：SBC / AAC</li>
      <li><strong>防水規格</strong>：IPX5</li>
      <li><strong>重量</strong>：片耳約6g</li>
    </ul>

    <p>オープンイヤー構造なので<strong>耳を塞がずに外音を聞きながら音楽を楽しめます</strong>。ランニング中の車の音、駅のアナウンス、話しかけられた声をそのまま聞き取れるため、安全性と利便性を両立したモデルです。片耳約6gという極軽設計で、長時間使っても耳への負担がほぼゼロ。IPX5防水で汗・小雨にも対応します。</p>

    <p><strong>AliExpress購入時の注意点</strong>：価格は約¥3,254（セール非適用時）。「Ugreen Official Store」からの購入が確実です。<a href="/basics/aliexpress-choice.html">AliExpress Choiceマークの意味と安心して買える理由</a>も合わせて読んでおくと、セラー選びで迷いません。</p>

    <div class="cta-box">
      <p class="cta-lead">【UGREEN HiTune P3】をAliExpressで見る</p>
      <p class="cta-sub">Ugreen Official Store 公式出品｜送料無料・到着2〜4週間</p>
      <div class="cta-buttons">
        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3eTHcpf" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
      </div>
      <p class="cta-note">※ AliExpressリンクはアフィリエイトリンクです</p>
    </div>

    <h3>こんな人におすすめ｜向き不向きを正直に解説</h3>

    <p><strong>UGREEN HiTune P3が刺さる人</strong>：</p>
    <ul>
      <li>3,000円台でUGREENを試してみたい入門者</li>
      <li>ランニング・ウォーキングで外音を聞きながら使いたい</li>
      <li>36時間バッテリーで充電の手間を減らしたい</li>
      <li>軽量モデルで耳が疲れない一本を探している</li>
    </ul>

    <p><strong>向かない人</strong>：</p>
    <ul>
      <li>ANCで騒音をカットして集中したい（→ HiTune T3 Pro へ）</li>
      <li>LDACで最高音質を求めている（→ HiTune Max5c へ）</li>
    </ul>
    <!-- @product-end -->

    <!-- @product-start id="1005007302181092"`;
    html = html.slice(0, x6Start) + p3Section + html.slice(x6End + x6SectionEnd.length);
  } else {
    console.error('X6 section not found!', x6Start, x6End);
  }

  // --- T3 Pro: update link, remove Amazon button ---
  html = html.replace(
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3A7ev7j" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
        <!-- AMAZON_PENDING: Ugreen HiTune T3 Pro Bluetooth Wireless Earbuds -->
        <a class="cta-btn-amazon" href="#" data-amazon-query="Ugreen HiTune T3 Pro Bluetooth Wireless Earbuds" aria-disabled="true" style="opacity:0.45;pointer-events:none;cursor:not-allowed;">Amazonで見る（確認中）</a>`,
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3hDldHj" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`
  );
  // Update T3 Pro price in text
  html = html.replace('AliExpressでの価格はほぼ同等（約¥11,000台）', 'AliExpressでの価格はほぼ同等（約¥11,000〜¥12,000台）');

  // --- Max5c: update link, remove Amazon button, update price ---
  html = html.replace(
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3CTotkd" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
        <!-- AMAZON_PENDING: UGREEN HiTune Max5c -->
        <a class="cta-btn-amazon" href="#" data-amazon-query="UGREEN HiTune Max5c" aria-disabled="true" style="opacity:0.45;pointer-events:none;cursor:not-allowed;">Amazonで見る（確認中）</a>`,
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3MtqRuv" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`
  );
  html = html.replace('UGREEN HiTune Max5cが約¥6,469というのは', 'UGREEN HiTune Max5cが約¥6,808というのは');
  html = html.replace('価格はAliExpressで約¥6,469', '価格はAliExpressで約¥6,808');

  // --- S5: update link, remove Amazon button, update price ---
  html = html.replace(
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c4XCg42H" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
        <!-- AMAZON_PENDING: Ugreen HiTune S5 TWS Open Ear Wireless Earphones -->
        <a class="cta-btn-amazon" href="#" data-amazon-query="Ugreen HiTune S5 TWS Open Ear Wireless Earphones" aria-disabled="true" style="opacity:0.45;pointer-events:none;cursor:not-allowed;">Amazonで見る（確認中）</a>`,
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c4EcsxFn" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`
  );
  html = html.replace('AliExpressでの価格は約¥4,294で', 'AliExpressでの価格は約¥4,800で');

  // --- S3: update @product-start id, update link, remove Amazon button, update price ---
  html = html.replace(
    '<!-- @product-start id="1005007145786996" type="ガジェット" tag="ガジェット" -->',
    '<!-- @product-start id="1005007145988747" type="ガジェット" tag="ガジェット" -->'
  );
  html = html.replace(
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c44B4lqZ" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
        <!-- AMAZON_PENDING: Ugreen HiTune S3 -->
        <a class="cta-btn-amazon" href="#" data-amazon-query="Ugreen HiTune S3" aria-disabled="true" style="opacity:0.45;pointer-events:none;cursor:not-allowed;">Amazonで見る（確認中）</a>`,
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c4PJuuit" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`
  );
  html = html.replace('AliExpressでの価格は約¥3,095', 'AliExpressでの価格は約¥3,254');

  // --- Comparison table ---
  html = html.replace(
    `          <tr>
            <td><strong>HiTune X6</strong></td>
            <td>¥11,191</td>
            <td>Bluetooth 5.3 TWS</td>
            <td>✅ あり（-35dB）</td>
            <td>SBC / AAC / LDAC</td>
            <td>最大35時間</td>
          </tr>`,
    `          <tr>
            <td><strong>HiTune P3</strong></td>
            <td>¥3,254</td>
            <td>Bluetooth 5.3 TWS（オープンイヤー）</td>
            <td>❌ なし</td>
            <td>SBC / AAC</td>
            <td>最大36時間</td>
          </tr>`
  );
  html = html.replace(
    `            <td><strong>HiTune T3 Pro</strong></td>
            <td>¥11,361</td>`,
    `            <td><strong>HiTune T3 Pro</strong></td>
            <td>¥11,349</td>`
  );
  html = html.replace(
    `            <td><strong>HiTune Max5c</strong></td>
            <td>¥6,469</td>`,
    `            <td><strong>HiTune Max5c</strong></td>
            <td>¥6,808</td>`
  );
  html = html.replace(
    `            <td><strong>HiTune S5</strong></td>
            <td>¥4,294</td>`,
    `            <td><strong>HiTune S5</strong></td>
            <td>¥4,800</td>`
  );
  html = html.replace(
    `            <td><strong>HiTune S3</strong></td>
            <td>¥3,095</td>`,
    `            <td><strong>HiTune S3</strong></td>
            <td>¥3,254</td>`
  );

  // --- Use-case summary: add P3 entry, update X6 references ---
  html = html.replace(
    '      <li><strong>予算3,000円台・入門者</strong>→ <strong>UGREEN HiTune S3</strong>（軽量・コスパ最強）</li>',
    '      <li><strong>予算3,000円台・入門者</strong>→ <strong>UGREEN HiTune P3</strong>（公式ストア最安のオープンイヤー）または <strong>HiTune S3</strong></li>'
  );
  html = html.replace(
    '      <li><strong>音質最重視・LDACが欲しい</strong>→ <strong>UGREEN HiTune X6</strong>（ハイブリッドドライバー×LDAC）</li>',
    '      <li><strong>音質最重視・LDACが欲しい</strong>→ <strong>UGREEN HiTune Max5c</strong>（ハイレゾ×LDAC×70時間バッテリー）</li>'
  );

  // --- "迷ったらこれ" recommendation ---
  html = html.replace(
    '🏆 <strong>編集部ピック「迷ったらこれ」</strong>：<strong>UGREEN HiTune X6</strong>。ANC・LDAC・IPX5・35時間バッテリーを¥11,000台で全部まとめて手に入れられる。これがUGREENイヤホンの現時点での最適解です。',
    '🏆 <strong>編集部ピック「迷ったらこれ」</strong>：<strong>UGREEN HiTune T3 Pro</strong>。ANC・ゲーミングモード・IPX5・35時間バッテリーを¥11,000台で実現した万能機。公式ストアで買えるUGREENイヤホンの現時点での最適解です。'
  );

  // --- FAQ Q3: X6 → T3 Pro reference ---
  html = html.replace(
    'UGREEN HiTune X6のANC性能はカフェ・電車・エアコン音を実用レベルでシャットアウトできます。コスパ比較ではUGREENが明確に有利です。',
    'UGREEN HiTune T3 Proのカフェ・電車・エアコン音をシャットアウトできるANC性能は、コスパで比較すると同価格帯のAnker製品を上回ります。UGREEN公式ストアから購入できる点も安心です。'
  );

  fs.writeFileSync(file, html, 'utf8');
  console.log('✅ ugreen-earphone-osusume.html updated');
}

// ============================================================
// 2. ugreen-mouse-osusume.html
// ============================================================
function updateMouse() {
  const file = path.join(BASE, 'ugreen-mouse-osusume.html');
  let html = fs.readFileSync(file, 'utf8');

  // --- Product 1 (4000DPI): update @product-start id, link, remove Amazon button, update price ---
  html = html.replace(
    '<!-- @product-start id="1005007493318927" type="ガジェット" tag="ガジェット" -->',
    '<!-- @product-start id="1005010407250939" type="ガジェット" tag="ガジェット" -->'
  );
  html = html.replace(
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c2yYRUxP" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
        <!-- AMAZON_PENDING: UGREEN Wireless Mouse 4000DPI -->
        <a class="cta-btn-amazon" href="#" data-amazon-query="UGREEN Wireless Mouse 4000DPI" aria-disabled="true" style="opacity:0.45;pointer-events:none;cursor:not-allowed;">Amazonで見る（確認中）</a>`,
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3X4BQ9P" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`
  );
  html = html.replace('¥2,736という価格帯でここまで揃っているのは', '¥2,261という価格帯でここまで揃っているのは');

  // --- Product 2 (Silent): update @product-start id, link, remove Amazon button, update price ---
  html = html.replace(
    '<!-- @product-start id="1005006505424884" type="ガジェット" tag="ガジェット" -->',
    '<!-- @product-start id="1005006775919743" type="ガジェット" tag="ガジェット" -->'
  );
  html = html.replace(
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c4k5btkz" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
        <!-- AMAZON_PENDING: UGREEN Wireless Silent Mouse -->
        <a class="cta-btn-amazon" href="#" data-amazon-query="UGREEN Wireless Silent Mouse" aria-disabled="true" style="opacity:0.45;pointer-events:none;cursor:not-allowed;">Amazonで見る（確認中）</a>`,
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c2vZedNF" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`
  );
  html = html.replace(
    '<strong>¥2,025という価格帯で静音マウスを手に入れられる最安クラスのモデル</strong>です',
    '<strong>¥1,637という価格帯で静音マウスを手に入れられる最安クラスのモデル</strong>です'
  );
  html = html.replace('¥2,025という価格を考えると', '¥1,637という価格を考えると');

  // --- Product 3 (Vertical): update @product-start id, link, remove Amazon button, update price ---
  html = html.replace(
    '<!-- @product-start id="1005011907226917" type="ガジェット" tag="ガジェット" -->',
    '<!-- @product-start id="1005006232679258" type="ガジェット" tag="ガジェット" -->'
  );
  html = html.replace(
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3N484Vx" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
        <!-- AMAZON_PENDING: UGREEN Vertical Wireless Mouse Bluetooth 5.0 2.4G -->
        <a class="cta-btn-amazon" href="#" data-amazon-query="UGREEN Vertical Wireless Mouse Bluetooth 5.0 2.4G" aria-disabled="true" style="opacity:0.45;pointer-events:none;cursor:not-allowed;">Amazonで見る（確認中）</a>`,
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c43JOa3T" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`
  );
  html = html.replace('¥3,568と今回の4台の中では最高値ですが', '¥3,099と今回の4台の中では最高値ですが');

  // --- Product 4 (BT5.0 → Hyper-Fast Scroll): full section replacement ---
  const bt50Start = '    <!-- @product-start id="1005012268942587" type="ガジェット" tag="ガジェット" -->';
  const bt50EndMarker = '    <!-- @product-end -->\n\n    <h2>UGREENマウス4選スペック比較表</h2>';
  const bt50StartIdx = html.indexOf(bt50Start);
  const bt50EndIdx = html.indexOf(bt50EndMarker);
  if (bt50StartIdx !== -1 && bt50EndIdx !== -1) {
    const hyperSection = `    <!-- @product-start id="1005007592535777" type="ガジェット" tag="ガジェット" -->
    <h2>【第4位】UGREEN Hyper-Fast Scroll Mouse｜超高速スクロールホイール・Bluetooth対応</h2>

    <div class="product-carousel" data-carousel>
      <div class="carousel-track">
        <img src="https://ae-pic-a1.aliexpress-media.com/kf/Sf79042b3ba29461eb1f7fa11e01c2788x.jpg" alt="UGREEN Hyper-Fast Scroll Mouse" loading="lazy">
      </div>
      <button class="carousel-btn prev" aria-label="前の画像">&#8249;</button>
      <button class="carousel-btn next" aria-label="次の画像">&#8250;</button>
      <div class="carousel-dots"></div>
    </div>

    <h3>Bluetooth 5.4＋2.4GHz 両対応・超高速スクロールの実力</h3>
    <p>UGREEN Hyper-Fast Scroll Mouseは<strong>「高速スクロールホイールでドキュメント・ページを一瞬で移動したい」というパワーユーザーへの答え</strong>です。¥3,797という価格でBluetooth 5.4と2.4GHzの両接続に対応し、独自の慣性スクロール機構を搭載しています。</p>

    <p>主なスペックはこちら：</p>
    <ul>
      <li>📡 <strong>接続</strong>：Bluetooth 5.4 ＋ 2.4GHz ワイヤレス両対応（最大3デバイス切り替え）</li>
      <li>🌀 <strong>スクロール</strong>：Hyper-Fast慣性スクロールホイール（高速・低速切り替え対応）</li>
      <li>🎯 <strong>最大DPI</strong>：8000DPI（段階切り替え）</li>
      <li>💻 <strong>対応OS</strong>：Windows・macOS対応</li>
      <li>🔋 <strong>バッテリー</strong>：充電式（USB-C充電）</li>
    </ul>

    <p>慣性スクロール（ハイパースクロール）は、ホイールを強く回すと慣性でそのまま高速にページを送れる機構。長いドキュメント・Excelシート・Webページを一瞬で上から下まで移動できるため、<strong>デザイナー・プログラマー・リサーチ職など画面スクロールが多い仕事に特に刺さります</strong>。</p>

    <p>Bluetooth 5.4で最大3デバイスとペアリングでき、ボタン一つで切り替え可能。PC・Mac・iPadを行き来するマルチデバイスユーザーにも対応しています。</p>

    <h3>こんな人におすすめ</h3>
    <ul>
      <li>✅ 長いドキュメント・Excelを頻繁にスクロールする人</li>
      <li>✅ Bluetooth接続でUSBポートを節約したい人</li>
      <li>✅ PC・Mac・iPadのマルチデバイス環境の人</li>
      <li>✅ 8000DPIの精密操作を必要とするデザイナー</li>
    </ul>

    <div class="cta-box">
      <p class="cta-lead">【UGREEN Hyper-Fast Scroll Mouse】をAliExpressで見る</p>
      <p class="cta-sub">Ugreen Official Store 公式出品｜送料無料・到着2〜4週間</p>
      <div class="cta-buttons">
        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3dOFEVP" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
      </div>
      <p class="cta-note">※ AliExpressリンクはアフィリエイトリンクです</p>
    </div>
    <!-- @product-end -->

    <h2>UGREENマウス4選スペック比較表</h2>`;
    html = html.slice(0, bt50StartIdx) + hyperSection + html.slice(bt50EndIdx + bt50EndMarker.length);
  } else {
    console.error('BT5.0 section not found!', bt50StartIdx, bt50EndIdx);
  }

  // --- Comparison table: update prices and add Hyper-Fast row ---
  html = html.replace(
    `          <tr>
            <td>UGREEN Wireless Mouse 4000DPI</td>
            <td>¥2,736</td>
            <td>2.4GHz</td>
            <td>4000DPI</td>
            <td>✅ あり</td>
            <td>約70g前後</td>
          </tr>
          <tr>
            <td>UGREEN Wireless Silent Mouse</td>
            <td>¥2,025</td>
            <td>2.4GHz</td>
            <td>1600DPI前後</td>
            <td>✅ あり</td>
            <td>約60g前後</td>
          </tr>
          <tr>
            <td>UGREEN Vertical Wireless Mouse BT5.0 2.4G</td>
            <td>¥3,568</td>
            <td>Bluetooth 5.0＋2.4GHz</td>
            <td>4000DPI</td>
            <td>✅ あり</td>
            <td>約100g前後</td>
          </tr>
          <tr>
            <td>UGREEN Wireless Mouse Bluetooth 5.0</td>
            <td>¥2,541</td>
            <td>Bluetooth 5.0</td>
            <td>4000DPI</td>
            <td>✅ あり（6ボタン全静音）</td>
            <td>約70g前後</td>
          </tr>`,
    `          <tr>
            <td>UGREEN Wireless Mouse 4000DPI</td>
            <td>¥2,261</td>
            <td>2.4GHz</td>
            <td>4000DPI</td>
            <td>✅ あり</td>
            <td>約70g前後</td>
          </tr>
          <tr>
            <td>UGREEN Wireless Silent Mouse</td>
            <td>¥1,637</td>
            <td>2.4GHz</td>
            <td>1600DPI前後</td>
            <td>✅ あり</td>
            <td>約60g前後</td>
          </tr>
          <tr>
            <td>UGREEN Vertical Wireless Mouse BT5.0 2.4G</td>
            <td>¥3,099</td>
            <td>Bluetooth 5.0＋2.4GHz</td>
            <td>4000DPI</td>
            <td>✅ あり</td>
            <td>約100g前後</td>
          </tr>
          <tr>
            <td>UGREEN Hyper-Fast Scroll Mouse</td>
            <td>¥3,797</td>
            <td>Bluetooth 5.4＋2.4GHz</td>
            <td>8000DPI</td>
            <td>✅ あり</td>
            <td>約80g前後</td>
          </tr>`
  );

  // --- Update summary references ---
  html = html.replace(
    '<li>📶 <strong>マルチデバイス・Bluetooth派</strong> UGREEN Wireless Mouse Bluetooth 5.0（USBポートゼロで済む）</li>',
    '<li>🌀 <strong>マルチデバイス・高速スクロール派</strong> UGREEN Hyper-Fast Scroll Mouse（Bluetooth 5.4×8000DPI×慣性スクロール）</li>'
  );
  html = html.replace(
    '<li>📶 <strong>Bluetooth派・スッキリデスク派なら</strong>：UGREEN Wireless Mouse Bluetooth 5.0（¥2,541）。ドングルレスで全ボタン静音という組み合わせがMacBookユーザーに刺さります。</li>',
    '<li>🌀 <strong>マルチデバイス・スクロール多用派なら</strong>：UGREEN Hyper-Fast Scroll Mouse（¥3,797）。Bluetooth 5.4×高速スクロールホイールで作業効率が上がります。</li>'
  );
  html = html.replace(
    'いう人は<strong>UGREEN Wireless Mouse Bluetooth 5.0を選んでおけば間違いありません</strong>。ドングルレスで全ボタン静音という組み合わせがMacBookユーザーに刺さります。',
    'いう人は<strong>UGREEN Wireless Mouse 4000DPIを選んでおけば間違いありません</strong>。静音・高DPI・Mac対応と三拍子揃っています。'
  );
  html = html.replace(
    '<li>✅ MacBook Air/Proを使っていてUSBポートが貴重な人</li>\n      <li>✅ PCとiPadを頻繁に行き来するタブレットワーカー</li>\n      <li>✅ デスクをケーブル・ドングルレスでスッキリさせたい人</li>',
    ''
  );
  // Update "迷ったらこれ" in mouse article
  html = html.replace(
    '迷っているなら<strong>UGREEN Wireless Mouse 4000DPIを選んでおけば間違いありません</strong>。後悔する要素がほぼありません。',
    '迷っているなら<strong>UGREEN Wireless Mouse 4000DPI（¥2,261）を選んでおけば間違いありません</strong>。静音・高DPI・Mac対応と三拍子揃っています。'
  );

  // Update Q5 reference
  html = html.replace(
    'UGREEN Wireless Mouse Bluetooth 5.0はドングル不要でBluetoothペアリングするだけなので、USB-Cポートしかないモデルにも最適です。',
    'UGREEN Hyper-Fast Scroll MouseはBluetooth 5.4対応でドングル不要。USB-Cポートしかない薄型MacBookにも最適です。'
  );

  fs.writeFileSync(file, html, 'utf8');
  console.log('✅ ugreen-mouse-osusume.html updated');
}

// ============================================================
// 3. ugreen-cable-osusume.html
// ============================================================
function updateCable() {
  const file = path.join(BASE, 'ugreen-cable-osusume.html');
  let html = fs.readFileSync(file, 'utf8');

  // --- Product 1 (USB-C 100W → 100W 2本セット): update id, link, remove Amazon button ---
  html = html.replace(
    '<!-- @product-start id="1005006471612403" type="ガジェット" tag="ガジェット" -->',
    '<!-- @product-start id="1005007458232973" type="ガジェット" tag="ガジェット" -->'
  );
  html = html.replace(
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c4KsoBhX" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
        <!-- AMAZON_PENDING: UGREEN USB-C Data Cable -->
        <a class="cta-btn-amazon" href="#" data-amazon-query="UGREEN USB-C Data Cable" aria-disabled="true" style="opacity:0.45;pointer-events:none;cursor:not-allowed;">Amazonで見る（確認中）</a>`,
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3zDXyqZ" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`
  );
  // Update price in text (¥493 → ¥1,626 for 2本セット)
  html = html.replace(
    '<strong>AliExpress価格：¥493（評価97.5% / 販売数21,340件）</strong>',
    '<strong>AliExpress価格：¥1,626（2本セット）（Ugreen Official Store）</strong>'
  );
  html = html.replace('正直、¥493でこのスペックは異常です。国内で同等スペックのケーブルを探すと¥1,200〜¥1,500はする。AliExpressで買う理由がここにあります。', '¥1,626で2本セット、つまり1本あたり¥813。100W・10Gbps・編み込みナイロンのケーブルがこの価格で2本揃うのは、Ugreen Official Storeならではのコスパです。');
  // Also update bottom CTA reference
  html = html.replace(
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c4KsoBhX" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
        <!-- AMAZON_PENDING: UGREEN USB-C Data Cable -->
        <a class="cta-btn-amazon" href="#" data-amazon-query="UGREEN USB-C Data Cable" aria-disabled="true" style="opacity:0.45;pointer-events:none;cursor:not-allowed;">Amazonで見る（確認中）</a>`,
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3zDXyqZ" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`
  );

  // --- Product 2 (Lightning MFi → 90度 USB-C): full replacement ---
  const lightningStart = '    <!-- @product-start id="1005008328100460" type="ガジェット" tag="ガジェット" -->';
  const lightningEndMarker = '    <!-- @product-end -->\n\n    <!-- アプリ誘導バナー -->';
  const lightningStartIdx = html.indexOf(lightningStart);
  const lightningEndIdx = html.indexOf(lightningEndMarker, lightningStartIdx);
  if (lightningStartIdx !== -1 && lightningEndIdx !== -1) {
    const cable90Section = `    <!-- @product-start id="4001132667842" type="ガジェット" tag="ガジェット" -->
    <h2>【第2位】UGREEN 90度 USB-C ケーブル PD100W</h2>

    <div class="product-carousel" data-carousel>
      <div class="carousel-track">
        <img src="https://ae-pic-a1.aliexpress-media.com/kf/S2e6296c45cb0497e93de1ae9adf44390X.jpg" alt="UGREEN 90度 USB-C ケーブル" loading="lazy">
      </div>
      <button class="carousel-btn prev" aria-label="前の画像">&#8249;</button>
      <button class="carousel-btn next" aria-label="次の画像">&#8250;</button>
      <div class="carousel-dots"></div>
    </div>

    <h3>スペックと特徴</h3>
    <p><strong>AliExpress価格：¥618（Ugreen Official Store）</strong></p>
    <p>L字型（90度）コネクターで、<strong>デスク周りのケーブルをすっきり取り回せる実用的な一本</strong>です。最大100W PD充電対応で、MacBook・iPad Pro・Androidハイエンドスマホの充電が可能。ケーブルが手前に来るL字コネクターは、モバイル中の充電・充電器付近のレイアウトを格段に使いやすくします。</p>

    <ul>
      <li><strong>最大100W PD充電対応</strong>：MacBook Air・iPad Pro・Androidフラッグシップまでカバー</li>
      <li><strong>L字（90度）コネクター</strong>：机の角や狭いスペースでも邪魔にならない取り回し</li>
      <li><strong>Ugreen Official Store</strong>：公式ストア直販で品質保証済み</li>
      <li><strong>¥618という圧倒的コスパ</strong>：100W対応でこの価格はOfficial Storeならでは</li>
    </ul>

    <p>「充電中にケーブルが邪魔になる」という悩みを根本から解決してくれるのがL字ケーブルの魅力。特にソファや枕元での充電、バックパック内での取り回しで重宝します。</p>

    <div class="cta-box">
      <p class="cta-lead">【UGREEN 90度 USB-C ケーブル】をAliExpressで見る</p>
      <p class="cta-sub">Ugreen Official Store 公式出品｜送料無料・到着2〜4週間</p>
      <div class="cta-buttons">
        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c4Cy9bOz" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
      </div>
      <p class="cta-note">※ AliExpressリンクはアフィリエイトリンクです</p>
    </div>
    <!-- @product-end -->

    <!-- アプリ誘導バナー -->`;
    html = html.slice(0, lightningStartIdx) + cable90Section + html.slice(lightningEndIdx + lightningEndMarker.length);
  } else {
    console.error('Lightning section not found!', lightningStartIdx, lightningEndIdx);
  }

  // --- Product 3 (UNO): update link ---
  html = html.replace(
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3jWtCdj" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`,
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3ybyc6t" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`
  );

  // --- Product 4 (HDMI 8K → HDMI+PD): update id, link, update description ---
  html = html.replace(
    '<!-- @product-start id="1005005659085072" type="ガジェット" tag="ガジェット" -->',
    '<!-- @product-start id="1005008665966143" type="ガジェット" tag="ガジェット" -->'
  );
  html = html.replace(
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c4Ty09ah" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`,
    `        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3oswDKd" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`
  );
  html = html.replace(
    '<h2>【第4位】UGREEN USB C to HDMI Cable 8K</h2>',
    '<h2>【第4位】UGREEN USB-C to HDMI+PD Cable</h2>'
  );
  html = html.replace(
    '<strong>AliExpress価格：¥2,100（評価97.3% / 販売数2,942件）</strong>\n    <p>PCやスマホをテレビ・モニターに映したいなら必携の1本。8K@30Hz・4K@120Hz・HDR対応で、MacBook・iPad Pro・最新Androidスマホからの映像出力を完全カバー。¥2,100でこのスペックは格安です。</p>',
    '<strong>AliExpress価格：¥3,275（Ugreen Official Store）</strong>\n    <p>PCやスマホをテレビ・モニターに映しながら同時充電できる、映像出力＋PD充電の2in1ケーブル。MacBook・iPad Pro・最新Androidスマホからの映像出力と同時に、最大100W PD充電が可能。Ugreen Official Store直販で品質保証済みです。</p>'
  );

  // --- Product 5 (DisplayPort → Retractable): full replacement ---
  const dpStart = '    <!-- @product-start id="32516394446" type="ガジェット" tag="ガジェット" -->';
  const dpEndMarker = '    <!-- @product-end -->\n\n    <h2>UGREENケーブルの選び方';
  const dpStartIdx = html.indexOf(dpStart);
  const dpEndIdx = html.indexOf(dpEndMarker, dpStartIdx);
  if (dpStartIdx !== -1 && dpEndIdx !== -1) {
    const retractSection = `    <!-- @product-start id="1005009961902161" type="ガジェット" tag="ガジェット" -->
    <h2>【第5位】UGREEN リトラクタブル USB-C ケーブル</h2>

    <div class="product-carousel" data-carousel>
      <div class="carousel-track">
        <img src="https://ae-pic-a1.aliexpress-media.com/kf/S2e6296c45cb0497e93de1ae9adf44390X.jpg" alt="UGREEN リトラクタブル USB-C ケーブル" loading="lazy">
      </div>
      <button class="carousel-btn prev" aria-label="前の画像">&#8249;</button>
      <button class="carousel-btn next" aria-label="次の画像">&#8250;</button>
      <div class="carousel-dots"></div>
    </div>

    <p><strong>AliExpress価格：¥2,396（UGREEN Flagship Store）</strong></p>
    <p>伸縮する巻き取り式のUSB-Cケーブル。<strong>ケーブルが絡まらず、使いたい長さに自在に調整できる</strong>ため、カバンの中での収まりが抜群です。コンパクトに収納できるので、モバイルワーカー・旅行者・学生の「持ち歩き専用ケーブル」として最適な1本です。100W PD充電対応で、MacBook・スマホ・タブレットを1本でカバーできます。</p>
    <p>UGREENのイヤホンや他のガジェットも気になる方は<a href="/basics/ugreen-earphone-osusume.html">UGREENイヤホンのおすすめ比較記事</a>も参考にしてみてください。</p>
    <div class="cta-box">
      <div class="cta-buttons">
        <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c4OimRCD" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
      </div>
      <p class="cta-note">※ AliExpressリンクはアフィリエイトリンクです</p>
    </div>
    <!-- @product-end -->

    <h2>UGREENケーブルの選び方`;
    html = html.slice(0, dpStartIdx) + retractSection + html.slice(dpEndIdx + dpEndMarker.length);
  } else {
    console.error('DP section not found!', dpStartIdx, dpEndIdx);
  }

  // --- Update summary table to reflect new products ---
  html = html.replace(
    `      <li><strong>UGREEN USB-C Data Cable（¥493）</strong>：100W対応のコスパ最強ケーブル。迷ったらこれ</li>
      <li><strong>UGREEN USB-C Cable MFi（¥717）</strong>：iPhone（Lightning）ユーザーへの唯一解。MFi認証の安心感は別格</li>
      <li><strong>UGREEN UNO PD100W USB-C Cable（¥994）</strong>：プレミアムラインでデザインも妥協しない人向け</li>
      <li><strong>UGREEN USB C to HDMI Cable 8K（¥2,100）</strong>：映像出力の汎用性No.1。テレワーク・プレゼン・ゲームに</li>
      <li><strong>Ugreen DisplayPort Cable DP1.4（¥1,656）</strong>：ゲーマー向け最強映像ケーブル。4K144Hzも余裕でこなす</li>`,
    `      <li><strong>UGREEN USB-C PD100W 2本セット（¥1,626）</strong>：100W対応ケーブルが2本でこの価格。迷ったらこれ</li>
      <li><strong>UGREEN 90度 USB-C ケーブル（¥618）</strong>：L字コネクターで取り回し抜群。デスク・枕元充電に</li>
      <li><strong>UGREEN UNO PD100W USB-C Cable（¥994）</strong>：プレミアムラインでデザインも妥協しない人向け</li>
      <li><strong>UGREEN USB-C to HDMI+PD Cable（¥3,275）</strong>：映像出力＋同時充電の2in1。テレワーク・プレゼンに</li>
      <li><strong>UGREEN リトラクタブル USB-C（¥2,396）</strong>：巻き取り式で持ち歩き最強。旅行・カバン内整理に</li>`
  );
  html = html.replace(
    '<strong>UGREEN USB-C Data Cableを買ってください。</strong>',
    '<strong>UGREEN USB-C PD100W 2本セットを買ってください。</strong>'
  );
  html = html.replace(
    '¥493・100W・10Gbps・編み込みナイロン。スペックだけ見ると1,000円オーバーの他社製品に全く引けを取らない。このケーブルを1本買えば、MacBook・iPad・AndroidスマホなどほぼすべてのUSB-C機器の充電とデータ転送がカバーできます。「迷ったらこれ」という最強のオールラウンダーです。',
    '¥1,626で2本セット、つまり1本あたり¥813。100W・10Gbps・編み込みナイロンのケーブルを2本揃えても1,700円以下。家に1本・カバンに1本という運用が格安で実現できます。「迷ったらこれ」という最強のオールラウンダーです。'
  );
  html = html.replace(
    '<p class="cta-lead">【UGREEN USB-C Data Cable】をまずチェックしよう</p>',
    '<p class="cta-lead">【UGREEN USB-C PD100W 2本セット】をまずチェックしよう</p>'
  );

  fs.writeFileSync(file, html, 'utf8');
  console.log('✅ ugreen-cable-osusume.html updated');
}

// ============================================================
// 4. baseus-mobile-battery-osusume.html
// ============================================================
function updateBaseus() {
  const file = path.join(BASE, 'baseus-mobile-battery-osusume.html');
  let html = fs.readFileSync(file, 'utf8');

  // --- Product 1 (Magnetic 5000mAh → Qi2 5000mAh): update id, link, content ---
  html = html.replace(
    '<!-- @product-start id="1005008708384313" type="ガジェット" tag="ガジェット" -->',
    '<!-- @product-start id="1005009703807498" type="ガジェット" tag="ガジェット" -->'
  );
  html = html.replace(
    `    <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3IkW4TX" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
    <!-- AMAZON_PENDING: Baseus Magnetic Power Bank 5000mAh -->
    <a class="cta-btn-amazon" href="#" data-amazon-query="Baseus Magnetic Power Bank 5000mAh" aria-disabled="true" style="opacity:0.45;pointer-events:none;cursor:not-allowed;">Amazonで見る（確認中）</a>`,
    `    <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3pOWbe5" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`
  );
  html = html.replace(
    '<h2 id="magnetic-mini">【軽量コンパクト派に】Baseus Magnetic Power Bank 5000mAh</h2>',
    '<h2 id="magnetic-mini">【軽量コンパクト派に】Baseus Qi2 磁気モバイルバッテリー 5000mAh</h2>'
  );
  html = html.replace(
    'Baseus Magnetic Power Bank 5000mAhは、<strong>MagSafe互換のマグネット充電に対応したコンパクトモデル</strong>です。iPhone 14/15シリーズユーザーが「背面にペタッと貼り付けて使う」ためのモバイルバッテリーとして設計されています。',
    'Baseus Qi2磁気モバイルバッテリー 5000mAhは、<strong>Qi2（Apple MagSafe対応）の磁気吸着充電に対応したコンパクトモデル</strong>です。BASEUS Official Storeから購入できる公式版で、iPhone 14/15シリーズユーザーが「背面にペタッと貼り付けて使う」スタイルを実現します。'
  );
  html = html.replace(
    'AliExpressの「Baseus Official Store」での実売価格は<strong>約2,200〜2,800円</strong>。Amazonでの国内販売価格が3,500〜4,200円前後であることを考えると、1,000円以上の差があります。',
    'AliExpressの「BASEUS Official Store」での実売価格は<strong>約¥8,741</strong>。Qi2対応・磁気吸着充電の公式品として、品質と安心感を重視する方に最適です。'
  );
  html = html.replace(
    '<p class="cta-lead">【Baseus Magnetic Power Bank 5000mAh】をどちらで買う？価格・配送を比較</p>',
    '<p class="cta-lead">【Baseus Qi2 磁気モバイルバッテリー 5000mAh】をAliExpressで見る</p>'
  );
  html = html.replace(
    '<img src="https://ae-pic-a1.aliexpress-media.com/kf/Sa5d4b23815ba4dd6a71a709f288033edj.jpg" alt="Baseus Magnetic Power Bank 5000mAh" loading="lazy">',
    '<img src="https://ae-pic-a1.aliexpress-media.com/kf/S2b783cbff13043a7b1727f965a3e400ba.jpg" alt="Baseus Qi2 磁気モバイルバッテリー 5000mAh" loading="lazy">'
  );

  // --- Product 2 (10000mAh): update link only ---
  html = html.replace(
    `    <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3oUTI1b" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
    <!-- AMAZON_PENDING: Baseus 10000mAh モバイルバッテリー 22.5W -->
    <a class="cta-btn-amazon" href="#" data-amazon-query="Baseus 10000mAh モバイルバッテリー 22.5W" aria-disabled="true" style="opacity:0.45;pointer-events:none;cursor:not-allowed;">Amazonで見る（確認中）</a>`,
    `    <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3L37CmZ" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`
  );

  // --- Product 3 (20000mAh 65W → 100W): update id, link, price, specs ---
  html = html.replace(
    '<!-- @product-start id="1005006973916216" type="ガジェット" tag="ガジェット" -->',
    '<!-- @product-start id="1005002740514937" type="ガジェット" tag="ガジェット" -->'
  );
  html = html.replace(
    `    <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c4aIStOD" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
    <!-- AMAZON_PENDING: Baseus Power Bank 20000mAh 65W -->
    <a class="cta-btn-amazon" href="#" data-amazon-query="Baseus Power Bank 20000mAh 65W" aria-disabled="true" style="opacity:0.45;pointer-events:none;cursor:not-allowed;">Amazonで見る（確認中）</a>`,
    `    <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3WmMBbn" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`
  );
  html = html.replace(
    '<h2 id="amblight-30000">【アウトドア・長旅向け】Baseus Power Bank 20000mAh 65W</h2>',
    '<h2 id="amblight-30000">【アウトドア・長旅向け】Baseus Power Bank 20000mAh 100W</h2>'
  );
  html = html.replace(
    'Baseus Power Bank 20000mAh 65Wは、<strong>MacBook Airや薄型ノートPCへの給電を視野に入れた、大容量×高出力の現実的な一台</strong>です。',
    'Baseus Power Bank 20000mAh 100Wは、<strong>MacBook Airや薄型ノートPCへの給電を視野に入れた、大容量×高出力の現実的な一台</strong>です。BASEUS Official Store公式出品で、品質が保証されています。'
  );
  html = html.replace(
    '<li><strong>最大出力：</strong>65W（USB-C PD）</li>\n      <li><strong>入力：</strong>USB-C 65W（パススルー充電対応）</li>',
    '<li><strong>最大出力：</strong>100W（USB-C PD）</li>\n      <li><strong>入力：</strong>USB-C 65W（パススルー充電対応）</li>'
  );
  html = html.replace(
    '65W出力が何を意味するかというと、<strong>MacBook Air（M2/M3）を純正充電器と遜色ないスピードで充電できる</strong>ということです。MacBook Airの純正充電器は30W〜70Wなので、65Wあれば実用的な充電速度が出ます。',
    '100W出力が何を意味するかというと、<strong>MacBook Airはもちろん、MacBook Pro 14インチや多くのWindowsノートPCを純正充電器と遜色ないスピードで充電できる</strong>ということです。65Wを超える100Wはより幅広いノートPCに対応します。'
  );
  html = html.replace(
    'AliExpressでの実売価格は<strong>約4,000〜5,500円</strong>。Amazonでの同等品が6,000〜8,000円台であることを考えると、2,000円前後の差が出ます。',
    'AliExpressの「BASEUS Official Store」での実売価格は<strong>約¥9,178</strong>。公式ストア直販の安心感と100W出力を兼ね備えたモデルです。'
  );
  html = html.replace(
    '<p class="cta-lead">【Baseus Power Bank 20000mAh 65W】をどちらで買う？価格・配送を比較</p>',
    '<p class="cta-lead">【Baseus Power Bank 20000mAh 100W】をAliExpressで見る</p>'
  );
  html = html.replace(
    '<img src="https://ae-pic-a1.aliexpress-media.com/kf/Sfc608784a0d1459685333aa87a96579ao.jpg" alt="Baseus Power Bank 20000mAh 65W" loading="lazy">',
    '<img src="https://ae-pic-a1.aliexpress-media.com/kf/S2b783cbff13043a7b1727f965a3e400ba.jpg" alt="Baseus Power Bank 20000mAh 100W" loading="lazy">'
  );

  // --- Product 4 (145W 20800mAh → basic 10000mAh): full replacement ---
  const p4Start = '<!-- @product-start id="1005008652028760" type="ガジェット" tag="ガジェット" -->';
  const p4EndMarker = '<!-- @product-end -->\n\n<!-- ============================================================ -->\n<!-- @product-start id="1005005814179114"';
  const p4StartIdx = html.indexOf(p4Start);
  const p4EndIdx = html.indexOf(p4EndMarker, p4StartIdx);
  if (p4StartIdx !== -1 && p4EndIdx !== -1) {
    const basicSection = `<!-- @product-start id="1005001869146137" type="ガジェット" tag="ガジェット" -->
<h2 id="gan-100w">【予算重視・入門モデル】Baseus PD 22.5W 10000mAh モバイルバッテリー</h2>

<div class="product-images">
  <img src="https://ae-pic-a1.aliexpress-media.com/kf/S2b783cbff13043a7b1727f965a3e400ba.jpg" alt="Baseus PD 22.5W 10000mAh" loading="lazy">
</div>

<h3>コスパ最強の入門モデル——はじめてのBaseusに</h3>

<p>Baseus PD 22.5W 10000mAhは、<strong>¥3,156というBaseusラインナップ最安クラスの価格で、必要十分なスペックを揃えた入門モデル</strong>です。「Baseusを初めて試したい」「とにかく安く10000mAhクラスを手に入れたい」という人への答えはこれです。</p>

<p>スペックはこちら：</p>

<ul>
  <li><strong>容量：</strong>10000mAh</li>
  <li><strong>最大出力：</strong>22.5W（USB-C PD）</li>
  <li><strong>入力：</strong>USB-C</li>
  <li><strong>ポート構成：</strong>USB-C × 1、USB-A × 1</li>
  <li><strong>ストア：</strong>BASEUS Official Store</li>
</ul>

<p>22.5W出力でスマホを約75〜90分で0→100%充電できます。ノートPCへの給電は不向きですが、<strong>スマホ・ワイヤレスイヤホン・スマートウォッチ程度の用途なら十分すぎるスペック</strong>です。BASEUS Official Storeからの購入なので、品質と正規品保証が担保されています。</p>

<h3>こんな人が選ぶべきモデル</h3>

<ul>
  <li>とにかく予算を抑えてBaseusを試したい人</li>
  <li>スマホの充電用途のみ・PCには使わない人</li>
  <li>軽量・コンパクトを優先する人</li>
</ul>

<div class="cta-box">
  <p class="cta-lead">【Baseus PD 22.5W 10000mAh】をAliExpressで見る</p>
  <p class="cta-sub">BASEUS Official Store 公式出品｜送料無料・到着2〜4週間</p>
  <div class="cta-buttons">
    <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c3imIzSd" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
  </div>
  <p class="cta-note">※ AliExpressリンクはアフィリエイトリンクです</p>
</div>
<!-- @product-end -->

<!-- ============================================================ -->
<!-- @product-start id="1005005814179114"`;
    html = html.slice(0, p4StartIdx) + basicSection + html.slice(p4EndIdx + p4EndMarker.length);
  } else {
    console.error('Baseus P4 section not found!', p4StartIdx, p4EndIdx);
  }

  // --- Product 5 (145W 25000mAh): update link only ---
  html = html.replace(
    `    <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c40mqeHT" target="_blank" rel="noopener sponsored">AliExpressで見る</a>
    <!-- AMAZON_PENDING: Baseus 145W Power Bank 25000mAh -->
    <a class="cta-btn-amazon" href="#" data-amazon-query="Baseus 145W Power Bank 25000mAh" aria-disabled="true" style="opacity:0.45;pointer-events:none;cursor:not-allowed;">Amazonで見る（確認中）</a>`,
    `    <a class="cta-btn-aliex" href="https://s.click.aliexpress.com/e/_c2uTKFgv" target="_blank" rel="noopener sponsored">AliExpressで見る</a>`
  );

  // --- Update comparison table ---
  html = html.replace(
    `      <tr>
        <td>Magnetic Power Bank 5000mAh</td>
        <td>5,000</td>
        <td>20W（有線）/ 15W（ワイヤレス）</td>
        <td>約100</td>
        <td>USB-C×1</td>
        <td>約5,000円</td>
      </tr>
      <tr>
        <td>10000mAh 22.5W</td>
        <td>10,000</td>
        <td>22.5W</td>
        <td>約200</td>
        <td>USB-C×2、USB-A×1</td>
        <td>約6,500円</td>
      </tr>
      <tr>
        <td>Power Bank 20000mAh 65W</td>
        <td>20,000</td>
        <td>65W</td>
        <td>約380</td>
        <td>USB-C×2、USB-A×1</td>
        <td>約8,000円</td>
      </tr>
      <tr>
        <td>145W Power Bank 20800mAh</td>
        <td>20,800</td>
        <td>145W</td>
        <td>約490</td>
        <td>USB-C×2、USB-A×1</td>
        <td>約10,000円</td>
      </tr>
      <tr>
        <td>145W Power Bank 25000mAh</td>
        <td>25,000</td>
        <td>145W</td>
        <td>約590</td>
        <td>USB-C×2、USB-A×1</td>
        <td>約12,000円</td>
      </tr>`,
    `      <tr>
        <td>Qi2 磁気 5000mAh（BASEUS Official）</td>
        <td>5,000</td>
        <td>20W（有線）/ 15W（Qi2）</td>
        <td>約100</td>
        <td>USB-C×1</td>
        <td>¥8,741</td>
      </tr>
      <tr>
        <td>10000mAh 22.5W（BASEUS Official）</td>
        <td>10,000</td>
        <td>22.5W</td>
        <td>約200</td>
        <td>USB-C×2、USB-A×1</td>
        <td>¥6,474</td>
      </tr>
      <tr>
        <td>Power Bank 20000mAh 100W（BASEUS Official）</td>
        <td>20,000</td>
        <td>100W</td>
        <td>約380</td>
        <td>USB-C×2、USB-A×1</td>
        <td>¥9,178</td>
      </tr>
      <tr>
        <td>PD 22.5W 10000mAh 入門（BASEUS Official）</td>
        <td>10,000</td>
        <td>22.5W</td>
        <td>約150</td>
        <td>USB-C×1、USB-A×1</td>
        <td>¥3,156</td>
      </tr>
      <tr>
        <td>145W Power Bank 25000mAh（BASEUS Official）</td>
        <td>25,000</td>
        <td>145W</td>
        <td>約590</td>
        <td>USB-C×2、USB-A×1</td>
        <td>¥12,141</td>
      </tr>`
  );

  // --- Update conclusion summary ---
  html = html.replace(
    '<li><strong>毎日の通勤・軽い外出：</strong>Baseus 5000mAh Magnetic（100g以下・MagSafe対応）</li>',
    '<li><strong>毎日の通勤・軽い外出：</strong>Baseus Qi2磁気 5000mAh（100g以下・Qi2対応・BASEUS Official Store）</li>'
  );
  html = html.replace(
    '<li><strong>仕事・旅行の普段使い：</strong>Baseus 10000mAh 22.5W（コスパ最強・内蔵ケーブル付き）</li>',
    '<li><strong>仕事・旅行の普段使い：</strong>Baseus 10000mAh 22.5W（¥6,474・BASEUS Official Store）</li>'
  );
  html = html.replace(
    '<li><strong>ノートPC充電が必要：</strong>Baseus 65W 20000mAh（格納式ケーブルで取り回しも◎）</li>',
    '<li><strong>ノートPC充電が必要：</strong>Baseus 100W 20000mAh（¥9,178・BASEUS Official Store）</li>'
  );
  html = html.replace(
    '<li><strong>最高スペックで揃えたい：</strong>Baseus 145W 20800mAh（全デバイス対応・デジタル残量表示）</li>',
    '<li><strong>はじめてのBaseus・予算重視：</strong>Baseus PD 22.5W 10000mAh（¥3,156・BASEUS Official Store最安）</li>'
  );
  html = html.replace(
    '<li><strong>長期旅行・複数人シェア：</strong>Baseus 145W 25000mAh（大容量×高出力の最上位）</li>',
    '<li><strong>長期旅行・最大容量：</strong>Baseus 145W 25000mAh（¥12,141・BASEUS Official Store）</li>'
  );

  fs.writeFileSync(file, html, 'utf8');
  console.log('✅ baseus-mobile-battery-osusume.html updated');
}

// Run all updates
try { updateEarphone(); } catch(e) { console.error('Earphone error:', e.message); }
try { updateMouse(); } catch(e) { console.error('Mouse error:', e.message); }
try { updateCable(); } catch(e) { console.error('Cable error:', e.message); }
try { updateBaseus(); } catch(e) { console.error('Baseus error:', e.message); }

console.log('\nDone!');
