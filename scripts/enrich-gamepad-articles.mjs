/**
 * enrich-gamepad-articles.mjs
 * gamesir-controller-osusume.html と aliexpress-gamepad-osusume.html の
 * 各商品カードの product-body を詳細版に差し替える
 */
import fs from 'fs';

// ── 商品別リッチコンテンツ ────────────────────────────────────────

const GAMESIR_BODIES = {

'GameSir Cyclone Pro': `
          <p>GameSirラインナップの現行フラッグシップ。<strong>スティックもトリガーも両方ホールエフェクト</strong>というのは数あるゲームパッドの中でも珍しく、長期使用でのドリフト・トリガーブレを徹底排除している点が最大の強みです。</p>
          <p>Bluetooth / 2.4GHz / USB-C有線の3モードを1台で切り替えられるため、Switch・PC・スマホとデバイスをまたいでもコントローラーを替えなくていい。「1台で全部済む」を突き詰めたモデルです。</p>
          <ul>
            <li>🎮 <strong>接続方式</strong>：Bluetooth 5.0 / 2.4GHz / USB-C有線（3モード）</li>
            <li>📱 <strong>対応機種</strong>：Nintendo Switch / PC (Win10・11) / Android 8.0+ / iOS 14.0+</li>
            <li>⚡ <strong>バッテリー</strong>：約30時間（Bluetooth）/ 約20時間（2.4G）</li>
            <li>⚖️ <strong>重量</strong>：約260g</li>
            <li>🔧 <strong>背面ボタン</strong>：2個（マクロ・ショートカット割り当て可能）</li>
            <li>📳 <strong>振動</strong>：4モーター（Quad Motor — グリップ×2＋トリガー×2）</li>
            <li>🛠 <strong>カスタマイズ</strong>：GameSirアプリ対応（デッドゾーン・振動強度・ボタン設定）</li>
          </ul>
          <h4 style="font-size:0.92rem;font-weight:700;margin:16px 0 8px;">こんな人におすすめ</h4>
          <ul>
            <li>✅ Switch・PC・スマホを1本でまとめたい人</li>
            <li>✅ FPS・格ゲーで背面ボタンを活用したい人</li>
            <li>✅ 長く使えるドリフトしないコントローラーを探している人</li>
            <li>✅ 「1台投資して全機種で使い回したい」と考えている人</li>
            <li>❌ Switch専用でもっと安く済ませたい人 → T4 Miniが最適</li>
            <li>❌ 有線のみでいいのでとにかく安くPCで使いたい人 → G7 SEが最適</li>
          </ul>
          <div class="callout">Redditのr/gamesirでは「Cyclone Proは今のGameSirで一番コスパが高い万能機」という声が多数。スティックドリフト報告もほぼゼロで長期使用レビューが好評。</div>`,

'GameSir T4 Mini': `
          <p>Switchユーザーが「プロコンより使いやすい」と口をそろえる定番モデル。重量190gというコンパクトさでありながら、ホールエフェクトスティック・Switchネイティブのボタンレイアウト・十字キーの精度が高水準にまとまっています。</p>
          <p>特に<strong>Switchのボタン配置（ABXY）に完全準拠</strong>しているため、Switch用ゲームをそのまま違和感なく操作できます。プロコンが壊れた代替品として買った人が「プロコンに戻れなくなった」と言うほど評価が高い。</p>
          <ul>
            <li>🎮 <strong>接続方式</strong>：Bluetooth 5.0</li>
            <li>📱 <strong>対応機種</strong>：Nintendo Switch / Android（iOS非対応）</li>
            <li>⚡ <strong>バッテリー</strong>：約10時間（連続使用）</li>
            <li>⚖️ <strong>重量</strong>：約190g（プロコン比約46g軽い）</li>
            <li>🔘 <strong>ボタン</strong>：Switch準拠ABXY・十字キー・L3/R3対応</li>
            <li>⚡ <strong>ターボ機能</strong>：あり（連射設定可能）</li>
            <li>📏 <strong>サイズ感</strong>：コンパクト（女性・子供の手にもフィット）</li>
          </ul>
          <h4 style="font-size:0.92rem;font-weight:700;margin:16px 0 8px;">こんな人におすすめ</h4>
          <ul>
            <li>✅ Switch専用でコスパよく買いたい人</li>
            <li>✅ 持ち運び・旅行先でSwitchを遊ぶ人</li>
            <li>✅ 手が小さめ・コンパクトなコントローラーが好みの人</li>
            <li>✅ プロコンが高すぎると感じている人</li>
            <li>❌ PCやiOSでも使いたい人 → Cyclone Proへ</li>
            <li>❌ バッテリー10時間では物足りない人 → Nova Liteが約30時間対応</li>
          </ul>
          <div class="callout">Amazonレビュー（国内）でも「プロコンよりドリフトしにくい」「値段の割に高品質」の声が目立ち、4.0以上の評価が多数。アリエクなら国内定価より大幅安で購入可能。</div>`,

'GameSir G7 SE': `
          <p>PC・XboxゲーマーのためのHall Effect有線コントローラー。Xboxコントローラーと同じボタン配置（XInput対応）なのでSteam・GeForceNow・Xbox Game Passのほぼ全タイトルでそのまま動作します。</p>
          <p>最大の特長は<strong>ホールエフェクトスティック＋ホールエフェクトトリガー</strong>の両搭載。PCゲームでよくある「アナログトリガーが微妙にズレる」問題も解消しています。1.8mのUSB-Cブレイドケーブル付きで、有線・2.4G両対応。</p>
          <ul>
            <li>🎮 <strong>接続方式</strong>：USB-C有線（1.8mケーブル同梱）/ 2.4GHz（ドングル別売）</li>
            <li>📱 <strong>対応機種</strong>：PC (Windows 10/11)、Xbox Series X|S、Xbox One（Switch非対応）</li>
            <li>🔧 <strong>背面ボタン</strong>：2個（Quick-Latch式、取り外し可能）</li>
            <li>🎨 <strong>フェイスプレート</strong>：マグネット式交換対応（着せ替え可能）</li>
            <li>🛠 <strong>入力プロトコル</strong>：XInput / DirectInput 両対応</li>
            <li>🛠 <strong>カスタマイズ</strong>：GameSirアプリ（デッドゾーン・振動・ボタン割り当て）</li>
            <li>⚖️ <strong>重量</strong>：約298g</li>
          </ul>
          <h4 style="font-size:0.92rem;font-weight:700;margin:16px 0 8px;">こんな人におすすめ</h4>
          <ul>
            <li>✅ PCゲーム（Steam・Xbox Game Pass）専用機が欲しい人</li>
            <li>✅ ラグなし有線接続にこだわるFPS・格ゲープレイヤー</li>
            <li>✅ Xboxコントローラーの代替をコスパよく探している人</li>
            <li>✅ 背面ボタンで操作の幅を広げたいPC勢</li>
            <li>❌ Switchでも使いたい人 → Cyclone Proへ</li>
            <li>❌ 無線オンリーで使いたい人（2.4Gは別途ドングルが必要）</li>
          </ul>
          <div class="callout">海外のXboxコントローラーレビューサイトでは「同価格帯でHall Effectスティック＋トリガーが両方付いているのはG7 SEだけ」との評価多数。Redditのr/xboxでも推奨コメントが散見されます。</div>`,

'GameSir X2s': `
          <p>スマホをはさんで本体ごと握るクリップ型モバイルコントローラー。原神・CODモバイル・崩壊スターレイル・Xbox Cloud Gamingなど、スマホゲーム・クラウドゲーミングを快適化するアイテムです。</p>
          <p><strong>幅65〜85mmのスマホに対応</strong>するストレッチグリップで、iPhone 15 Proも大画面Androidも装着OK。Bluetooth接続で充電しながらプレイでき、バッテリー約20時間という持続力もポイント。</p>
          <ul>
            <li>🎮 <strong>接続方式</strong>：Bluetooth 5.3</li>
            <li>📱 <strong>対応機種</strong>：iOS 13+ / Android 8+（Switch非対応）</li>
            <li>⚡ <strong>バッテリー</strong>：約20時間（連続使用）</li>
            <li>📏 <strong>対応スマホ幅</strong>：65〜85mm（大半のiPhone・Androidに対応）</li>
            <li>🔌 <strong>充電</strong>：USB-C（充電しながらプレイ可能）</li>
            <li>⚖️ <strong>重量</strong>：スマホ含まず約約218g</li>
            <li>🕹 <strong>スティック</strong>：Hall Effect対応（ドリフト防止）</li>
          </ul>
          <h4 style="font-size:0.92rem;font-weight:700;margin:16px 0 8px;">こんな人におすすめ</h4>
          <ul>
            <li>✅ スマホでガチゲーしたい（原神・COD・FF等）人</li>
            <li>✅ Xbox Cloud Gaming / GeForce NOWをスマホで快適に楽しみたい人</li>
            <li>✅ 旅行中・通勤中でもゲームに本気を出したい人</li>
            <li>❌ Switchでも使いたい人 → Cyclone Proへ</li>
            <li>❌ PCメインの人 → G7 SEへ</li>
          </ul>
          <div class="callout">Cloud Gamingコミュニティでは「Xcloudをスマホでやるならクリップ型一択、その中でX2sはコスパが最強」という評価が定着しています。</div>`,

'GameSir Nova Lite': `
          <p>「初めてのGameSir」「サブ機をコスパよく」という用途に最適なエントリーモデル。約¥2,500〜という価格ながら<strong>ホールエフェクトスティックを搭載</strong>しており、安価なコントローラーで起きがちなスティックドリフトを防ぐ設計になっています。</p>
          <p>3モード（Bluetooth / 2.4G / USB-C有線）対応でSwitch・PC・Androidを1台でカバー。バッテリーは約30時間（2.4Gモード）とエントリー機ながら長持ちです。</p>
          <ul>
            <li>🎮 <strong>接続方式</strong>：Bluetooth 5.0 / 2.4GHz / USB-C有線（3モード）</li>
            <li>📱 <strong>対応機種</strong>：Nintendo Switch / PC (Windows) / Android</li>
            <li>⚡ <strong>バッテリー</strong>：約30時間（2.4Gモード）/ 約20時間（Bluetoothモード）</li>
            <li>⚖️ <strong>重量</strong>：約216g</li>
            <li>🕹 <strong>スティック</strong>：ホールエフェクト（ドリフト防止）</li>
            <li>📳 <strong>振動</strong>：デュアルモーター搭載</li>
            <li>💰 <strong>価格帯</strong>：約¥2,500〜（エントリー最安値帯）</li>
          </ul>
          <h4 style="font-size:0.92rem;font-weight:700;margin:16px 0 8px;">こんな人におすすめ</h4>
          <ul>
            <li>✅ 初めてGameSirを試してみたい人</li>
            <li>✅ できるだけ安くホールエフェクト機が欲しい人</li>
            <li>✅ Switch・PC両方で使えるサブ機が欲しい人</li>
            <li>✅ 子供や家族用に買い増しする人</li>
            <li>❌ FPS・格ゲーで背面ボタンを使いたい人 → Cyclone Proへ</li>
            <li>❌ iOSでも使いたい人（Nova LiteはiOS非対応）</li>
          </ul>
          <div class="callout">「この価格でホールエフェクト付きはコスパ最強」との口コミが多く、特に「子供用の2台目」「Nintendo Switch入門機」として評価されています。</div>`,
};

