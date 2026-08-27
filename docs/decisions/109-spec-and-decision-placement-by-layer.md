# 109 spec と decisions の置き場を実装の層へ揃える

**日付**: 2026-08-24
**状態**: 確定
**文脈**: kata2リポジトリ v0.3 Phase 5〜7 の設計判断(`docs/task/061` / `docs/task/018` D11)

> **大元の根拠は `docs/decisions/110`(kata2 リポジトリの位置づけ)である。**
> 「**kata2 = 仕様の正本を持たない、複数 target に対する検証と開発線の記録の場**」という定義が、
> 本 decision の「何を移し、何を残すか」の判定根拠そのものになっている。
> 110 を読まずに本 decision の各決定の線引きを再検討しないこと。

---

## 背景

`docs/task/061` が起票した問題は2つある。

1. **置き場**: spec が中央の `spec/` に集まっており、実装の層と一致していない。
   `docs/task/018` D11 は既に「将来はプロファイルを、その機能を担っているライブラリの
   リポジトリへ配置する」と決めており、`spec/profile-firebase/` は暫定の置き場である。
2. **仕分け**: Phase 4 が `K-TARGET-FCH-UI-003` / `K-TARGET-FBR-UI-016`(入力要素の2段解決)と
   `K-TARGET-FCH-UI-005` / `K-TARGET-FBR-UI-020`(検証メッセージ)という
   **同じ実装(`packages/targetlib-schemaui`)を2つの target 条項が記述する**組を2つ作った。

ユーザーはこれに次を足した(2026-08-24)。

- **kata 自体の spec も core ライブラリへ移す。** kata2 ディレクトリは実装を進めるための
  ディレクトリであって「kata2 を実行するためのライブラリ」ではない。
  kata 自体の spec は、それを前提とした実装を持つ core が保持すべきである。
- **置き場は `<package>/spec/` ではなく `<package>/docs/spec/`。**
- **target の実装判断も target ライブラリの `docs/decisions/` へ。**
  target の実装時に参照する必要があるものは基本的に target ライブラリ側に在るべきで、
  そうしないと **kata2 の仕様は安定しているのに、別の target を開発するために
  kata2 のファイルを動かす必要が生じる**。

## 決定

### 決定1 spec は「それを前提とした実装を持つ package」の `docs/spec/` へ置く

```
packages/core/docs/spec/                        K-CORE-*(107件)+ 条項執筆規約 + VERSION
packages/targetlib-firebase/docs/spec/          K-PROFILE-FB-*(29件)
packages/targetlib-schemaui/docs/spec/          K-PROFILE-SUI-*(新設。決定3)
packages/target-firebase_cloudflare-react/docs/spec/   K-TARGET-FBR-*
packages/target-firebase_cloudflare-html/docs/spec/    K-TARGET-FCH-*
packages/target-inspect/docs/spec/              K-TARGET-INSPECT-*
spec/                                           PHASE / INDEX.md / 開発プロセス規約(決定2)
```

profile を `targetlib-*` に置くのは二重管理の防止である(`docs/task/061` の提案)。
`target-*` にしか置けないと、**実装は `targetlib-*` に在るのに spec は上位の `target-*` が
保持する**形になる。なお D11 の「これはライブラリの spec ではない」は**内容**の規定
(適合面であり、ライブラリを使わず自前実装した target でも適合できる)であって、
**置き場**の規定ではない。同じ D11 が置き場については「ライブラリのリポジトリへ配置する」と言っている。
**置き場と category は独立の軸である。**

### 決定2 根の `spec/` に残すのは PHASE / INDEX.md / 開発プロセス規約だけ。VERSION は core へ

判定基準を「**別リポジトリで開発される target ライブラリが、それを参照する必要があるか**」に置いた。

