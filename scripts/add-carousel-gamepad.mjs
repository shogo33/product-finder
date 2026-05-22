/**
 * add-carousel-gamepad.mjs
 * gamesir-controller-osusume.html と aliexpress-gamepad-osusume.html の
 * .product-img 単枚 → product-carousel カルーセルに差し替える
 */
import fs from 'fs';

const CAROUSEL_CSS = `    .product-carousel { position: relative; margin: 16px 0 28px; border-radius: 12px; overflow: hidden; background: #f5f5f5; user-select: none; }
    .carousel-track { display: flex; will-change: transform; transition: transform 0.3s cubic-bezier(0.25,0.1,0.25,1); }
    .carousel-track img { min-width: 100%; height: 280px; object-fit: contain; border-radius: 12px; display: block; }
    @media (max-width: 480px) { .carousel-track img { height: 220px; } }
    .carousel-btn { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.9); border: none; border-radius: 50%; width: 38px; height: 38px; font-size: 1.3rem; line-height: 1; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.18); transition: opacity 0.2s; }
    .carousel-btn:hover { opacity: 0.85; }
    .carousel-btn.prev { left: 8px; }
    .carousel-btn.next { right: 8px; }
    .carousel-dots { display: flex; justify-content: center; gap: 6px; padding: 8px 0 4px; background: #f5f5f5; }
    .carousel-dot { width: 7px; height: 7px; border-radius: 50%; background: #ddd; border: none; cursor: pointer; padding: 0; transition: background 0.2s; }
    .carousel-dot.active { background: var(--red); }`;

const CAROUSEL_JS = `  <script>
  document.querySelectorAll('[data-carousel]').forEach(function(carousel) {
    var track = carousel.querySelector('.carousel-track');
    var imgs = track.querySelectorAll('img');
    var dotsEl = carousel.querySelector('.carousel-dots');
    var cur = 0;
    imgs.forEach(function(_, i) {
      var d = document.createElement('button');
      d.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      dotsEl.appendChild(d);
      d.addEventListener('click', function() { goTo(i); });
    });
    function goTo(n) {
      cur = ((n % imgs.length) + imgs.length) % imgs.length;
      track.style.transform = 'translateX(-' + (cur * 100) + '%)';
      carousel.querySelectorAll('.carousel-dot').forEach(function(d, i) { d.classList.toggle('active', i === cur); });
    }
    if (imgs.length > 1) {
      carousel.querySelector('.prev').addEventListener('click', function() { goTo(cur - 1); });
      carousel.querySelector('.next').addEventListener('click', function() { goTo(cur + 1); });
    } else {
      carousel.querySelector('.prev').style.display = 'none';
      carousel.querySelector('.next').style.display = 'none';
    }
  });
  </script>`;

function makeCarousel(imgs) {
  const imgTags = imgs.map(([src, alt]) =>
    `        <img src="${src}" alt="${alt}" loading="lazy">`
  ).join('\n');
  return `<div class="product-carousel" data-carousel>
      <div class="carousel-track">
${imgTags}
      </div>
      <button class="carousel-btn prev" aria-label="前の画像">&#8249;</button>
      <button class="carousel-btn next" aria-label="次の画像">&#8250;</button>
      <div class="carousel-dots"></div>
    </div>`;
}

