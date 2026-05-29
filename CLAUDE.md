# プロジェクト指示

## 記事作成・更新後の必須手順

`public/basics/` 以下のHTMLファイルを新規作成または更新したら、**必ず最後に以下を実行すること**：

```
npm run gen-all
```

これにより以下が自動処理される：
1. 記事内の外部画像をローカル保存（`public/images/products/`）→ リンク切れ防止
2. `sitemap.xml` / `sitemap.html` の更新
3. `public/index.html` のおすすめカード更新
4. OGP画像の生成（`public/images/ogp/`）

**pushはユーザーが明示的に依頼した時だけ実行する。**

## 記事新規作成のパイプライン（必須）

新しいHTMLを手書きで作ってはいけない。必ず以下の順で実行する：

```
node scripts/step1-plan.mjs <slug>        # プランJSON作成
node scripts/step2-research.mjs <slug>    # AliExpress商品情報 + Tavily/Reddit調査
node scripts/step3-write.mjs <slug>       # Claude が記事生成
node scripts/step3-factcheck.mjs <slug>   # スペック矛盾・FAQ不一致を検出【必須】
node scripts/gen-voices.mjs <slug>        # Reddit実データをVOICEブロックに注入【必須・省略禁止】
npm run gen-all                           # sitemap/index/OGP更新
```

**`step3-factcheck.mjs` は省略禁止。** 問題が検出された場合は exit 1 で停止するので、指摘された問題を修正してから次のステップに進む。

**`gen-voices.mjs` は省略禁止。** X声（スクショ）とReddit声（gen-voices自動取得）の両方が揃って記事完成。どちらか欠けている場合はその理由を明記してから公開する。

- slug は `public/basics/` に置くHTMLのファイル名（拡張子なし）
- step2 は AliExpress API + Tavily API を使うため `.env` が必要
- step3 が出力するHTMLはカルーセル形式（`data-carousel`）を使用している

## 商品calloutの禁止事項

商品本文の `<div class="callout">` に**一般知識・推測・作り話を書いてはいけない**。
Reddit実データ（`gen-voices.mjs` または `enrich-product-reddit.mjs`）を取得してから記載する。

## AliExpressアフィリエイトリンク（必須）

記事にAliExpressの商品情報を掲載する場合、**必ずAPIでアフィリエイトリンクを取得して掲載する**。

- `step2-research.mjs` が自動取得するので、手動でリンクを作ってはいけない
- アフィリエイトリンクなしで商品URLを直接貼るのは禁止
- リンク取得に失敗した場合は商品ごと掲載しない（リンクなし掲載は収益機会の損失）

## 公式セラー限定ルール（ブランド商品）

UGREEN・Baseus・Naturehike・GameSirなどのブランド商品を掲載する場合、**必ず公式ストア（Official Store）のセラーから取得する**。

- AliExpressの検索結果で「Official Store」「flagship store」と表示されているセラーのみ採用
- 怪しいサードパーティセラー（ブランド名をタイトルに入れているだけの無名セラー）は使わない
- `step2-research.mjs` 実行時に公式ストア以外の商品が混入していた場合は手動で除外する
- 公式ストアが見つからない場合は「AliExpress公式ストアなし」として掲載を見送るか、Amazonリンクのみにする

## Amazonアフィリエイトリンク（商品おすすめ記事）

商品をおすすめする記事では、**AliExpressリンクに加えてAmazonリンクも必ず入れる**。

- AmazonアフィリエイトURLは**ユーザーが払い出す**ため、記事を書く前に「この商品のAmazonアフィリエイトリンクをください」と確認する
- 自分でAmazonリンクを推測・生成してはいけない
- AliExpressにない商品はAmazonリンクのみでもOK
- 両方ある場合は両方掲載する（どちらで買っても収益が発生する構造にする）

## サムネイル画像のルール

記事の種類によってサムネイルの作り方が異なる。

### 商品おすすめ・比較記事（例：ugreen-mouse-osusume, gamesir-controller-osusume）
SVGは不要。記事内の最初の商品画像（`/images/products/...`）が自動的にサムネイルになる。
→ **商品画像が必ずローカルに保存されていること**を確認する（`npm run gen-all` で自動DL）。

