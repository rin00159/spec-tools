# spec-tools

`spec-tools` は、マークダウンによる仕様（spec）、アーキテクチャ決定記録（decisions）、タスク（task）を管理し、実装とのカバレッジや参照整合性を検証するための CLI ツールセットです。

## 主な機能

- **仕様カバレッジの検査 (`spec-coverage`)**: 
  ソースコード、コメント、テストファイル内に記述された条項 ID（例: `K-CORE-001`）を走査し、仕様と実装の紐付けや漏れがないかを検査します。
- **参照の一貫性検査 (`doc-ref`)**: 
  複数のパッケージをまたいだ意思決定（decisions）やタスク（task）の参照（例: `root:200` や `045`）が壊れていないか検査・解決し、索引（`INDEX.md`）を自動生成します。
- **雛形の生成 (`scaffold`)**: 
  番号重複を防ぎながら、新しい decision や task、acceptance の markdown ファイルを自動採番して生成します。
- **同期チェック (`check-mirror`)**: 
  指定したディレクトリ間でファイルが同期されているかを検証します（例: `.claude/` と `.agents/`）。

## ドキュメント一覧

- [前提とするファイル構造と概念 (assumed-structure.md)](./assumed-structure.md)
- [コマンドリファレンス (commands.md)](./commands.md)
- [設定ファイル (configuration.md)](./configuration.md)
- [spec-tools 自体の内部構造 (internal-structure.md)](./internal-structure.md)