// ── gamesir-controller-osusume.html ──────────────────────────────────────
const GAMESIR_IMAGES = {
  'GameSir Cyclone Pro': [
    ['/images/products/gamesir-controller-osusume/a07e5270.png', 'GameSir Cyclone Pro 全体'],
    ['https://gamesir.com/cdn/shop/files/20260427-114255.393-1.png?v=1777261487&width=1206', 'GameSir Cyclone Pro 正面'],
    ['https://gamesir.com/cdn/shop/files/8ac2df18cfdcfb4fa59eff82bae793b3_ad6b5116-263f-4f43-9ab1-66e338975348.png?v=1737552923', 'GameSir Cyclone Pro 背面'],
  ],
  'GameSir T4 Mini': [
    ['/images/products/gamesir-controller-osusume/0c8380c9.jpg', 'GameSir T4 Mini'],
    ['https://gamesir.com/cdn/shop/articles/T4_Mini_a7bb41c6-fee1-40bd-a775-89e87af3ed61.png?v=1652343671&width=1500', 'GameSir T4 Mini 使用例'],
    ['https://ae-pic-a1.aliexpress-media.com/kf/Sfa97f1d746524b73a551720955b7b703l.jpg_480x480q75.jpg', 'GameSir T4 Pro'],
  ],
  'GameSir G7 SE': [
    ['/images/products/gamesir-controller-osusume/9c323886.jpg', 'GameSir G7 SE'],
    ['https://gamesir.com/cdn/shop/files/G7SE-_2_f6d9d65d-3d47-48df-9a71-896a6de75c67.png?v=1737628303', 'GameSir G7 SE Hall Effect'],
    ['https://gamesir.com/cdn/shop/files/G7SE-_3_6d1f57d0-6a15-4262-9750-e8cbfd0c7233.png?v=1737628304', 'GameSir G7 SE 背面ボタン'],
  ],
  'GameSir X2s': [
    ['/images/products/gamesir-controller-osusume/02a4dcde.jpg', 'GameSir X2s'],
    ['https://gamesir.com/cdn/shop/files/X2S_-1.png?v=1737600372', 'GameSir X2s スマホ装着'],
    ['https://gamesir.com/cdn/shop/files/2_d35bfb6e-27d8-40d8-bbb9-c99c4ab98cc9.png?v=1737600181', 'GameSir X2s 詳細'],
  ],
  'GameSir Nova Lite': [
    ['/images/products/gamesir-controller-osusume/118d1d81.png', 'GameSir Nova Lite'],
    ['https://gamesir.com/cdn/shop/files/01_4e30e505-2842-45f6-93b2-1641201b811f.jpg?v=1737614092', 'GameSir Nova Lite 正面'],
    ['https://gamesir.com/cdn/shop/files/02_90955e9e-e8c7-465f-b703-0532a2502b23.jpg?v=1737614092', 'GameSir Nova Lite 使用例'],
  ],
};

function processGamesir() {
  const path = 'public/basics/gamesir-controller-osusume.html';
  let html = fs.readFileSync(path, 'utf8');

  // 1. CSS: .product-img → carousel CSS
  html = html.replace(
    /    \.product-img \{ text-align: center;.*?\}\n    \.product-img img \{.*?\}/s,
    CAROUSEL_CSS
  );

  // 2. 各 product-img → carousel
  for (const [productName, imgs] of Object.entries(GAMESIR_IMAGES)) {
    const carousel = makeCarousel(imgs);
    // <div class="product-img"><img src="..." alt="PRODUCT_NAME" loading="lazy"></div>
    const re = new RegExp(
      `<div class="product-img"><img src="[^"]*" alt="${productName}" loading="lazy"><\\/div>`,
      'g'
    );
    html = html.replace(re, carousel);
  }

  // 3. カルーセルJS を </body> 直前に追加
  if (!html.includes('data-carousel]')) {
    html = html.replace('</body>', CAROUSEL_JS + '\n</body>');
  } else if (!html.includes('document.querySelectorAll(\'[data-carousel]\'')) {
    html = html.replace('</body>', CAROUSEL_JS + '\n</body>');
  }

  fs.writeFileSync(path, html, 'utf8');
  console.log('✅ gamesir-controller-osusume.html updated');
}

// ── aliexpress-gamepad-osusume.html ──────────────────────────────────────
// 現在のローカルパスを取得
function getAliexpressImages() {
  const path = 'public/basics/aliexpress-gamepad-osusume.html';
  const html = fs.readFileSync(path, 'utf8');
  const map = {};
  const re = /<div class="product-img"><img src="([^"]*)" alt="([^"]*)" loading="lazy"><\/div>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    map[m[2]] = m[1]; // alt → src
  }
  return map;
}