| | 外部の target ライブラリに要るか | 置き場 |
|---|---|---|
| K-CORE-* 条項 | **要る**(写像元) | `packages/core/docs/spec/` |
| 条項執筆規約(ID 書式・AREA enum・属性行・規範キーワード) | **要る**(適合条項を書くため) | `packages/core/docs/spec/` |
| `VERSION`(spec version) | **要る**(`since:` が指す版) | `packages/core/docs/spec/VERSION` |
| 適合する profile の条項 | **要る** | 当該 `targetlib-*` |
| `PHASE`(現在地) | **要らない** | `spec/PHASE` |
| `INDEX.md`(条項索引) | **要らない** | `spec/INDEX.md` |
| spec:coverage の3つの問い / テスト名規約 / 検証用モデルの定義 | **要らない** | `spec/`(開発プロセス規約) |

`PHASE` は「**その開発線がどこまで実装したか**」であり、kata の仕様ではない。
外部リポジトリは自分の `PHASE` を持つ。`INDEX.md` も「そのリポジトリが持つ条項の索引」であり、
生成物である。3つの問い・テスト名規約は `tools/spec-coverage` に結合した kata2 の開発手順である。

#### 判定基準の言い直し(2026-08-24 ユーザー判断。v0.3 Phase 5 段1 で追記)

**kata2 ディレクトリ以外では意味を持たない判断・記述だけを、kata2 ディレクトリへ置くことができる。**

上の表の基準(「外部の target ライブラリが参照する必要があるか」)と同じ線を引くが、
**既定が逆である**。表の向きは「根に残すのが既定で、要るものだけ出す」と読めてしまう。
言い直した向きは「**出すのが既定で、kata2 でしか意味を持たないものだけ残る**」であり、
`docs/decisions/110` の「kata2 = 仕様の正本を持たない、複数 target に対する検証と
開発線の記録の場」という定義にこちらのほうが直接対応する。**以後はこちらを判定基準とする。**

この基準は spec に限らず **decisions / task / guide にも同じく適用する**(Phase 6〜8)。

**適用し直すと、上の表のうち1行が割れる。**

| 行 | 言い直した基準での判定 |
|---|---|
| `PHASE` の値 / `INDEX.md` / 3つの問い / 現在地の在処 / 検証用モデルの定義 | **根のまま**。いずれも kata2 のディレクトリ構造か `tools/` の振る舞いに結合しており、外では意味を持たない |
| **テスト名規約** | **割れる。** 「条項の実装を検査するテストは先頭に条項 ID を置く」は**外部の target ライブラリが自分の条項を実装するときにも要る規則**であり core へ。一方「先頭 ID が必須になる範囲」(`packages/` と `examples/` に課し `tools/` と `apps/` は対象外)は **kata2 のディレクトリ構造に結合しており根に残る** |

**この再判定は v0.3 Phase 5 段3(`00-conventions.md` の分割)で実行する。**

**帰結: `spec/00-conventions.md` を2つに割る。** 現状このファイルは
(a) ID 体系・AREA・属性行・規範キーワード・`impl` の書式・spec version と
(b) spec:coverage の3つの問い・現在地の在処・テスト名規約・検証用モデルの定義 を混載し、
さらに `K-CORE-ERR-001` 〜 `003` の3条項を持つ。(a) と条項は core へ、(b) は根に残る。

`PHASE` を動かさないことで `docs/decisions/052`(現在地の記述は1箇所に限る)は無傷で残る。
v0.1 の Phase 4 / 8 / 9 で起きた「CI 側だけが弱い判定になる」事故を再演させないため、
現在地の複製は分散後も禁止のままとする。

### 決定3 共有ライブラリの契約は `K-PROFILE-<CODE>` で書く。4つ目のカテゴリを作らない

`targetlib-schemaui` の契約に **CODE `SUI` を割り当て**、`packages/targetlib-schemaui/docs/spec/` へ置く。
D11 の profile の定義「**適合面であり、ライブラリを使わず自前実装した target でも適合できる**」が
schemaui の契約にそのまま当てはまる。中立 UI 導出は**規則であって実装ではない** —
同じ入力から同じ入力要素種別・同じ検証メッセージが出ることを要求しているのであり、
`packages/targetlib-schemaui` を呼ぶことを要求してはいない。

#### 共有ライブラリは schemaui だけではなかった(2026-08-24。v0.3 Phase 5 段5 の仕分けで判明)

