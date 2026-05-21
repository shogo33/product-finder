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
