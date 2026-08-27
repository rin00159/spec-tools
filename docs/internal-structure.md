# `spec-tools` リポジトリの内部構造

このドキュメントでは、`spec-tools` 自体の開発におけるディレクトリ構造や設計の前提について明文化します。

## ディレクトリ構成

```text
spec-tools/
 ├── src/
 │    ├── cli.ts                # エントリポイント。引数パースと各コマンドへのディスパッチを行う
 │    ├── config.ts             # ユーザー設定 (spec-tools.config.ts) の読み込み・デフォルト値の定義
 │    └── commands/             # コマンドごとの実装ディレクトリ
 │         ├── spec-coverage/   # `spec-coverage` コマンドの実装
 │         ├── spec-index/      # `spec-index` コマンドの実装
 │         ├── doc-ref/         # `doc-ref` (list, show, index, check) コマンドの実装
 │         ├── scaffold/        # `scaffold` (decision, task, acceptance, phase) コマンドの実装
 │         ├── check-mirror.ts  # `check-mirror` コマンドの実装
 │         ├── check-plan-layout.ts # planファイル構成チェック
 │         └── check-current-task.ts# task構成チェック
 │
 ├── templates/                 # `scaffold` 用のデフォルトの Markdown テンプレート群
 │    ├── decision.md
 │    ├── task.md
 │    └── acceptance.md
 │
 ├── fixtures/                  # テストケース用のダミーリポジトリやファイル群
 │
 ├── docs/                      # ツール自体の説明書 (このディレクトリ)
 │
 ├── package.json
 ├── tsconfig.json
 ├── tsdown.config.ts           # tsdown によるビルド設定 (dist/ の生成)
 └── biome.json                 # Linter / Formatter の設定
```

## 設計の前提・制約

1. **純粋関数の分離**: 
   複雑なパース処理や集計処理（例: `clause.ts` の `extractClauseBody`, `specRoots.ts` のパス解決）は副作用のない純粋関数としてテスト可能に設計されています。
2. **外部依存の最小化**:
   ツールの性質上、対象のリポジトリ（Node.js に限らず）を走査するため、npm パッケージマネージャー特有の制約（`package.json` が必須など）を強制せず、純粋なファイルシステム操作ベース（`fs/promises` 等）で解決を行います。
3. **エラーメッセージの英語化**:
   汎用ツールとして様々なプロジェクトで使われることを想定し、`throw new Error` や `console.*` への出力文言は英語ベースで記述されています（内部向け特定プロジェクトの用語は含めない）。
