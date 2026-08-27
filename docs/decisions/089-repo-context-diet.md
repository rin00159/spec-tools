# 089 散文の手順を機械が持つ形へ移す(リポジトリの情報管理最適化)

**日付**: 2026-08-19
**状態**: 確定
**文脈**: kata2リポジトリ v0.2 Phase 25(正本 `docs/plan/0_2/done/phase25.md`)。**`spec/` の条項は1つも動かしていない**

---

## 0. なぜ Phase として採番したか

`docs/decisions/083` / `087` と同じく条項は動かないが、**新しいツールと運用規則を7つ足し、
文書の置き場を変えた**。後から「なぜこの形か」を引けるようにするには Phase 番号と検収証跡が要る。
条項が動かない Phase であることは `spec/PHASE` を `v0_2_25` に進めても未実装条項が0件のままである
ことで確かめられる。

## 1. 背景 — 何が壊れていたか

**AI の読み込み負荷。** Phase 着手時に読む標準セットの実測(着手前)。

| 対象 | サイズ | 概算トークン |
|---|---|---|
| `spec/10-core-model.md` | 141KB | 約 56k |
| `docs/plan/0_2/plan.md` | 77KB | 約 30k |
| `docs/currentTask.ai.md` | 76KB(529行) | 約 30k |
| `.claude/skills/kata2-verify/SKILL.md` | 9.6KB(172行) | 約 4k |

条項を1つ確かめるだけで 141KB のファイルを開く構造であり、Phase 文書を読む前に 120k〜150k が埋まる。

**散文の手順を AI がコマンドへ合成していた。** `kata2-verify` skill の §5 / §6 は `examples/*` を
走査する bash ループ(`node -p` によるエントリ解決を含む)を毎回組ませていた。
`docs/decisions/` の採番、`docs/acceptance/` の命名、`spec/PHASE` の更新も散文の規則だった。

**その結果、実際にゲートが空振りしていた。** `docs/decisions/087` ③ —
`fieldBuilders.test.ts` が `72d77f9` の時点で赤だった(存在しない API を呼んでいた)。
**`kata2-verify` のゲートが実際には通っていなかった。**

## 2. 決定

**散文で書かれた手順・注意を、実行可能なコマンドと機械検査へ移す。**
skill と `CLAUDE.md` に残す散文は「なぜ」だけにし、「どうやって」はツールが持つ。

具体的には次の3つを分けた。

| 種類 | 置き場 | 例 |
|---|---|---|
| **手順** | ツール(`tools/*`)| 走査対象・順序・再現コマンド・失敗時の次の一手 |
| **不変条件** | `pnpm lint` の check | 上限行数・正本の一意性・ミラーのバイト一致・索引の鮮度 |
| **理由** | skill / decisions / `docs/history/` | なぜその形か、過去に何が起きたか |

### 2.1 検証は `pnpm verify` 1本

- 実行範囲は `--quick` / 既定 / `--gate`。**既定が完全形**である(絞り込む側を明示指定にした)。
- **成功時は1ステップ1行**、失敗時は「出力末尾40行 + 再現コマンド + 次の一手」だけを出す。
  検証のたびに数千行が AI の文脈へ流れ込むのを止めることが、このツールの主目的である。
- ステップ定義は `tools/verify/src/steps.ts` にデータとして持つ。
  **Phase が進んで検証項目が増えたときに直すのはここであり、skill ではない。**

### 2.2 条項は `pnpm spec:show` で引く

`spec/10-core-model.md` は**分割しない**。条項 ID の安定と既存参照・`spec-coverage` のパス前提を
保つほうが、ファイルを割る利益より大きい。代わりに引く手段を足した — `spec/INDEX.md`(生成物)と
`pnpm spec:show <条項ID>`。パーサは `tools/spec-coverage/src/specClauses.ts` を再利用し、
`line` と `title` を足しただけである(**2つ目のパーサを作らない**)。

### 2.3 採番と命名はコマンドが決める

`pnpm decision:new` / `task:new` / `acceptance:new` / `phase:set`。
番号は**既存の最大番号 +1**(ファイル数 +1 は欠番があると重複する。v1 で実績あり)。
**この作業中に実際に `docs/task/053` を人が数えて重複させた** — その場で `task:new` を足した。