本決定の初版は `targetlib-schemaui` の1件だけを見ていた。段5 で
**条項 ID がどの package の `src/` に現れるか**を全 target 条項について調べた結果、
FBR と FCH の両方が依存する共有ライブラリは**4つ**あり、うち3つが条項の置き場を要していた。

| ライブラリ | 契約の置き場 |
|---|---|
| `targetlib-firebase` | **`K-PROFILE-FB-*`(既に在る)。新 CODE は要らない** — FCH は `FBR-CAP-002`/`004`/`005`・`MAP-001`/`004`/`006`・`GEN-001`/`002`/`006` へ規範を委譲している |
| `targetlib-schemaui` | `K-PROFILE-SUI-*`(本決定のとおり新設)。対象は `FBR-UI-016` 段階1 / `FBR-UI-020` 導出規則 / **`FBR-UI-013`**(初版が見落としていた3組目) |
| `targetlib-describe` | **新 CODE を割り当てる**(候補 `DESC`)。core へ寄せる案は `K-CORE-EXP-006` の不変条件「core は人間向け表示文字列テーブルを持たない(必須。C1)」に反するため採れない |
| `targetlib-requirements` | **不要。** `K-TARGET-FBR-UI-014` が自ら「導出の実装場所は定めない」と書いており、条項が課すのは表示の義務である |

仕分け表の全体(移す / 移さない / 欠落)は `docs/plan/0_3/done/phase5.md`「段5 仕分け表」が正本。

**`K-LIB-*` を作らない理由の補足**(`docs/task/061` から移設。2026-08-24)。
`docs/task/018` D11 は「これはライブラリの spec ではない」と書いているが、これは**内容**の規定である。
同じ D11 が**置き場**については「その機能を担っているライブラリのリポジトリへ配置する」と言っている。
**置き場と category は独立の軸**であり、置き場がライブラリへ移ることは
新しい category を要する理由にならない。profile は適合面という**内容**の規定であり、
共有ライブラリの契約はその定義にそのまま当てはまる。

#### 実行の結果(2026-08-24。v0.3 Phase 6)

新設した profile 条項は 14件 —
`K-PROFILE-SUI-UI-001`〜`-004` / `K-PROFILE-DESC-GEN-001` /
`K-PROFILE-FB-CAP-001`〜`-003` / `K-PROFILE-FB-MAP-001`〜`-003` / `K-PROFILE-FB-GEN-001`〜`-003`。
CODE は `SUI` = `targetlib-schemaui` / `DESC` = `targetlib-describe` を
`packages/core/docs/spec/00-conventions.md` へ登録した。**AREA の新設は無い**(spec version 据え置き)。

既存条項21件は**すべて改訂で足りた**(`withdrawn` + 新 ID は0件)。
共有導出を profile へ出し、同じ場所に profile 適合宣言を置く改訂は、
その条項が target に課す義務の総体を変えないためである
(判定規則は `docs/plan/0_3/done/phase6.md`「段1 確定表」)。

**エラーコードの条項 ID も付け替えた。** `targetlib-schemaui` と `targetlib-firebase` /
`targetlib-describe` の登録簿は FBR と FCH の両方が引くため、
片方の target 条項 ID を名乗ると**もう一方の出力が他 target の条項を根拠にする**
(`docs/plan/0_3/done/phase5.md` 表D-3)。ID の再利用ではなく、
エラーコードが指す条項が正しい方へ移っただけである。

これにより Phase 4 が作った2組の重複と、そこに書いた
「FCH と FBR が異なる結果を導くことを禁止する」という cross-target 不変条件の置き場が定まる。
**この不変条件はどちらの target のものでもなく、共有された適合面の契約である。**

### 決定4 decisions の実体も所有ライブラリへ置く。名前空間は `package.json` の `name`

中央の通し番号を維持する案は**採らない**。通し番号は中央の採番器を要求し、
**別の人が、依存関係のない他の target ライブラリに影響されずに開発する**ことを妨げる(ユーザー判断)。
これはフレームワークの将来そのものに関わる。

#### 4-a 名前空間は `package.json` の `name`(ディレクトリ名ではない)

参照書式は **`<package.json の name>:<NNN>`** — 例 `@kata2/targetlib-schemaui:001`。