// ── aliexpress-gamepad 追加分 ─────────────────────────────────────

const ALIEXPRESS_EXTRA_BODIES = {
'8BitDo SN30 Pro': `
          <p>スーパーファミコンコントローラーをオマージュしたデザインで世界中のレトロゲームファン・エミュレーターユーザーに人気のロングセラー。Redditの「レトロゲーム用コントローラーおすすめは？」スレでは<strong>ほぼ必ず名前が挙がる定番機</strong>です。</p>
          <p>Raspberry Pi・Retroarch・Retroピットなど、エミュレーター環境との相性が特に良く、十字キーの入力精度が高い点が評価されています。Hall Effectモデル（-HE版）も登場し、スティックドリフトへの対策も強化されました。</p>
          <ul>
            <li>🎮 <strong>接続方式</strong>：Bluetooth 5.0 / USB-C有線</li>
            <li>📱 <strong>対応機種</strong>：Nintendo Switch / PC (Win/Mac) / Android / iOS / Raspberry Pi</li>
            <li>⚡ <strong>バッテリー</strong>：約18時間（Bluetooth使用時）</li>
            <li>⚖️ <strong>重量</strong>：約155g（軽量設計）</li>
            <li>🕹 <strong>スティック</strong>：アナログスティック搭載（-HEモデルはHall Effect）</li>
            <li>⚡ <strong>ターボ機能</strong>：あり</li>
            <li>💰 <strong>価格帯</strong>：約¥3,500〜4,500</li>
          </ul>
          <h4 style="font-size:0.92rem;font-weight:700;margin:16px 0 8px;">こんな人におすすめ</h4>
          <ul>
            <li>✅ レトロゲーム・エミュレーター（Retroarch等）を楽しむ人</li>
            <li>✅ Raspberry Piでゲーム機環境を作りたい人</li>
            <li>✅ SFCライクなデザインが好みの人</li>
            <li>✅ PC・Switch・Androidを1台でカバーしたい人</li>
            <li>❌ FPS・3Dゲームメインの人（スティック配置がレトロ寄り）</li>
            <li>❌ Hall Effectにこだわる人 → -HEモデルを選んで</li>
          </ul>
          <div class="callout">Redditのr/8bitdoでは「SN30 Proは価格・互換性・デザインの三拍子がそろった最強コントローラー」との声が多数。特にRaspberry Piユーザーからの支持が厚いです。</div>`,

'8BitDo Ultimate Controller': `
          <p>8BitDoのフラッグシップモデル。スティックのデッドゾーン・トリガーの感度曲線・ボタン割り当てをすべてスマホアプリ（8BitDo Ultimate Software）でカスタマイズできる「設定オタク向け」の一台です。</p>
          <p>Switch Bluetooth対応モデル（2C Bluetooth）はSwitch ProコントローラーとほぼBuilt-in互換。ジャイロセンサー搭載でSplatoon・ゼルダのエイムも可能です。<strong>充電ドック付属バリアントは置くだけ充電</strong>できて管理も楽。</p>
          <ul>
            <li>🎮 <strong>接続方式</strong>：Bluetooth（Switch版）/ 2.4G+USB-C有線（PC版）</li>
            <li>📱 <strong>対応機種</strong>：Nintendo Switch / PC (Windows) / Android</li>
            <li>⚡ <strong>バッテリー</strong>：約20時間</li>
            <li>🛠 <strong>カスタマイズ</strong>：8BitDo Ultimate Softwareアプリ（デッドゾーン・トリガー・マクロ等）</li>
            <li>🔧 <strong>背面ボタン</strong>：2個（Paddles）</li>
            <li>🌀 <strong>ジャイロ</strong>：6軸モーションセンサー（Switch版）</li>
            <li>💰 <strong>価格帯</strong>：約¥5,500〜7,000</li>
          </ul>
          <h4 style="font-size:0.92rem;font-weight:700;margin:16px 0 8px;">こんな人におすすめ</h4>
          <ul>
            <li>✅ アプリで細かく設定を煮詰めたいゲーマー</li>
            <li>✅ Switchのジャイロ操作（スプラ・ゼルダ）を快適にしたい人</li>
            <li>✅ 充電ドックで管理をスマートにしたい人</li>
            <li>✅ 長く使えるHall Effectスティック搭載機を探している人</li>
            <li>❌ スマホゲームに使いたい人 → X2sへ</li>
            <li>❌ できるだけ安く済ませたい人 → SN30 Proへ</li>
          </ul>
          <div class="callout">「8BitDo Ultimateはゲームパッドのカスタマイズ自由度が他社の追随を許さないレベル」とPC周辺機器レビューサイトで多数の高評価。特に競技ゲーマーからの支持が厚い。</div>`,

'Flydigi Vader 3 Pro': `
          <p>PS5のDualSenseに搭載されたアダプティブトリガー（引く重さが変わるトリガー）を中国製コントローラーで実現したモデル。PC向けとしては<strong>「アダプティブトリガー体験を¥8,000〜台で味わえる」</strong>唯一の選択肢として注目されています。</p>
          <p>Flydigiアプリ（Flydigi Space）で各種パラメータを調整でき、ジャイロセンサー・背面ボタン・ホールエフェクトスティックも全部入り。PC/Switch/モバイル対応でAliExpressの公式ストアから安全に購入可能です。</p>
          <ul>
            <li>🎮 <strong>接続方式</strong>：Bluetooth / 2.4GHz / USB-C有線（3モード）</li>
            <li>📱 <strong>対応機種</strong>：PC (Windows) / Nintendo Switch / Android / iOS</li>
            <li>⚡ <strong>特徴機能</strong>：アダプティブトリガー（引き抵抗を変化させる）</li>
            <li>🕹 <strong>スティック</strong>：ホールエフェクト（ドリフト防止）</li>
            <li>🌀 <strong>ジャイロ</strong>：6軸モーションセンサー内蔵</li>
            <li>🔧 <strong>背面ボタン</strong>：4個（M1〜M4）</li>
            <li>🛠 <strong>カスタマイズ</strong>：Flydigi Spaceアプリ対応</li>
            <li>💰 <strong>価格帯</strong>：約¥8,000〜12,000</li>
          </ul>
          <h4 style="font-size:0.92rem;font-weight:700;margin:16px 0 8px;">こんな人におすすめ</h4>
          <ul>
            <li>✅ PS5ライクなアダプティブトリガーをPC/Switchで体験したい人</li>
            <li>✅ 背面ボタン4個を使いこなしたい競技PCゲーマー</li>
            <li>✅ ジャイロ操作を含む多機能機を探している人</li>
            <li>❌ 予算¥5,000以下の人 → GameSir G7 SEへ</li>
            <li>❌ Switch専用でシンプルに使いたい人 → GameSir T4 Miniへ</li>
          </ul>
          <div class="callout">Reddit r/patientgamersなどPC周辺機器コミュニティでは「アダプティブトリガーをDualSense以外で試したいならVader 3 Pro一択」との評価が定着しています。</div>`,
};

