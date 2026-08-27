// 条項本文の切り出しと索引の組み立て(純関数)。
//
// packages/core/docs/spec/10-core-model.md は単体で 141KB あり、条項を1つ確かめるためにファイルを開くと
// それだけで文脈が埋まる。`spec:show` で必要な条項だけを引けるようにするための土台である
// (v0.2 Phase 25 / docs/decisions/089)。

import { formatImplPoint } from "../spec-coverage/implPoint.ts";
import type { ClauseInfo } from "../spec-coverage/specClauses.ts";

/** 条項見出し(`## K-...`)から次の `## ` 見出しの直前までを本文とする。`### ` は本文に含む。 */
export function extractClauseBody(
	lines: readonly string[],
	headingLine: number,
): string {
	const start = headingLine - 1;
	let end = lines.length;
	for (let i = start + 1; i < lines.length; i++) {
		if (lines[i]?.startsWith("## ")) {
			end = i;
			break;
		}
	}
	return lines.slice(start, end).join("\n").replace(/\s+$/, "");
}

/** ID の綴り間違いを拾うための近傍候補(同じ AREA を優先し、次に前方一致)。 */
export function suggestIds(
	unknownId: string,
	knownIds: readonly string[],
	limit = 5,
): string[] {
	const area = unknownId.split("-").slice(0, 3).join("-");
	const sameArea = knownIds.filter((id) => id.startsWith(`${area}-`));
	if (sameArea.length > 0) {
		return sameArea.slice(0, limit);
	}
	const prefix = unknownId.split("-").slice(0, 2).join("-");
	return knownIds.filter((id) => id.startsWith(`${prefix}-`)).slice(0, limit);
}

const HEADER = [
	"# spec 索引(自動生成)",
	"",
	"**このファイルは `spec-tools spec-index` の生成物である。手で編集しない**",
	"内容が古いと `check-spec-index` が落ちる。",
	"",
	"条項本文は **`spec-tools spec-show <条項ID>`** で引く。spec のファイルを全文読まないこと。",
	"",
] as const;

/** 索引の本文を組み立てる。ファイルごとに分け、条項は出現順のまま並べる。 */
export function renderIndex(clauses: readonly ClauseInfo[]): string {
	const byFile = new Map<string, ClauseInfo[]>();
	for (const clause of clauses) {
		const list = byFile.get(clause.file);
		if (list) {
			list.push(clause);
		} else {
			byFile.set(clause.file, [clause]);
		}
	}

	const sections: string[] = [];
	for (const file of [...byFile.keys()].sort()) {
		const list = (byFile.get(file) ?? [])
			.slice()
			.sort((a, b) => a.line - b.line);
		sections.push(`## ${file}(${list.length}件)`);
		sections.push("");
		sections.push("| 条項 ID | 見出し | status | since | impl | 行 |");
		sections.push("|---|---|---|---|---|---|");
		for (const clause of list) {
			sections.push(
				`| \`${clause.id}\` | ${clause.title} | ${clause.status} | ${clause.since} | ${formatImplPoint(clause.impl)} | ${clause.line} |`,
			);
		}
		sections.push("");
	}

	const total = clauses.length;
	const withdrawn = clauses.filter((c) => c.status === "withdrawn").length;
	return [
		...HEADER,
		`条項 ${total}件(うち withdrawn ${withdrawn}件)。`,
		"",
		...sections,
	].join("\n");
}