### ガイド・解説・ブランド紹介記事（例：aliexpress-what-is, naturehike-brand）
商品画像がないため、**`public/images/{slug}.svg` を必ず作成する**。

SVGデザインルール：
- `viewBox="0 0 400 220"` 固定
- 背景は濃いダーク系（`#0f172a` や `#1a1a2e` など）
- 記事テーマに合ったアイコン・図形をSVGで描く
- ブランド名・価格帯・キャッチコピーなどの文字を入れる
- アクセントカラーは記事テーマに合わせる
- 下部に記事タイトルの短縮版を `font-size="10" fill="#9ca3af"` で入れる

## OGP画像のデザインルール

OGP画像（1200×630）は `npm run gen-all` で自動生成され、必ず**ペルソナの顔**が右下に入る。
ペルソナ画像は `public/images/personas/persona-gadget-surprised.png`（ガジェット系）または
`persona-outdoor-surprised.png`（アウトドア系）。

### 商品記事（外部CDN画像あり）
YouTubeサムネ風：商品画像を背景、左にタイトルテキスト、右下にペルソナ顔。
→ 自動処理されるため追加作業不要。

### ガイド・解説記事（商品画像なし）
赤グラデ背景＋大テキスト＋右下にペルソナ顔。
→ `scripts/gen-ogp.mjs` の `ARTICLE_COPY` に**必ずエントリを追加する**：

```js
// scripts/gen-ogp.mjs の ARTICLE_COPY に追加
'slug-name': ['メインテキスト\n2行目', 'サブテキスト\n2行目'],
```

- 配列の1要素目がメイン（大きい文字）、2要素目がサブ（小さい文字）
- 各行10文字以内
- 例：`'aliexpress-what-is': ['アリエクって\nなに？', 'はじめての方向け\n完全ガイド']`

## 記事執筆ペルソナ（必須）

記事を書く前に、**そのテーマに熱狂している人物像**を具体的に作り込む。
プランJSON（step1）の `persona` フィールドに記載し、**そのキャラクターとして**記事全体を書く。

ペルソナは記事ごとに可変で設定する。例：
- GameSirコントローラー記事 → GameSirを実際に複数台持ち、ホールエフェクトの違いを語れるゲーマー
- UGREENマウス記事 → AliExpressで周辺機器を買い漁り、スペック差を実感で語れるガジェットオタク
- Naturehikeテント記事 → 実際にキャンプに行き、設営のしやすさや重量を現場目線で語れるアウトドア好き
- アリエク解説記事 → 年間100件以上アリエクで購入し、失敗も成功も経験してきたヘビーユーザー

**ペルソナの熱量が記事に乗ること**が重要。「〜です」「〜ます」の無難な文体ではなく、
そのジャンルが好きな人間が実感を持って語るような文章にする。
ペルソナがずれると記事が薄くなる。テーマが変わるたびに必ず作り直す。

## X（旧Twitter）の声データ

記事に「Xでの声」を入れる場合、**ユーザーからのスクショ画像を必ず参照する**。

### ワークフロー（必須）
1. 記事着手前に、以下の形式でユーザーに**検索クエリを提示する**：
   - 「X検索クエリ候補：`[商品名] 買った`, `[商品名] レビュー`, `[商品名] 届いた`」
2. ユーザーがスクショをアップロードしたら、その画像を**Claude が直接分析**してリアルな声を抽出する
3. 抽出した声を `<p class="x-voice">` などのブロックに記載する

### X声データがない場合
- スクショが提供されていない段階で記事を書き始めてはいけない
- **必ずユーザーにスクショを要求してから着手する**：
  > 「X（旧Twitter）の声も入れたいので、`[クエリ]` で検索したスクショをいただけますか？」

### Reddit vs X の使い分け
- Reddit: `gen-voices.mjs` で自動取得 → `<!-- VOICE-START/END -->` ブロックに注入
- X: ユーザーからのスクショ → Claude が画像を読んで声を抽出・記事に手動で追記

## step2-research 後の商品検証（必須）

`step2-research.mjs` 実行後、**必ず以下を目視確認してから step3 に進む**。

### ① 取得商品が「本体」かを確認する
AliExpress API のキーワード検索は人気順・広告順で返るため、**ブランド名が入ったアクセサリー（ケース・スタンド・カバー・ケーブル）が混入しやすい**。

