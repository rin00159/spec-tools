# 前提とするファイル構造と概念

`spec-tools` は、対象となるリポジトリが特定のディレクトリ構造や概念に従って文書を配置していることを前提（またはデフォルトの規約）としています。

## 1. 概念: 到達点 (ImplPoint) と Phase

本ツールはプロジェクトの進行を **Major.Minor.Phase**（例: `v0_1_16`）という到達点（ImplPoint）で管理します。

- 実行コードが現在どの Phase に到達しているかは、リポジトリルートの **`spec/PHASE`** ファイルに単一の文字列として記録されていることを前提とします（例: `v0_1_16`）。
- 条項が `impl` 属性に指定した Phase が、現在地以下の場合は「実装済み（テスト対象）」としてカバレッジの対象になります。

## 2. 前提とするファイル・ディレクトリ構造

設定（`spec-tools.config.json`）で一部のパスは変更可能ですが、標準的には以下の構造を前提としています。
モノレポ構成の場合、ルートディレクトリに加えて `packages/*` の配下にもそれぞれ固有のドキュメントを配置できます。

```text
<repo_root>/
 ├── spec/
 │    ├── PHASE               # 現在の到達点 (例: v0_1_16)
 │    ├── INDEX.md            # `spec-index` により自動生成される条項索引
 │    └── *.md                # 条項を定義する Markdown 仕様書
 │
 ├── docs/
 │    ├── decisions/          # アーキテクチャ決定記録 (ADR)
 │    │    ├── INDEX.md       # 自動生成される索引
 │    │    └── <NNN>-*.md     # `scaffold decision` で作られる文書 (NNNは連番)
 │    │
 │    ├── task/               # タスク記録
 │    │    ├── INDEX.md       # 自動生成される索引
 │    │    ├── README.md      # 着手順の判断などを手書きで残す正本
 │    │    └── <NNN>-*.md     # `scaffold task` で作られる文書
 │    │
 │    ├── plan/
 │    │    └── <major>_<minor>/
 │    │         └── phase<N>.md   # 各フェーズの計画書
 │    │
 │    └── acceptance/
 │         └── phase-v<major>_<minor>-<N>.md # `scaffold acceptance` で作られる検収証跡
 │
 ├── packages/
 │    └── <package_name>/
 │         └── docs/
 │              ├── spec/       # パッケージ固有の仕様書
 │              ├── decisions/  # パッケージ固有の意思決定
 │              └── task/       # パッケージ固有のタスク
 │
 └── templates/                 # scaffold 実行時に参照されるテンプレートファイル群
      ├── decision.md
      ├── task.md
      └── acceptance.md
```

## 3. 条項の記述規則

仕様書（`spec/**/*.md`）の中では、以下のような見出しと属性を使って条項（Clause）を定義します。

```markdown
## K-CORE-DEF-001 単調精緻化

**属性**: `status: active`, `since: 0.1.0`, `kind: 規範`, `impl: v0_1_1`

(ここから次の `## ` までの内容が条項の本文として扱われます)
```

- **見出し**: 正規表現（デフォルト: `(K-[A-Z0-9]+(?:-[A-Z0-9]+)*)`）に合致する ID が必要です。
- **属性行**: `status`, `since`, `kind`, `impl` などの属性を含む行が直後に続く必要があります。
  - `status`: デフォルトでは `active` であれば有効とみなします。
  - `kind`: デフォルトでは `規範` であれば必須要件（Normative）として扱います。

# ライブラリでは扱わないが 提案するファイル構造と概念

## 1. 提案するファイル・ディレクトリ構造
<repo_root>/
 └── docs/
      ├── instruction   # 説明書
      ├── guide         # 利用者向けの簡易説明
      ├── source        # いずれにも該当しない資料
      └── discussions   # decisionsに含まれない 議論記録