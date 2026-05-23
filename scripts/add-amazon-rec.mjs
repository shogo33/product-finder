import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const basicsDir = path.join(__dirname, '..', 'public', 'basics');

const AMAZON_REC_CSS = `
    .amazon-rec { margin: 40px 0 24px; padding: 20px; background: #fff8f0; border: 1px solid #fcd34d; border-radius: 12px; }
    .amazon-rec-title { font-size: 0.9rem; font-weight: 700; color: #92400e; margin-bottom: 14px; }
    .amazon-rec-list { display: flex; flex-direction: column; gap: 10px; }
    .amazon-rec-item { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: #fff; border: 1px solid #fde68a; border-radius: 8px; text-decoration: none; color: #1a1a1a; transition: border-color 0.2s; }
    .amazon-rec-item:hover { border-color: #f59e0b; }
    .amazon-rec-label { font-size: 0.7rem; font-weight: 700; color: #fff; background: #f59e0b; padding: 2px 7px; border-radius: 10px; white-space: nowrap; flex-shrink: 0; }
    .amazon-rec-name { font-size: 0.85rem; font-weight: 600; flex: 1; }
    .amazon-rec-cta { font-size: 0.78rem; color: #f59e0b; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
    .amazon-rec-list:not(.expanded) .amazon-rec-item:nth-child(n+4) { display: none; }
    .amazon-rec-toggle { display: block; text-align: center; margin-top: 12px; color: #f59e0b; font-size: 0.82rem; font-weight: 700; cursor: pointer; background: none; border: 1px solid #fde68a; border-radius: 8px; padding: 8px; width: 100%; }
    .amazon-rec-toggle:hover { background: #fff8f0; }`;

const AMAZON_REC_HTML = `
      <!-- Amazonおすすめ -->
      <div class="amazon-rec">
        <div class="amazon-rec-title">🛒 Amazonでよく買われているもの</div>
        <div class="amazon-rec-list">
          <a href="https://amzn.to/4uqaDhN" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">炭酸水</span>
            <span class="amazon-rec-name">ウィルキンソン タンサン ダブルグレープ 500ml×24本</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
          <a href="https://amzn.to/4upEaYE" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">プロテイン</span>
            <span class="amazon-rec-name">アンビーク ソイプロテイン 1kg バナナ味</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
          <a href="https://amzn.to/3RE0Y8B" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">炭酸水</span>
            <span class="amazon-rec-name">by Amazon 強炭酸水 ラベルレス 500ml×24本 (Smart Basic)</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
          <a href="https://amzn.to/4fxTFZV" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">コーラ</span>
            <span class="amazon-rec-name">コカ・コーラ ラベルレス 500mlPET×24</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
          <a href="https://amzn.to/4fyTtd0" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">麦茶</span>
            <span class="amazon-rec-name">やかんの麦茶 from 爽健美茶 ラベルレス 650mlPET×24本</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
          <a href="https://amzn.to/3PxKEpm" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">水</span>
            <span class="amazon-rec-name">い・ろ・は・す ラベルレス 560ml×24本</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
          <a href="https://amzn.to/42IyEV3" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">緑茶</span>
            <span class="amazon-rec-name">コカ・コーラ 綾鷹 ラベルレス 525mlPET×24本</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
          <a href="https://amzn.to/4eYNPkj" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">炭酸水</span>
            <span class="amazon-rec-name">by Amazon 強炭酸水 レモン ラベルレス 500ml×24本</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
          <a href="https://amzn.to/4uW9A8Y" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">スポーツ</span>
            <span class="amazon-rec-name">コカ・コーラ アクエリアス ラベルレス 500mlPET×24本</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
          <a href="https://amzn.to/4wIckbQ" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">麦茶</span>
            <span class="amazon-rec-name">伊藤園 ラベルレス 健康ミネラルむぎ茶 600ml×24本</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
          <a href="https://amzn.to/4wIclfU" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">ほうじ茶</span>
            <span class="amazon-rec-name">アサヒ飲料 ほうじ茶 ラベルレスボトル 500ml×24本</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
          <a href="https://amzn.to/3RouAXt" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">天然水</span>
            <span class="amazon-rec-name">by Amazon 天然水 ラベルレス 500ml×24本 富士山の天然水</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
          <a href="https://amzn.to/4dVJaOX" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">緑茶</span>
            <span class="amazon-rec-name">コカ・コーラ 綾鷹 ラベルレス 525mlPET×24本</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
          <a href="https://amzn.to/3Ptygqr" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">緑茶</span>
            <span class="amazon-rec-name">コカ・コーラ 綾鷹 茶葉のあまみ ラベルレス 525mlPET×24本</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
          <a href="https://amzn.to/4uod9Vw" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">緑茶</span>
            <span class="amazon-rec-name">伊藤園 ラベルレス おーいお茶 緑茶 460ml×30本</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
          <a href="https://amzn.to/4uqZ4a1" class="amazon-rec-item" target="_blank" rel="noopener sponsored">
            <span class="amazon-rec-label">麦茶</span>
            <span class="amazon-rec-name">コカ・コーラ やかんの麦茶 from 爽健美茶 ラベルレス 650mlPET×24本</span>
            <span class="amazon-rec-cta">Amazonで見る</span>
          </a>
        </div>
        <button class="amazon-rec-toggle" onclick="this.previousElementSibling.classList.toggle('expanded');this.textContent=this.previousElementSibling.classList.contains('expanded')?'閉じる':'もっと見る'">もっと見る</button>
      </div>`;

const files = fs.readdirSync(basicsDir).filter(f => f.endsWith('.html'));
let updated = 0;
let skipped = 0;

for (const file of files) {
  const filePath = path.join(basicsDir, file);
  let html = fs.readFileSync(filePath, 'utf8');

  if (html.includes('amazon-rec')) {
    skipped++;
    continue;
  }

  // Add CSS before </style>
  if (!html.includes('amazon-rec-title')) {
    html = html.replace('</style>', `${AMAZON_REC_CSS}\n  </style>`);
  }

  // Insert HTML before related section (try several anchor patterns)
  const anchors = [
    '<!-- 関連記事 -->',
    '<div class="related">',
    '</div>\n\n    </div>\n\n  </main>',
  ];

  let inserted = false;
  for (const anchor of anchors) {
    if (html.includes(anchor)) {
      html = html.replace(anchor, `${AMAZON_REC_HTML}\n\n      ${anchor}`);
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    console.warn(`⚠️  ${file}: 挿入位置が見つかりませんでした`);
    continue;
  }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`✅ ${file}`);
  updated++;
}

console.log(`\n完了: ${updated}件追加 / ${skipped}件スキップ（既存）`);