| | 理由 |
|---|---|
| **コードが既に使っている識別子と同じ**になる | `import … from "@kata2/targetlib-schemaui"` と参照キーが一致する。新しい識別子を発明しない |
| **一意性を、既にそれを保証している仕組みへ委ねられる** | 依存閉包(自分の依存と、その再帰的な依存)の中で `name` が衝突しないことはパッケージマネージャの前提である。**npm レジストリへの問い合わせは不要**で、解決は閉包の走査だけでオフラインに閉じる(ユーザー判断) |
| **publish の有無に依存しない** | `name` は private なパッケージにも在る。実測: `packages/*` 13件はすべて `private: true` / `0.0.0` で未 publish |

ディレクトリ名を採らないのは、**他人が独立に作った Firebase 向け targetlib も
ディレクトリ名は `targetlib-firebase` になりうる**(`docs/task/018` D2-a)ためである。
`name` の改名で参照がずれる弱点は残るが、**それは import 文が全部ずれるのと同じ事象**であり、
同じ手当てで済む。

#### 4-b 実体は所有ライブラリへ出す。kata2 には開発線の記録だけが実体として残る

`docs/decisions/110` の定義から従う。**「kata2 には参照だけを残す」ではない** —
110 が定めた「開発線の記録の場」という役割ゆえに、
**リポジトリ自身の運営に関する判断は実体として kata2 に残る**。
残るのは他 target の契約ではないので、
「依存していない target に開発が左右される」問題は起きない。

| 層 | 実体の置き場 | 例 |
|---|---|---|
| ライブラリの契約に直結する判断 | **所有ライブラリの `docs/decisions/`** | `105` `106` `107` `108`(FCH の生成物の形・中立 UI 導出層)/ `101` `102` / `066`〜`073`(FBR のフォーム挙動) |
| 開発線・リポジトリ運営の判断 | **kata2(実体のまま)** | `052`(現在地は1箇所)/ `076`(skill ミラー)/ `089`(文脈ダイエット)/ `010` / `075` / `077`〜`079` / **本 decision と `110`** |
| **分解できない混成 16件** | **kata2(実体のまま)** | `001` `002` `003` `004` `005` `006` `007` `014` `016` `017` `019` `026` `029` `031` `033` `063` |

3層目が決め手になった。`phase<N>-implementation-choices` 形式の16件は
**1ファイルが core とツールと FBR をまたいで「その Phase で決めたこと全部」を書いた形式**であり、
package へ割るには当時の判断文書を分割する必要がある。それは決定5 に反する。
**これらはライブラリの契約ではなく「kata2 という開発線がいつ何を決めたか」の記録である。**

#### 4-c 移設しても番号は変えない。根には旧参照を解決する stub を残す

- **番号据え置き。** `105` は移設先でも `105`。振り直すと既存参照の全件が翻訳を要し、
  stub が単なるポインタではなく写像表になる
- **新規採番はどの名前空間も `200` から始める**(ユーザー判断 2026-08-24)。
  「引き継いだ最大番号の次」(FCH なら `109`)は名前空間ごとに開始値が違い、
  **なぜその番号から始まるのかが読んで分からない**。`200` なら全名前空間で同じで、
  **`111`〜`199` の空きがそのまま legacy と native の境界になる**。
  `kata2` 自身も名前空間の1つとして `200` から始める(root の `package.json` の `name` は `kata2`)
- **`001`〜`110` は legacy 番号として凍結する。** 移設しても番号は変わらない。
  bare 番号(`docs/decisions/105`)で引けるのはこの範囲だけであり、**追加されない閉じた集合**である。
  `200` 以降の参照は**必ず名前空間を伴う**(`@kata2/targetlib-schemaui:200`)ので、
  bare 番号が曖昧になることはない
- **根の `docs/decisions/<NNN>-<slug>.md` は1行のポインタとして残す**(ユーザーの言う後方互換構造)。
  既存の57ファイルからの参照と、`packages/core/src` / `spec/` からの参照が壊れない
- `pnpm decision:show <参照>` が**依存閉包を走査して**実体を引く。
  `decision:show 105`(legacy 番号)と `decision:show @kata2/targetlib-schemaui:200` の双方を受ける