- NG例：「GameSir T4 Pro Cyclone コントローラー用 電話クリップスタンド」→ アクセサリー
- OK例：「GameSir T4 Cyclone Pro ワイヤレスコントローラー」→ 本体

対処：アクセサリーが混入していたら `scripts/rebuild-research.mjs <slug> <pid1,pid2,...>` で正しいプロダクトIDを直接指定して差し替える。

### ② アフィリエイトリンクが商品ごとに異なるか確認する
research JSON を開き、全商品の `affiliateLink` が**すべて異なる URL**になっているか確認する。

```bash
node -e "const d=JSON.parse(require('fs').readFileSync('data/articles/<slug>-research.json','utf8')); d.products.forEach(p=>console.log(p.cleanName, '|', p.affiliateLink))"
```

- 全商品が同一URLになっている場合は **step2 を再実行するか rebuild-research.mjs を使う**
- 同一URLのまま step3 に進んではいけない（404リンクの量産につながる）

### ③ 正しいプロダクトIDを調べる方法
キーワード検索で外れた場合は、以下のワンライナーで特定モデル名を直接検索する：

```bash
node -e "
import('dotenv').then(({default:d})=>{d.config({override:true});
const {createHmac}=require('crypto');
const sign=p=>{const s=Object.keys(p).sort().map(k=>k+p[k]).join('');return createHmac('sha256',process.env.ALIEXPRESS_APP_SECRET).update(s).digest('hex').toUpperCase()};
const p={app_key:process.env.ALIEXPRESS_APP_KEY,method:'aliexpress.affiliate.product.query',sign_method:'sha256',timestamp:String(Date.now()),tracking_id:process.env.ALIEXPRESS_TRACKING_ID,keywords:'GameSir G7 SE wired controller',target_currency:'JPY',target_language:'JA',page_size:'5',fields:'product_id,product_title'};
p.sign=sign(p);
fetch('https://api-sg.aliexpress.com/sync',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(p)}).then(r=>r.json()).then(r=>(r?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product??[]).forEach(x=>console.log(x.product_id,'|',x.product_title?.slice(0,80))))
})
"
```

取得したIDを `rebuild-research.mjs` に渡せば正確な商品データで research JSON を上書きできる。

## 記事作成前の確認事項

1. 既存記事とキーワードがかぶっていないか確認する（カニバリゼーション）
2. 商品が `data/products.json` にあるか確認する（なければ step2 が AliExpress API で自動取得）
3. **step2 後に商品検証**（上記セクション参照）を必ず実施してから step3 に進む
4. Xの声も入れる場合は、検索クエリをユーザーに提示してスクショをもらってから着手する
5. **step3 前に Amazon・AliExpress レビューデータの提供をユーザーに依頼する**（下記参照）

---

## サイトコンセプト

Aliswipe は「AliExpressで失敗しないための翻訳者・案内人」を目指す。
「AliExpress版 Wirecutter」ではなく、**海外レビュー整理・Reddit/X/Amazon/AliExpressレビュー分析・型番整理・偽物回避・比較整理・初心者不安解消**を強みとする。
実機レビュー特化ではないため、「使いました」と断定せず「〜という声が多い」「〜という報告がある」形で表現する。

---

## 商品選定フロー（検索ボリュームベース）

**AliExpress APIの人気順だけで商品を選ばない。**必ず日本語検索需要を先に確認する。

### Step 1: キーワード検索データを参照
`data/keyword-csvs/keyword-all.csv` を参照する（列: キーワード・月間検索数・データ種別）。

### Step 2: 以下を確認
- 月間検索数（月間 100 以上が目安）
- サジェスト（モデル名が検索されているか）
- 比較検索（「〇〇 vs △△」系）
- 不安検索（「〇〇 偽物」「〇〇 関税」系）
- 型番検索（具体的な型番が検索されているか）

### Step 3: 検索需要が強い商品を優先採用
検索需要がないモデルは記事への掲載を見送るか、step2 の rebuild-research.mjs で差し替える。

---

## 外部レビューデータの連携（step3 前に必須）

