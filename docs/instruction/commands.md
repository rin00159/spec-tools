# コマンドリファレンス

本ツールはCLIとして機能します（`node dist/cli.mjs <command>` または `pnpm spec-tools <command>`）。

## `spec-coverage`
実装（ソースコード、テストファイル）と仕様書の条項（Clause）の突き合わせを行います。
現在の Phase までに実装されるべき「規範」条項にテストが存在するか、または未知の条項を参照していないかを検査します。

```bash
spec-tools spec-coverage [--phase <override_phase>]
```

## `spec-index`
`spec/` 等の仕様書群を走査し、`spec/INDEX.md` を生成します。

```bash
spec-tools spec-index [--check]
```
`--check` を指定するとファイルへの書き込みを行わず、現在の `INDEX.md` と差分がないか（最新状態か）のみを検証します（CI 用）。

## `doc-ref index <decision|task>`
`docs/decisions/` や `docs/task/` のファイルを走査し、各パッケージ及びルートに `INDEX.md` を生成します。

```bash
spec-tools doc-ref index decision [--check]
spec-tools doc-ref index task [--check]
```
`--check` 指定時の動作は `spec-index` と同様です。

## `doc-ref check`
プロジェクト全体を対象に、文書内から参照されている decision や task の ID（例: `045` や `@scope/pkg:102`）が正しく実在するかどうかを検証します。

```bash
spec-tools doc-ref check
```

## `doc-ref list <decision|task>`
依存閉包のパッケージを横断し、意思決定（decision）またはタスク（task）の一覧を出力します。

```bash
spec-tools doc-ref list decision [--package <name>]
```

## `doc-ref show <decision|task>`
指定された番号または名前空間付きの参照から文書を検索し、コンソールに出力します。

```bash
spec-tools doc-ref show decision 105
spec-tools doc-ref show task @scope/pkg:200
```

## `scaffold <decision|task|acceptance|phase>`
新しい文書の雛形（テンプレート）を生成します。

- **`scaffold decision <slug> [title]`**: 新規 Architecture Decision Record を作成。
- **`scaffold task <slug> [title]`**: 新規タスク文書を作成。
- **`scaffold acceptance`**: 現在の Phase に基づき、新規の検収証跡（Acceptance Record）を作成。
- **`scaffold phase <v_major_minor_phase>`**: `spec/PHASE` ファイルの内容を更新。

```bash
spec-tools scaffold decision [--package <name>] my-new-feature "新しい機能について"
```
※ `--package` で指定したパッケージ配下に作成することも可能です。

## `check-mirror`
指定された2つのディレクトリ配下で、ファイルが同一の内容で保たれているか（ミラーリング状態）を検証します。

```bash
spec-tools check-mirror
```

## `check-plan-layout` / `check-current-task`
計画書（plan）のレイアウト制約やタスクファイルの書式が正しいかを検査します。