**実体の移設は v0.3 Phase 7 で行う。** Phase 6(条項の仕分け)が
「どの契約がどのライブラリのものか」を確定させるので、
**その結論を受けてから decisions を割るほうが正確で安い** — 順序を逆にすると同じ判定を2回する。
Phase 5 で入れるのは**規約と機構だけ**(名前空間・`decision:show`・stub の形・
新規の判断は所有ライブラリへ書く規則)。

### 決定5 歴史文書のパスは書き換えない

`docs/acceptance/` / `docs/plan/*/done/` / `docs/history/` は**その時点の事実の証跡**である。
`spec/target-...` と書いてあるのは当時そこに在ったからで、書き換えると証跡が証跡でなくなる。
`check-plan-layout` が実在検査を課しているのは `docs/plan/...` の参照だけなので、
機械検査の上でも問題は生じない。

追随するのは**生きている文書**に限る — `CLAUDE.md` / `AGENTS.md` / `docs/README.md` /
`docs/currentTask.ai.md` / `docs/task/` / `spec/` 本体 / `tools/` / skill 2種のミラー。

### 決定6 根の `docs/spec/` を `docs/source/` へ寄せる

現在 `docs/spec/databaseSchema/` は「v1 からの原資・**読まない**」(`docs/README.md`)である。
`packages/*/docs/spec/` が規範仕様を意味するようになると、**同じ名前が正反対の意味を持つ**。
`docs/source/` は既に「v1 からの原資」の置き場なので、そこへ寄せる(2ファイル、参照4件)。

### 決定7 移すのは target 条項の全部ではない。仕分けが本体である

`docs/task/018` D2 の層の責務がそのまま判定規則になる。

| 層 | 責務 | 条項の例 |
|---|---|---|
| ライブラリ | 共通の生成関数群を提供する。**生成物のファイル構成は決めない** | `K-TARGET-FCH-UI-003` の段階1(schema → 入力要素種別) |
| target コンパイラ | どの関数をどう呼ぶかを決める。**ファイル構成もここが決める** | `K-TARGET-FCH-UI-002`(生成物のファイル構成)/ `UI-003` の段階2(HTML 要素への符号化) |

`UI-002` は正しく target 条項であり、移す対象ではない。
**置き場だけ変えて仕分けをしないと、同じ重複がそのまま残る。**

### 決定8 `docs/guide` と `docs/task` も同じ所有規則に従う(2026-08-24 ユーザー判断)

**「target ライブラリだけを見て分かる」状態にするには、spec と decisions だけでは足りない。**
使い方(guide)と残タスク(task)が kata2 にしか無ければ、
そのライブラリを受け取った人は kata2 を読まないと開発を続けられない。

| 文書 | 所有 | 例 |
|---|---|---|
| **guide** | その機能を提供する package | `model-dsl.md` → `@kata2/define` / `commands/*.md` → `@kata2/cli` / `customization.md` の typed escape 規約 → `@kata2/core`、生成物側の配置 → 各 target |
| **task** | その残件を抱える package | R2 クレデンシャル・生成物 runtime のエラー書式 → 当該 target / 語彙と型の残件 → `@kata2/core` |
| **guide の目次** | kata2 | 全 package を横断する索引。`spec/INDEX.md` と同じ性質 |
| **開発プロセス・横断の task** | kata2(実体のまま) | skill ミラー / spec:coverage / 検証の構え / 本 task 群(`061`〜`063`) |

**plan は kata2 に残る**(ユーザー明示)。着手順と Phase 分割は
`docs/decisions/110` の「開発線の記録」そのものであり、ライブラリの所有物ではない。
したがって `docs/task/README.md` の**一覧表と着手順の表は kata2 に残る** —
個々の task が package へ出ても、**どれを先にやるかは kata2 の判断**である。

#### 追補(2026-08-26。v0.3 Phase 11): **一覧表は package 側の生成物へ移した**

