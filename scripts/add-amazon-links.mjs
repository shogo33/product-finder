/**
 * amazon-rec-list に3商品を追加するスクリプト
 */
import fs from 'fs';
import path from 'path';

const BASE = path.resolve('public/basics');

const files = [
  'aliexpress-osusume.html',
  'aliexpress-projector-under-10000.html',
  'aliexpress-sticker-osusume.html',
  'baseus-mobile-battery-osusume.html',
  'naturehike-airmat-osusume.html',
  'naturehike-brand.html',
  'naturehike-osusume.html',
  'naturehike-tent-osusume.html',
  'ugreen-cable-osusume.html',
  'ugreen-earphone-osusume.html',
  'ugreen-mouse-osusume.html',
];

const newItems8 = `          <a href="https://amzn.to/3PxKEpm" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">水</span>
            <span class="amazon-rec-name">い・ろ・は・す ラベルレス 560ml×24本</span>
            <span class="amazon-rec-cta">Amazonで見る →</span>
          </a>
          <a href="https://amzn.to/42IyEV3" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">緑茶</span>
            <span class="amazon-rec-name">コカ・コーラ 綾鷹 ラベルレス 525mlPET×24本</span>
            <span class="amazon-rec-cta">Amazonで見る →</span>
          </a>
          <a href="https://amzn.to/4eYNPkj" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">炭酸水</span>
            <span class="amazon-rec-name">by Amazon 強炭酸水 レモン ラベルレス 500ml×24本</span>
            <span class="amazon-rec-cta">Amazonで見る →</span>
          </a>
          <a href="https://amzn.to/4uW9A8Y" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">スポーツ</span>
            <span class="amazon-rec-name">コカ・コーラ アクエリアス ラベルレス 500mlPET×24本</span>
            <span class="amazon-rec-cta">Amazonで見る →</span>
          </a>
          <a href="https://amzn.to/4wIckbQ" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">麦茶</span>
            <span class="amazon-rec-name">伊藤園 ラベルレス 健康ミネラルむぎ茶 600ml×24本</span>
            <span class="amazon-rec-cta">Amazonで見る →</span>
          </a>
          <a href="https://amzn.to/4wIclfU" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">ほうじ茶</span>
            <span class="amazon-rec-name">アサヒ飲料 ほうじ茶 ラベルレスボトル 500ml×24本</span>
            <span class="amazon-rec-cta">Amazonで見る →</span>
          </a>
          <a href="https://amzn.to/3RouAXt" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">天然水</span>
            <span class="amazon-rec-name">by Amazon 天然水 ラベルレス 500ml×24本 富士山の天然水</span>
            <span class="amazon-rec-cta">Amazonで見る →</span>
          </a>
          <a href="https://amzn.to/4dVJaOX" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">緑茶</span>
            <span class="amazon-rec-name">コカ・コーラ 綾鷹 ラベルレス 525mlPET×24本</span>
            <span class="amazon-rec-cta">Amazonで見る →</span>
          </a>
          <a href="https://amzn.to/3Ptygqr" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">緑茶</span>
            <span class="amazon-rec-name">コカ・コーラ 綾鷹 茶葉のあまみ ラベルレス 525mlPET×24本</span>
            <span class="amazon-rec-cta">Amazonで見る →</span>
          </a>
          <a href="https://amzn.to/4uod9Vw" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">緑茶</span>
            <span class="amazon-rec-name">伊藤園 ラベルレス おーいお茶 緑茶 460ml×30本</span>
            <span class="amazon-rec-cta">Amazonで見る →</span>
          </a>
          <a href="https://amzn.to/4uqZ4a1" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">麦茶</span>
            <span class="amazon-rec-name">コカ・コーラ やかんの麦茶 from 爽健美茶 ラベルレス 650mlPET×24本</span>
            <span class="amazon-rec-cta">Amazonで見る →</span>
          </a>
`;

