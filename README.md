# Obsidian XIV Tooltip

> `{アクション名}` / `{ActionName}` 記法でFF14アクションのアイコンとツールチップをObsidianに表示するプラグイン

## 概要

ノート内に `{ファイア}` や `{Fire}` のように書くと、XIVAPI からアクション情報を取得してアイコンとラベルをインライン表示し、ホバー時にツールチップ (アイコン・説明文) を表示します。クリックすると Garland Tools のアクション詳細ページを開きます。

- 日本語・英語のアクション名を自動判別
- メモリキャッシュによる重複リクエスト防止
- Live Preview / Reading View の両方に対応

## 必要条件

- [Bun](https://bun.sh/) 1.x 以上

## インストール

```bash
bun install
```

## コマンド

```bash
bun dev          # ウォッチモード (インラインソースマップ付きリビルド)
bun build        # プロダクションビルド (main.js 生成)
bun run typecheck # 型チェック (出力なし)
bun run lint     # Biome でリント
bun run format   # Biome で自動フォーマット
```

ビルド成果物は `main.js` (リポジトリルート)。Obsidian プラグインはこのファイルを直接読み込みます。

## 使い方

ノートに以下の記法でアクション名を記述します:

```
{ファイア}
{Fire}
{連撃}
{Combo Attack}
```

## ディレクトリ構成

```
src/
  main.ts        # プラグイン本体。DOM 走査・アクションパターン検出
  xivapi.ts      # XIVAPI v2 通信層・ActionCache
  dom.ts         # DOM 操作ユーティリティ
  livepreview.ts # Live Preview 対応
  constants.ts   # 定数定義
  types.ts       # 型定義
styles.css        # Obsidian テーマ変数を使用したスタイル
esbuild.config.ts # バンドル設定
manifest.json     # Obsidian プラグインマニフェスト
main.js           # ビルド成果物
```

## ライセンス

MIT