### 2.4 現在地カードは 80行

`docs/currentTask.ai.md` は放っておくと必ず肥大する(529行 / 76KB まで育っていた)。
内容の大半は `docs/acceptance/` と重複した経緯だった。上限と必須見出しを `check:current-task` で
機械検査し、経緯は `docs/history/currentTask-0_2.md` へ移した。

### 2.5 Phase の正本は `phase<N>.md` ただ1つ

`phase<N>edit.md`(正本)と `phase<N>.md`(起点メモ)の二重化は、**読む側に毎回「どちらが正本か」を
判断させていた**。正本を `phase<N>.md` に統一し、起点メモは `origin/`、検収証跡のある Phase は
`done/` へ移した。`check:plan-layout` が `*edit.md` の不在と **`docs/plan/...` 参照の実在**を検査する。

**この検査は導入直後に既存の壊れた参照を22件見つけた**(`phaseWW10.md` などの旧名が
acceptance / decisions / plan の各所に残っていた)。すべて現在地へ直した。

### 2.6 `AGENTS.md` は `CLAUDE.md` とバイト一致の日本語

英訳を手で同期する運用は**成立していなかった** — `AGENTS.md` の core の依存記述は
「No dependencies except TS standard library」のままで、`@sinclair/typebox` を許した後の事実と違っていた。
skill ミラーと同じ扱いにし、`check-mirror` がルートのファイル対も検査する。

## 3. 採らなかった選択肢

- **`spec/10-core-model.md` を DEF / MODEL / TYPE へ分割する。** 索引と `spec:show` で読み込み量の
  問題は解けるのに、多数の既存参照と `spec-coverage` のパス前提を洗う必要が出る。割に合わない。
- **hook で `pnpm verify` を自動起動する。** 完全形は1分以上かかり、反復を阻害する。
- **`pnpm verify` の既定を `--quick` にする。** 速いほうを既定にすると、
  「1コマンドで検証が終わった」と誤解したまま決定論と生成物の検査を飛ばせてしまう。
  **既定は完全形**にし、絞るときだけ明示させる。
- **`vitest --changed` を quick に使う。** 変更が無いと0件で成功し、**偽の緑**になる。
  このリポジトリが繰り返し踏んできた silent skip と同型なので採らない。
- **版 plan の状態表の圧縮**(30k トークン)。証跡に無い情報がどれかを1件ずつ確かめる必要があり、
  機械的にできない。`docs/task/054` へ起票した。

## 4. 関係する条項 ID

**無し。** 条項は新設・変更・廃止いずれもしていない。

## 5. 実装中に見つかった別の欠陥

1. **`docs/plan/...` を指す壊れた参照が22件**(§2.5)。旧ファイル名のまま各所に残っていた。
2. **`docs/task` の番号を人が数えて重複させた**(§2.3)。その場で `task:new` を足した。
3. `AGENTS.md` の依存記述が事実と違っていた(§2.6)。
4. `spec/INDEX.md` の生成でファイルパスを絶対パスにすると、**他人の環境で必ず `check:spec-index` が
   落ちる**。リポジトリ相対に直した。生成物の再現性は環境非依存であることを含む。
5. **`KATA_REQUIRE_EMULATOR` を人が手で渡す形が事故を生む。** 検収のつもりで
   `KATA_REQUIRE_EMULATOR=1 pnpm verify --gate` と打つと、emulator を起動していない**hermetic な
   test ステップまで**「環境変数が無い」と言って落ちた。この印は emulator ステップにだけ立てるべきもので、
   **ツールが立てる**のが正しい。runner は非 emulator ステップからこの変数を取り除く
   (環境に残っていても巻き込まない)。**利用者が渡すべき環境変数を1つも持たない**のが `pnpm verify` の形である。
6. **テストの失敗詳細が warning に押し出されていた。** 生成系テストが子プロセスの stderr へ吐く
   `[divergence]` が末尾40行を埋めていた。`--silent=passed-only` に加え、ステップが
   「読むべき箇所の目印」(`focus`)を持てるようにし、`Failed Tests` の行から先を出すようにした。
