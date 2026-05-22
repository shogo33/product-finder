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
node scripts/gen-voices.mjs <slug>        # Reddit実データをVOICEブロックに注入
npm run gen-all                           # sitemap/index/OGP更新
```

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

## 記事作成前の確認事項

1. 既存記事とキーワードがかぶっていないか確認する（カニバリゼーション）
2. 商品が `data/products.json` にあるか確認する（なければ step2 が AliExpress API で自動取得）
3. Xの声も入れる場合は、検索クエリをユーザーに提示してスクショをもらってから着手する