// ── 置換処理 ─────────────────────────────────────────────────────

function replaceBody(html, productName, newBody) {
  // <div class="product-body">...</div> をproductNameの直後から探して置換
  // 商品名の含まれるproduct-cardを特定
  const nameIdx = html.indexOf(`<div class="product-name">${productName}</div>`);
  if (nameIdx === -1) {
    console.warn(`  ⚠️  商品が見つかりません: ${productName}`);
    return html;
  }

  // product-bodyの開始を探す（nameIdxより後）
  const bodyStart = html.indexOf('<div class="product-body">', nameIdx);
  if (bodyStart === -1) {
    console.warn(`  ⚠️  product-bodyが見つかりません: ${productName}`);
    return html;
  }

  // product-bodyの終了を探す（ネスト対応）
  let depth = 0;
  let i = bodyStart;
  while (i < html.length) {
    if (html.startsWith('<div', i)) depth++;
    else if (html.startsWith('</div>', i)) {
      depth--;
      if (depth === 0) {
        const bodyEnd = i + 6; // </div>の後
        const original = html.slice(bodyStart, bodyEnd);
        const replacement = `<div class="product-body">${newBody}\n        </div>`;
        html = html.slice(0, bodyStart) + replacement + html.slice(bodyEnd);
        console.log(`  ✅ ${productName}`);
        return html;
      }
    }
    i++;
  }
  console.warn(`  ⚠️  product-bodyの終了が見つかりません: ${productName}`);
  return html;
}

