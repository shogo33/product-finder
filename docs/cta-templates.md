# CTA テンプレート集

記事HTMLにコピペするだけで使えます。CSSは `components.js` から自動注入されます。

---

## 1. AliExpress単体CTA

```html
<div class="cta-box">
  <p class="cta-lead">この商品をAliExpressで最安値チェック</p>
  <div class="cta-buttons">
    <a class="cta-btn-aliex" href="https://ja.aliexpress.com/w/wholesale-キーワード.html?SearchText=キーワード&sortType=total_tranRanking_desc" target="_blank" rel="noopener sponsored">AliExpressで探す →</a>
  </div>
  <p class="cta-note">※ リンク先はアフィリエイトリンクです</p>
</div>
```

---

## 2. Amazon単体CTA（リンクはユーザーから受け取る）

```html
<div class="cta-box">
  <p class="cta-lead">Amazonで最新価格・レビューを確認する</p>
  <div class="cta-buttons">
    <a class="cta-btn-amazon" href="Amazonアフィリエイトリンク" target="_blank" rel="noopener sponsored">Amazonで見る →</a>
  </div>
  <p class="cta-note">※ リンク先はアフィリエイトリンクです</p>
</div>
```

---

## 3. AliExpress + Amazon 比較CTA

```html
<div class="cta-box">
  <p class="cta-lead">どちらで買う？価格・送料を比較してみよう</p>
  <p class="cta-sub">AliExpress：送料無料・格安・到着まで2〜4週間｜Amazon：即日〜翌日配送・返品しやすい</p>
  <div class="cta-buttons">
    <a class="cta-btn-aliex" href="AliExpressリンク" target="_blank" rel="noopener sponsored">AliExpressで見る →</a>
    <a class="cta-btn-amazon" href="Amazonアフィリエイトリンク" target="_blank" rel="noopener sponsored">Amazonで見る →</a>
  </div>
  <p class="cta-note">※ 各リンクはアフィリエイトリンクです</p>
</div>
```

---

## 4. アプリ誘導CTA

```html
<div class="cta-box">
  <p class="cta-lead">もっとお得な商品を見つけたいなら</p>
  <p class="cta-sub">アリエクSwipeでスワイプするだけで格安商品が見つかります</p>
  <div class="cta-buttons">
    <a class="cta-btn-app" href="https://aliswipe.com/app/" target="_blank" rel="noopener">無料で使ってみる →</a>
  </div>
</div>
```

---

## クラス一覧

| クラス | 役割 |
|--------|------|
| `cta-box` | ボックス全体（背景・枠・余白） |
| `cta-lead` | メインテキスト（太字） |
| `cta-sub` | サブテキスト（小さめ・グレー） |
| `cta-buttons` | ボタン群のラッパー |
| `cta-btn-aliex` | AliExpressボタン（赤） |
| `cta-btn-amazon` | Amazonボタン（オレンジ） |
| `cta-btn-app` | アプリ誘導ボタン（赤グラデ） |
| `cta-note` | 注記テキスト（小さめ・薄グレー） |