function processAliexpress() {
  const path = 'public/basics/aliexpress-gamepad-osusume.html';
  let html = fs.readFileSync(path, 'utf8');
  const localMap = getAliexpressImages();

  const ALIEXPRESS_IMAGES = {
    'GameSir Cyclone Pro': [
      [localMap['GameSir Cyclone Pro'] || '/images/products/aliexpress-gamepad-osusume/a07e5270.png', 'GameSir Cyclone Pro'],
      ['https://gamesir.com/cdn/shop/files/20260427-114255.393-1.png?v=1777261487&width=1206', 'GameSir Cyclone Pro 正面'],
      ['https://gamesir.com/cdn/shop/files/8ac2df18cfdcfb4fa59eff82bae793b3_ad6b5116-263f-4f43-9ab1-66e338975348.png?v=1737552923', 'GameSir Cyclone Pro 背面'],
    ],
    'GameSir T4 Mini': [
      [localMap['GameSir T4 Mini'] || '', 'GameSir T4 Mini'],
      ['https://gamesir.com/cdn/shop/articles/T4_Mini_a7bb41c6-fee1-40bd-a775-89e87af3ed61.png?v=1652343671&width=1500', 'GameSir T4 Mini 使用例'],
      ['https://ae-pic-a1.aliexpress-media.com/kf/Sfa97f1d746524b73a551720955b7b703l.jpg_480x480q75.jpg', 'GameSir T4 Pro'],
    ],
    'GameSir G7 SE': [
      [localMap['GameSir G7 SE'] || '', 'GameSir G7 SE'],
      ['https://gamesir.com/cdn/shop/files/G7SE-_2_f6d9d65d-3d47-48df-9a71-896a6de75c67.png?v=1737628303', 'GameSir G7 SE Hall Effect'],
      ['https://gamesir.com/cdn/shop/files/G7SE-_3_6d1f57d0-6a15-4262-9750-e8cbfd0c7233.png?v=1737628304', 'GameSir G7 SE 背面ボタン'],
    ],
    'GameSir X2s': [
      [localMap['GameSir X2s'] || '', 'GameSir X2s'],
      ['https://gamesir.com/cdn/shop/files/X2S_-1.png?v=1737600372', 'GameSir X2s スマホ装着'],
      ['https://gamesir.com/cdn/shop/files/2_d35bfb6e-27d8-40d8-bbb9-c99c4ab98cc9.png?v=1737600181', 'GameSir X2s 詳細'],
    ],
    '8BitDo SN30 Pro': [
      [localMap['8BitDo SN30 Pro'] || '', '8BitDo SN30 Pro'],
      ['https://shop.8bitdo.com/cdn/shop/files/3_4891da41-b5b9-4155-b9e7-1d750ed65b0e.jpg?v=1709279638&width=1946', '8BitDo SN30 Pro 正面'],
      ['https://shop.8bitdo.com/cdn/shop/files/4_742a9dc7-8620-4f1c-b601-57e8aab68f16.jpg?v=1709279638&width=1946', '8BitDo SN30 Pro 背面'],
    ],
    '8BitDo Ultimate Controller': [
      [localMap['8BitDo Ultimate Controller'] || '', '8BitDo Ultimate Controller'],
      ['https://shop.8bitdo.com/cdn/shop/files/1_a38f84a9-e0a4-4342-a217-2c3215f449c0.jpg?v=1733811361&width=1946', '8BitDo Ultimate 2C 正面'],
      ['https://shop.8bitdo.com/cdn/shop/files/3_73e49c08-13d5-4ea8-bfda-866882317745.jpg?v=1733811361&width=1946', '8BitDo Ultimate 2C 使用例'],
    ],
    'Flydigi Vader 3 Pro': [
      [localMap['Flydigi Vader 3 Pro'] || '', 'Flydigi Vader 3 Pro'],
      ['https://shops.flydigi.com/cdn/shop/files/0-1.jpg?v=1778574548&width=3600', 'Flydigi Vader Pro 正面'],
      ['https://shops.flydigi.com/cdn/shop/files/f1a4fd523768656f345b0875f5274a6e.jpg?v=1778234690&width=3600', 'Flydigi Vader Pro 詳細'],
    ],
  };

  // 1. CSS: .product-img → carousel CSS
  html = html.replace(
    /    \.product-img \{ text-align: center;.*?\}\n    \.product-img img \{.*?\}/s,
    CAROUSEL_CSS
  );

  // 2. 各 product-img → carousel
  for (const [productName, imgs] of Object.entries(ALIEXPRESS_IMAGES)) {
    // 先頭が空のsrcなら除外
    const filteredImgs = imgs.filter(([src]) => src !== '');
    if (filteredImgs.length === 0) continue;
    const carousel = makeCarousel(filteredImgs);
    const re = new RegExp(
      `<div class="product-img"><img src="[^"]*" alt="${productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" loading="lazy"><\\/div>`,
      'g'
    );
    html = html.replace(re, carousel);
  }

  // 3. カルーセルJS を </body> 直前に追加
  if (!html.includes('document.querySelectorAll(\'[data-carousel]\'')) {
    html = html.replace('</body>', CAROUSEL_JS + '\n</body>');
  }

  fs.writeFileSync(path, html, 'utf8');
  console.log('✅ aliexpress-gamepad-osusume.html updated');
}

processGamesir();
processAliexpress();
console.log('Done. Run: node scripts/download-article-images.mjs');