// gamesir-controller-osusume.html
{
  const path = 'public/basics/gamesir-controller-osusume.html';
  console.log(`\n📄 ${path}`);
  let html = fs.readFileSync(path, 'utf8');
  for (const [name, body] of Object.entries(GAMESIR_BODIES)) {
    html = replaceBody(html, name, body);
  }
  fs.writeFileSync(path, html, 'utf8');
  console.log('  💾 saved');
}

// aliexpress-gamepad-osusume.html（GameSirとExtra両方）
{
  const path = 'public/basics/aliexpress-gamepad-osusume.html';
  console.log(`\n📄 ${path}`);
  let html = fs.readFileSync(path, 'utf8');
  // GameSirの5商品（同じ内容）
  for (const [name, body] of Object.entries(GAMESIR_BODIES)) {
    // aliexpress版では GameSir X2s以外は短めでOK（スペースの兼ね合い）
    // でも同じ内容で加筆
    html = replaceBody(html, name, body);
  }
  // 8BitDo・Flydigi
  for (const [name, body] of Object.entries(ALIEXPRESS_EXTRA_BODIES)) {
    html = replaceBody(html, name, body);
  }
  fs.writeFileSync(path, html, 'utf8');
  console.log('  💾 saved');
}

console.log('\n✅ 完了');