const newItems4 = `      <a href="https://amzn.to/3PxKEpm" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
        <span class="amazon-rec-label">水</span>
        <span class="amazon-rec-name">い・ろ・は・す ラベルレス 560ml×24本</span>
        <span class="amazon-rec-cta">Amazonで見る →</span>
      </a>
      <a href="https://amzn.to/42IyEV3" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
        <span class="amazon-rec-label">緑茶</span>
        <span class="amazon-rec-name">コカ・コーラ 綾鷹 ラベルレス 525mlPET×24本</span>
        <span class="amazon-rec-cta">Amazonで見る →</span>
      </a>
      <a href="https://amzn.to/4eYNPkj" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
        <span class="amazon-rec-label">炭酸水</span>
        <span class="amazon-rec-name">by Amazon 強炭酸水 レモン ラベルレス 500ml×24本</span>
        <span class="amazon-rec-cta">Amazonで見る →</span>
      </a>
      <a href="https://amzn.to/4uW9A8Y" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
        <span class="amazon-rec-label">スポーツ</span>
        <span class="amazon-rec-name">コカ・コーラ アクエリアス ラベルレス 500mlPET×24本</span>
        <span class="amazon-rec-cta">Amazonで見る →</span>
      </a>
      <a href="https://amzn.to/4wIckbQ" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
        <span class="amazon-rec-label">麦茶</span>
        <span class="amazon-rec-name">伊藤園 ラベルレス 健康ミネラルむぎ茶 600ml×24本</span>
        <span class="amazon-rec-cta">Amazonで見る →</span>
      </a>
      <a href="https://amzn.to/4wIclfU" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
        <span class="amazon-rec-label">ほうじ茶</span>
        <span class="amazon-rec-name">アサヒ飲料 ほうじ茶 ラベルレスボトル 500ml×24本</span>
        <span class="amazon-rec-cta">Amazonで見る →</span>
      </a>
      <a href="https://amzn.to/3RouAXt" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
        <span class="amazon-rec-label">天然水</span>
        <span class="amazon-rec-name">by Amazon 天然水 ラベルレス 500ml×24本 富士山の天然水</span>
        <span class="amazon-rec-cta">Amazonで見る →</span>
      </a>
      <a href="https://amzn.to/4dVJaOX" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
        <span class="amazon-rec-label">緑茶</span>
        <span class="amazon-rec-name">コカ・コーラ 綾鷹 ラベルレス 525mlPET×24本</span>
        <span class="amazon-rec-cta">Amazonで見る →</span>
      </a>
      <a href="https://amzn.to/3Ptygqr" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
        <span class="amazon-rec-label">緑茶</span>
        <span class="amazon-rec-name">コカ・コーラ 綾鷹 茶葉のあまみ ラベルレス 525mlPET×24本</span>
        <span class="amazon-rec-cta">Amazonで見る →</span>
      </a>
      <a href="https://amzn.to/4uod9Vw" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
        <span class="amazon-rec-label">緑茶</span>
        <span class="amazon-rec-name">伊藤園 ラベルレス おーいお茶 緑茶 460ml×30本</span>
        <span class="amazon-rec-cta">Amazonで見る →</span>
      </a>
      <a href="https://amzn.to/4uqZ4a1" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
        <span class="amazon-rec-label">麦茶</span>
        <span class="amazon-rec-name">コカ・コーラ やかんの麦茶 from 爽健美茶 ラベルレス 650mlPET×24本</span>
        <span class="amazon-rec-cta">Amazonで見る →</span>
      </a>
`;

for (const name of files) {
  const file = path.join(BASE, name);
  let html = fs.readFileSync(file, 'utf8');

  // すでに追加済みならスキップ（最後に追加するリンクで確認）
  if (html.includes('amzn.to/4uqZ4a1')) {
    console.log(`⏭  ${name} (already added)`);
    continue;
  }

  const listStart = html.indexOf('<div class="amazon-rec-list">');
  if (listStart === -1) {
    console.error(`❌ amazon-rec-list not found: ${name}`);
    continue;
  }

  // amazon-rec-list の閉じタグを探す（8スペース or 4スペース）
  let closingDiv = '        </div>';
  let insertAt = html.indexOf(closingDiv, listStart);
  if (insertAt === -1) {
    closingDiv = '    </div>';
    insertAt = html.indexOf(closingDiv, listStart);
  }
  if (insertAt === -1) {
    console.error(`❌ closing </div> not found: ${name}`);
    continue;
  }

  const newItems = (closingDiv === '    </div>') ? newItems4 : newItems8;
  html = html.slice(0, insertAt) + newItems + html.slice(insertAt);
  fs.writeFileSync(file, html, 'utf8');
  console.log(`✅ ${name}`);
}

console.log('\nDone!');
