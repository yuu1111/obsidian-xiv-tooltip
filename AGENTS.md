# プロジェクト概要

FFXIV (Final Fantasy XIV) のアクションアイコンとツールチップを表示するObsidianプラグイン。`{アクション名}` または `{ActionName}` の構文でアクションを埋め込み、ホバー時にXIVAPIから取得したアイコン・説明文のツールチップを表示する。

# コマンド

```bash
bun dev          # ウォッチモード (インラインソースマップ付きリビルド)
bun build        # プロダクションビルド (main.js 生成)
bun run typecheck # 型チェック (出力なし)
bun run lint     # Biomeでリント
bun run format   # Biomeで自動フォーマット
```

ビルド成果物は `main.js` (リポジトリルート)。Obsidianプラグインはこのファイルを直接読み込む。

# アーキテクチャ

## データフロー

```
Markdownテキスト中の {ActionName}
    ↓ MarkdownPostProcessor (main.ts)
    ↓ テキストノード走査 + 正規表現 /\{([^}]+)\}/g
    ↓ ActionCache確認 (xivapi.ts)
    ↓ [未キャッシュ] XIVAPI v2 検索
    ↓ DOM更新: アイコン + ラベル + ツールチップ
```

## ファイル構成

- **`src/main.ts`** — プラグイン本体。`XivTooltipPlugin extends Plugin` でObsidian APIと統合。DOMツリーを走査してテキストノードからアクションパターンを検出し、非同期でデータ取得後にDOMを更新する。CODE/PRE/SCRIPT/STYLE/Aタグの内部はスキップ。
- **`src/xivapi.ts`** — XIVAPI v2との通信層。`ActionCache`クラスがメモリキャッシュとinflight requestの重複排除を担う。日本語/英語の自動判別 (`detectLanguage`) でAPIクエリ言語を切り替える。
- **`src/types.ts`** — 型定義のみ。`ActionData`, `Language`, `XivApiSearchResult` など。
- **`esbuild.config.ts`** — バンドル設定。obsidianとcodemirrorはexternalとして除外。
- **`styles.css`** — Obsidianのテーマ変数 (`--background-secondary` 等) を使用したスタイル。

## 外部依存

- **XIVAPI v2**: `https://v2.xivapi.com/api/search` でAction sheetを検索
- **Garland Tools**: クリック時に `https://garlandtools.org/db/#action/{id}` を開く

## キャッシュ戦略

`ActionCache` は2段階のキャッシュを持つ: 完了済み結果のMapと、進行中のPromiseのMap (重複リクエスト防止)。プラグインアンロード時にクリアされる。

# ビルドツール

- **Bun** — パッケージマネージャ兼ランナー
- **esbuild** — バンドラー (CommonJS出力)
- **Biome** — リンター/フォーマッター (`@yuu1111/biome-config/base.json` を継承)
- **TypeScript** — `@yuu1111/tsconfig/base.json` を継承、ES2022ターゲット
