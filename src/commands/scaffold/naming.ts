// 採番とファイル名の規則(純関数)。
//
// 番号とファイル名は散文の規則として skill に書かれていたため、読み違えると
// **番号重複や存在しないパスの直書き**が起きていた(v1 で decisions の番号重複、
// v0.2 Phase 12 まで kata2-verify skill が存在しないパスを指していた)。
// 規則をここへ寄せ、コマンドが正しい名前でファイルを作る形にする(docs/decisions/089)。

import { formatImplPoint, type ImplPoint } from '../spec-coverage/implPoint.ts';

const NUMBERED_FILE_RE = /^(\d{3})-[a-z0-9-]+\.md$/;
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * 既存の**最大番号 +1** (ただし最低 200) を返す。ファイル数 +1 は使わない(欠番があると重複する。
 * v1 で番号重複の実績あり)。`docs/decisions/` と `docs/task/` の両方で使う。
 * native は 200 から採番し、legacy(001〜110 / 001〜063)を凍結する(docs/decisions/109 決定4-c)。
 */
export function nextNumber(fileNames: readonly string[], startNumber: number = 200): number {
	let max = 0;
	for (const name of fileNames) {
		const match = name.match(NUMBERED_FILE_RE);
		if (!match?.[1]) {
			continue;
		}
		max = Math.max(max, Number(match[1]));
	}
	return Math.max(startNumber - 1, max) + 1;
}

export function numberedFileName(numberValue: number, slug: string): string {
	return `${String(numberValue).padStart(3, '0')}-${slug}.md`;
}

/** 版ディレクトリ(`docs/plan/0_2`)。`impl` の major/minor がそのまま版である。 */
export function planDirFor(point: ImplPoint): string {
	return `docs/plan/${point.major}_${point.minor}`;
}

/** その Phase の計画の正本(`docs/plan/0_2/phase24.md`)。 */
export function planFileFor(point: ImplPoint): string {
	return `${planDirFor(point)}/phase${point.phase}.md`;
}

/** 検収証跡(`docs/acceptance/phase-v0_2-24.md`)。 */
export function acceptanceFileFor(point: ImplPoint): string {
	const version = formatImplPoint(point).replace(/_\d+$/, '');
	return `docs/acceptance/phase-${version}-${point.phase}.md`;
}

export function decisionTemplate(numberValue: number, title: string, today: string): string {
	return `# ${String(numberValue).padStart(3, '0')} ${title}

**日付**: ${today}
**状態**: 確定
**文脈**: 

---

## 背景

どの不具合・要求・条項から始まったか。

## 決定

何を決めたか。**条項が正本**なので、ここには「なぜその条項にしたか」を書く。

## 採らなかった選択肢と理由

後で「なぜこうなっていないのか」を問われる部分。

## 関係する条項 ID

新設・変更・withdrawn にした条項の一覧(無ければ「無し」と書く)。

## 実装中に見つかった別の欠陥

本筋でなくても書く。起票したなら \`docs/task/\` の番号を添える。
`;
}

export function acceptanceTemplate(point: ImplPoint, today: string): string {
	const label = `v${point.major}.${point.minor} Phase ${point.phase}`;
	return `# ${label} 検収証跡

**日時**: ${today}
**正本**: \`${planFileFor(point)}\`
**判断**: 

---

## 完了判定の照合

| # | 完了判定 | 結果 | 証跡 / 補足 |
|---|---|---|---|
| 1 |  |  |  |

## 品質ゲート

\`\`\`
pnpm verify --gate
\`\`\`

(出力の要約を貼る。**「配備した」を実測の証跡にしない**)

## 未実施(意図的)

後続 Phase へ送ったもの。**Phase に載せずに送ったものは \`docs/task/\` へ起票する**。

---

- [ ] ユーザー承認
`;
}

export function taskTemplate(numberValue: number, title: string, today: string): string {
	return `# ${String(numberValue).padStart(3, '0')} ${title}

**起票**: ${today}
**関係**: 

## 何が問題か

## どうするか(案)

## 前提・ブロッカー

着手できる Phase が別の作業に従属しているなら、それを書く。無ければ「無し」。
`;
}