上の「一覧表と着手順の表は kata2 に残る」のうち、**残るのは着手順の表だけである。**
一覧表は `docs/task/README.md` から落とし、**実体を持つ側が生成する `docs/task/INDEX.md`**
(`pnpm task:index`)へ移した。根の索引は kata2 が実体を持つ task だけを載せる。

**理由は決定8 の趣旨そのものである** — 「そのライブラリだけを見て開発が続けられる」ためには、
残件の**一覧**もそのライブラリに要る。手書きで kata2 に置き続けた結果、実測(2026-08-26)で
`@kata2/targetlib-react:200` の行の欠落と `@kata2/target-firebase_cloudflare-html:200` の
状態の食い違いが出ていた。**写しは必ずドリフトする。**

**着手順が kata2 に残る理由は変わらない** — どれを先にやるかは kata2 の判断である。
規約の正本は `spec/00-conventions.md`「kata2 の役割と正本の優先順位」
(`docs/decisions/110` 決定4)。

**`spec/INDEX.md` は中央のままにした。** 条項は `pnpm spec:show <条項ID>` で引けて全文走査が要らず、
かつ**多ルート走査の空振り検査が索引の鮮度に依存している**(D0-1「走査が空振りしたときは失敗する」)。
task には対応する検査が無く、索引が唯一の鮮度の受け皿である。

task の採番と参照は decisions と同じ規則に従う(決定4-a / 4-c)—
名前空間は `package.json` の `name`、legacy(`001`〜`063`)は凍結、native は `200` から、
根に stub、解決は依存閉包の走査。

**`docs/task/README.md` の「ファイルは動かさない。消さない」規則の改訂を伴う。**
同規則の理由は「番号は永続的な識別子で、`docs/decisions/` などが本文中で名指しするため、
移動・削除するとその参照が切れる」ことだった。**stub がその理由を無効化する** —
参照は切れない。**規則の意図(参照を切らない)は保ち、手段(動かさない)を差し替える。**

実測(2026-08-24): task への参照は decisions 35 / acceptance 25 / `docs/plan/0_2/done` 26 ファイルから来ている。
**このうち acceptance と plan/done は歴史文書であり書き換えない**(決定5)ので、stub は必須である。

## 採らなかった選択肢と理由

- **根の `spec/` を廃止し `PHASE` / `INDEX.md` も `docs/` へ移す。**
  見た目は最も整うが、`tools/` 9ファイルすべてと `docs/decisions/052` の文言が追随対象になる。
  外部リポジトリから参照される必要が無いと確認できた以上、動かす理由が無い。
- **`spec/00-conventions.md` を分割せず丸ごと core へ移す。**
  kata2 の開発手順(3つの問い・テスト名規約)が core ライブラリに同梱される。
  core の利用者に意味を持たない文書を core の正本に混ぜることになる。
- **decisions を中央の通し番号のまま package へ分散する。**
  参照が壊れない利点はあるが、採番が中央に残る。独立開発を妨げるので採らない(上記)。
- **decisions の名前空間にディレクトリ名を使う。**
  他人が独立に作った Firebase 向け targetlib もディレクトリ名は `targetlib-firebase` に
  なりうる(`docs/task/018` D2-a)ため、リポジトリをまたぐと一意でない。`package.json` の `name` を採る。
- **decisions の名前空間に「配布名(publish されたときの名前)」を使う。**
  レジストリが一意性を保証する利点はあるが、**publish されないライブラリには存在せず**、
  scope の移管で変わる。`name` なら private でも在り、依存閉包の中で一意である。
- **kata2 には参照だけを残し、実体を1件も置かない。**
  ユーザーの当初案。**`phase<N>-implementation-choices` 形式の16件が package へ割れない**
  (1ファイルが core とツールと FBR をまたぐ)ため、分割すれば決定5 に反する。
  `docs/decisions/110` の「開発線の記録の場」という役割が、これらの実体の置き場になる。
- **package 内の新規採番を「引き継いだ最大番号の次」から始める(本 decision の初版)。**
  legacy と衝突しない点は同じだが、**開始値が package ごとに違い、由来が読んで分からない**。
  `200` 固定なら全名前空間で同じで、`111`〜`199` の空きが境界として目に見える(ユーザー判断)。