記事内の「レビュー傾向」は以下の優先順位で記載する：
1. **Reddit**（gen-voices.mjs で自動取得）
2. **X**（ユーザーがスクショを提供 → Claude が画像分析）
3. **Amazon・AliExpressレビュー**（ユーザーがデータを提供）

### Amazon・AliExpress レビューデータ連携ルール
- step3 実施前に必ずユーザーに依頼する：
  > 「この記事のAmazonレビュー（Chromeの口コミページのスクショ等）とAliExpressレビューをいただけますか？」
- 提供されたデータから「傾向」として記載する（「〜という声が多い」形式）
- 提供がない場合は Reddit + X の声のみで記事を完成させ、その旨を明記する
- **根拠不明な口コミ・AI生成口コミは禁止**

---

## 記事品質ガイドライン（全記事共通）

### 禁止表現（step3 プロンプトにも組み込み済み）
以下の表現は絶対に使わない：
- コスパ最強・圧倒的・神・革命的・非常に優秀・快適・高性能
- 「〜最強」「〜完璧」「〜誰にでもおすすめ」
- 根拠のない「〜で有名」「〜に定評がある」

### 文体ルール（ですます調）
- **ですます調で統一**：「〜です。」「〜ます。」「〜になります。」で完結させる
- 感嘆・大げさな表現は使わない。事実をそのまま伝える
- **ネットスラング禁止**（step3b が自動修正）:
  - 「〜の件」「〜た件」 → 削除または「について」に置換
  - 「という時点で、もう〜」 → 「だけで十分」に置換
  - 「刺さる人には刺さる」「でしかない」「もはや〜レベル」
  - 「なんなら」「ある意味」「ある種の」
- 熱量は語り口ではなく「情報密度と具体性」で表現する

### 推奨表現
- 「○○な人には向いている」
- 「△△用途なら十分」
- 「人によって好みが分かれる」
- 「〜という声が多い」「〜という報告がある」
- 「少し〇〇だが、〜クラスではかなり〜」

### 必須記事構造
1. **結論を冒頭に置く**（誰向けか・何がベストか）
2. **「こんな人向け」を先に書く**（出張が多い人向け・Steam Deckユーザー向けなど）
3. **比較表は記事冒頭付近に配置**（本文を読む前に比較できるようにする）
4. **デメリットを必ず書く**（重い・発熱・箱潰れ・初期不良報告など）
5. **「想像とのズレ」を書く**（写真より少し大きい・思ったより発熱が少ない等）
6. **記事冒頭にFV画像を表示**（最初の商品の1枚目画像。`<figure class="fv-product-image">` を使用。step3a-scaffold が自動生成）
7. **CTAボックスに商品画像を入れる**（購入直前のイメージ確認用。AliEx/Amazonボタンの上に商品画像を配置）
8. **商品セクション間に切り替え線を入れる**（`<div class="product-divider">` を使用。次の商品に移ることを視覚的に明示）

### タイトルルール
- 「2026年最新」を乱用しない
- 悪い例：「○○おすすめ5選【2026年最新】」
- 良い例：「MacBook用ならこれ。UGREEN充電器おすすめ」「出張向けUGREEN充電器比較」
- 用途・感情・悩みをタイトルに含める

### 内部リンク方針
- **本文中に自然にリンクを差し込む**（記事末尾の関連記事だけに頼らない）
- 悪い例：関連記事一覧のみ
- 良い例：「UGREEN USBハブ比較は[こちら](/gadget/ugreen-usb-hub-osusume.html)」

### ブランドトーン
- 怪しい商品を冷静に整理する
- 過剰に煽らない（「今すぐ買え！」「在庫僅か！」は禁止）
- 海外レビューを読者に代わって翻訳・整理するスタンス
- 初心者にも分かる言葉を使う

---

## 既存記事リフレッシュ（段階的修正）

既存記事を修正する際は**既存パーツ（アフィリエイトリンク・画像・Reddit声・比較表）をそのまま流用**し、以下の差分のみ追加・修正する：

1. 冒頭に結論ブロック（`<div class="article-conclusion">` 等）を追加
2. 比較表が本文後半にある場合は冒頭付近に移動
3. 禁止表現を推奨表現に置き換え
4. デメリット記述が欠けていれば追加

修正対象の優先順位は `node scripts/audit-articles.mjs` で確認する（不足項目をスコアリング）。
