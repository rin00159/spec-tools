// task 索引(docs/task/INDEX.md)の生成と鮮度検査。
// 正本は spec/00-conventions.md「kata2 の役割と正本の優先順位」/ docs/decisions/110 決定4:
// **一覧・索引は、実体を持つ側で生成する(必須)。**
//
//   pnpm task:index          # 根と各 package の docs/task/INDEX.md を生成(または更新)
//   pnpm check:task-index    # 生成物が現状と食い違っていたら失敗する(pnpm lint の一部)
//
// 生成物と手書きを同一ファイルに混ぜない(C2)ので、README.md は生成しない —
// 規約本文と着手順の表は手書きのまま docs/task/README.md に残る。

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, relative, resolve } from "node:path";
import { discoverPackages, type PackageEntry } from "./closure.ts";
import { collectDocs, type DocEntry } from "./list.ts";
import type { DocType } from "./show.ts";


/** 表のセルを壊す文字だけを逃がす(本文は task 側が正本なので加工しない)。 */
function cell(text: string): string {
	return text.replace(/\|/g, "\\|");
}

export function renderIndex(
	pkg: PackageEntry,
	docType: DocType,
	entries: readonly DocEntry[],
): string {
	const sorted = [...entries].sort((a, b) => a.number.localeCompare(b.number));
	const lines = [
		`# ${docType} 索引 — ${pkg.name}(${sorted.length}件)`,
		"",
		`**このファイルは \`pnpm ${docType}:index\` の生成物である。手で編集しない**`,
		"(生成と手書きを同一ファイルに混ぜない — 設計制約 C2)。",
		`内容が古いと \`pnpm lint\`(\`check:${docType}-index\`)が落ちる。`,
		"",
		`本文は **\`pnpm ${docType}:show <参照>\`** で引く。`,
		`依存関係を横断して見るのは **\`pnpm ${docType}:list\`**(依存閉包の走査)。`,
		"",
	];
	if (docType === "task") {
		lines.push(
			"着手順の判断は kata2 の `docs/task/README.md` が持つ",
			"(`docs/decisions/109` 決定8 / `spec/00-conventions.md`「kata2 の役割と正本の優先順位」)。",
			"",
		);
	}
	lines.push("| 参照 | タイトル | 状態 | ファイル |", "|---|---|---|---|");
	for (const e of sorted) {
		const file = basename(e.filePath);
		lines.push(
			`| \`${e.reference}\` | ${cell(e.title)} | ${cell(e.state)} | [${file}](${file}) |`,
		);
	}
	lines.push("");
	return lines.join("\n");
}

export interface IndexPlan {
	/** 書き出す索引。内容が既存と同じでも入る。 */
	readonly writes: ReadonlyArray<{ path: string; content: string }>;
	/** 実体が0件になったので消す索引。 */
	readonly removals: readonly string[];
}

export function planIndexes(
	repoRoot: string,
	docType: DocType,
	packages: readonly PackageEntry[],
): IndexPlan {
	const subDir = docType === "decision" ? "decisions" : "task";
	const writes: Array<{ path: string; content: string }> = [];
	const removals: string[] = [];

	for (const pkg of packages) {
		const dir = join(pkg.dir, "docs", subDir);
		if (!existsSync(dir)) {
			continue;
		}
		const indexPath = join(dir, "INDEX.md");
		const entries = collectDocs(repoRoot, docType, [pkg]);
		// 実体が0件(stub だけ / 空)の package に索引は置かない。
		if (entries.length === 0) {
			if (existsSync(indexPath)) {
				removals.push(indexPath);
			}
			continue;
		}
		writes.push({
			path: indexPath,
			content: renderIndex(pkg, docType, entries),
		});
	}

	return { writes, removals };
}

export async function runIndexGen(repoRoot: string, docType: string | undefined, checkOnly: boolean): Promise<void> {
	if (docType !== "decision" && docType !== "task") {
		console.error("Usage: spec-tools doc-ref index <decision|task> [--check]");
		process.exitCode = 2;
		return;
	}

	const packages = await discoverPackages(repoRoot);
	const { writes, removals } = planIndexes(repoRoot, docType, packages);

	if (writes.length === 0) {
		console.error(
			`${docType}:index: No targets found. Are there docs/${docType === "decision" ? "decisions" : "task"}/ directories?`,
		);
		process.exitCode = 1;
		return;
	}

	const stale: string[] = [];
	for (const w of writes) {
		const current = existsSync(w.path) ? readFileSync(w.path, "utf8") : null;
		if (current === w.content) {
			continue;
		}
		stale.push(relative(repoRoot, w.path));
		if (!checkOnly) {
			writeFileSync(w.path, w.content, "utf8");
		}
	}
	for (const path of removals) {
		stale.push(`${relative(repoRoot, path)}(Empty. Removed.)`);
		if (!checkOnly) {
			rmSync(path);
		}
	}

	if (checkOnly) {
		if (stale.length > 0) {
			console.error(
				`check-${docType}-index: Index is out of date. Run \`spec-tools doc-ref index ${docType}\` to update.`,
			);
			for (const s of stale) {
				console.error(`  - ${s}`);
			}
			process.exitCode = 1;
			return;
		}
		console.log(`check-${docType}-index: Up to date (Indexes: ${writes.length})`);
		return;
	}

	console.log(
		`${docType}:index: Total indexes: ${writes.length} (Updated: ${stale.length})`,
	);
	for (const s of stale) {
		console.log(`  - ${s}`);
	}
}