- **既存108件を1件も動かさない(本 decision の初版)。**
  移設 cost が高く、新しい target を作る人が読む必要も無い、という理由で一度は採ったが、
  **判定軸が「読者が要るか」ではなく「所有と影響範囲」であることをユーザーが示した** —
  実体が kata2 に在る限り、target を抽出する日にどれが付いてくるかを再度判定することになる。
  知識が新しいうちに割るほうが安い。
- **共有ライブラリ用に `K-LIB-<CODE>` を新設する。**
  ライブラリの契約であることが ID から読めるが、AREA enum の追加と同等以上に重い手続きであり、
  ID 体系が恒久的に増える。profile の定義で足りる。
- **`K-TARGET-FCH-UI-003` / `UI-005` を片方の target に寄せ、他方から参照させる。**
  Phase 4 が実際に採った形であり、061 が問題視している状態そのものである。
  「どちらの target のものでもない」ものを片方に置いた時点で置き場を誤っている。

## 関係する条項 ID

- 改訂: `spec/00-conventions.md` D0-1(置き場規定・分割)。
  条項 `K-CORE-ERR-001` / `002` / `003` は**内容を変えずに** `packages/core/docs/spec/` へ移る
- 新設: `K-PROFILE-SUI-*`(Phase 6)
- 改訂: `K-TARGET-FCH-UI-003` / `UI-005` / `K-TARGET-FBR-UI-016` / `UI-020`(Phase 6 で段階1 を profile へ委譲)
- 移設(ID 据え置き): `K-PROFILE-FB-*` 29件 / `K-TARGET-FBR-*` 49件 / `K-TARGET-FCH-*` 21件 /
  `K-TARGET-INSPECT-*` 1件 / `K-CORE-*` 107件

**ID の欠番・再利用・振り直しは分散後も禁止**である。移設は置き場の変更であって採番の変更ではない。

## 実装中に見つかった別の欠陥

1. **`impl:` が kata2 の plan 版に結合している。** `impl` は「plan 版 + Phase」と定義され、
   現在地 `spec/PHASE` と比較される。外部リポジトリで開発される target ライブラリは
   **自分の plan 版と自分の PHASE** を持つことになり、条項の `impl` が指す先も自分の計画になる。
   kata2 内の package はすべて同じ開発線に居るため今は根の `PHASE` 1つで足りるが、
   **package が外へ出る時点で PHASE も一緒に出る。**
2. **`<CODE>` の一意性が中央登録簿に依存している。** AREA 内連番は分散後も package 内で閉じるが、
   `FBR` / `FCH` / `FB` / `INSPECT` / `SUI` という CODE の割り当ては
   `00-conventions.md` の1箇所が持っている。別の人が独立に target を作れば衝突しうる。

   **解き方は決定4-a と同じである。** 条項 ID は
   `[K-TARGET-FCH-UI-003]` の形でエラーメッセージに出るので、前半を `@kata2/…` にはできない。
   しかし**中央登録簿は捨てられる** — 各 package が自分の spec で自分の CODE を自己申告し、
   **一意性は依存閉包の中で機械検査する**。CODE は短いまま、衝突は必ず検出される。
3. 上記2件は本 Phase の範囲外として `docs/task/062` へ起票する
   (2 の解き方は 062 に案として記録する)。
4. **単一 target で閉じる検証を kata2 が抱えている**(emulator ゲート等)。
   `docs/decisions/110` 限定2 の判定規則で仕分ける対象であり、`docs/task/063` へ起票した。

## 関連

- **`docs/decisions/110`(kata2 の位置づけ。本判断の大元の根拠)**
- `docs/task/061`(本判断の起票元)/ `docs/task/018` D2・D11 / `docs/task/030`(外部リポジトリ境界)
- `docs/task/062`(`impl` と CODE の単一開発線前提)/ `docs/task/063`(単一 target で閉じる検証)
- `docs/decisions/052`(現在地は1箇所)/ `docs/decisions/076`(skill ミラー)/ `docs/decisions/089`(採番の入口)
- `docs/decisions/106` §3(UI の適合プロファイルを作らないとした判断。**決定3 で覆る**)
