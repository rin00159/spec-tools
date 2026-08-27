// markdown 文書中の decisions / task 参照の走査と実在検証。
// 正本は docs/decisions/109 決定4・決定8 / kata2:200 / docs/plan/0_3/phase7.md 完了判定5。
//
// docs/decisions/<NNN> 形式・docs/task/<NNN> 形式および <name>:<NNN> 形式
// (@kata2/core:200, kata2:200 等)の参照を走査し、実体または stub が実在することを機械検査する。
// 空振り防止のため、走査対象が0件または参照が0件の場合は throw する。

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { discoverPackages, type PackageEntry } from "./closure.ts";
import { resolveDocRef } from "./show.ts";

export const SCAN_ROOTS = [
	"docs",
	"spec",
	"packages",
	".claude",
	".agents",
] as const;
export const ROOT_FILES = ["CLAUDE.md", "AGENTS.md"] as const;

export const HISTORICAL_PREFIXES = [
	"docs/acceptance/",
	"docs/plan/0_1/done/",
	"docs/plan/0_2/done/",
	"docs/plan/0_2/origin/",
	"docs/plan/0_3/done/",
	"docs/history/",
] as const;

export interface ExtractedRef {
	readonly raw: string;
	readonly type: "decision" | "task" | "namespaced";
	readonly ref: string;
	readonly line: number;
}

const DECISION_PATH_RE =
	/(?:^|[^\w./-])(?:docs\/)?decisions\/(\d{3})(?:-[a-z0-9-]+(?:\.md)?)?(?=$|[^\w./-])/g;
const TASK_PATH_RE =
	/(?:^|[^\w./-])(?:docs\/)?task\/(\d{3})(?:-[a-z0-9-]+(?:\.md)?)?(?=$|[^\w./-])/g;
const NAMESPACED_REF_RE =
	/(?:^|[^\w./-])(@kata2\/[a-z0-9_-]+|kata2):(\d{3})(?=$|[^\w./-])/g;

/** 例示や文法説明のパターン(実在検査の対象外) */
function isExampleLine(line: string): boolean {
	return (
		/(?:例|例:|e\.g\.|Example|使い方:)\s*[`(]?@kata2\//.test(line) ||
		/`decision:show @kata2\//.test(line) ||
		/`task:show @kata2\//.test(line) ||
		/\(`?@kata2\/targetlib-schemaui:200`?\)/.test(line)
	);
}

/**
 * markdown テキストから decision / task / namespaced の参照を抽出する(重複は行単位で畳む)。
 */
export function extractDocRefs(text: string): ExtractedRef[] {
	const results: ExtractedRef[] = [];
	const seen = new Set<string>();
	const lines = text.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined || isExampleLine(line)) {
			continue;
		}
		const lineNo = i + 1;

		for (const match of line.matchAll(DECISION_PATH_RE)) {
			const num = match[1];
			if (!num) continue;
			const key = `decision:${num}`;
			if (!seen.has(key)) {
				seen.add(key);
				results.push({
					raw: match[0].trim(),
					type: "decision",
					ref: num,
					line: lineNo,
				});
			}
		}

		for (const match of line.matchAll(TASK_PATH_RE)) {
			const num = match[1];
			if (!num) continue;
			const key = `task:${num}`;
			if (!seen.has(key)) {
				seen.add(key);
				results.push({
					raw: match[0].trim(),
					type: "task",
					ref: num,
					line: lineNo,
				});
			}
		}

		for (const match of line.matchAll(NAMESPACED_REF_RE)) {
			const pkgName = match[1];
			const numStr = match[2];
			if (!pkgName || !numStr) continue;
			const namespaced = `${pkgName}:${numStr}`;
			const key = `namespaced:${namespaced}`;
			if (!seen.has(key)) {
				seen.add(key);
				results.push({
					raw: match[0].trim(),
					type: "namespaced",
					ref: namespaced,
					line: lineNo,
				});
			}
		}
	}

	return results;
}

export function walkMarkdownFiles(dir: string): string[] {
	try {
		const s = statSync(dir);
		if (!s.isDirectory()) return [];
	} catch {
		return [];
	}

	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...walkMarkdownFiles(fullPath));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			files.push(fullPath);
		}
	}
	return files;
}

export interface ValidationResult {
	readonly totalFiles: number;
	readonly totalRefs: number;
	readonly violations: readonly string[];
}

export async function validateDocRefsInRepo(
	repoRoot: string,
	options?: {
		readonly scanRoots?: readonly string[];
		readonly rootFiles?: readonly string[];
		readonly packages?: ReadonlyArray<PackageEntry>;
	},
): Promise<ValidationResult> {
	const scanRoots = options?.scanRoots ?? SCAN_ROOTS;
	const rootFiles = options?.rootFiles ?? ROOT_FILES;
	const pkgs = options?.packages ?? (await discoverPackages(repoRoot));

	const markdownFiles: string[] = [
		...scanRoots.flatMap((root) => walkMarkdownFiles(join(repoRoot, root))),
		...rootFiles
			.map((file) => join(repoRoot, file))
			.filter((file) => {
				try {
					return statSync(file).isFile();
				} catch {
					return false;
				}
			}),
	];

	if (markdownFiles.length === 0) {
		throw new Error("走査対象の markdown ファイルが0件です(空振り防止)");
	}

	let totalRefs = 0;
	const violations: string[] = [];

	let rootDecisionsFiles: string[] = [];
	try {
		rootDecisionsFiles = readdirSync(join(repoRoot, "docs", "decisions"));
	} catch {
		// docs/decisions が存在しない場合
	}

	let rootTaskFiles: string[] = [];
	try {
		rootTaskFiles = readdirSync(join(repoRoot, "docs", "task"));
	} catch {
		// docs/task が存在しない場合
	}

	for (const filePath of markdownFiles) {
		const relFile = relative(repoRoot, filePath);
		if (HISTORICAL_PREFIXES.some((prefix) => relFile.startsWith(prefix))) {
			continue;
		}

		const text = readFileSync(filePath, "utf8");
		const refs = extractDocRefs(text);
		totalRefs += refs.length;

		for (const refItem of refs) {
			if (refItem.type === "decision" || refItem.type === "task") {
				const numStr = refItem.ref;
				const subDir = refItem.type === "decision" ? "decisions" : "task";
				const rootFilesForType =
					refItem.type === "decision" ? rootDecisionsFiles : rootTaskFiles;
				// 実体でも stub でもよい。根に <NNN>- で始まる md が在れば参照は切れていない。
				const found = rootFilesForType.some(
					(f) => f.startsWith(`${numStr}-`) && f.endsWith(".md"),
				);
				if (!found) {
					violations.push(
						`${relFile}:${refItem.line}: 存在しない ${refItem.type} 参照 docs/${subDir}/${numStr}`,
					);
				}
			} else {
				// namespaced ref (<name>:<NNN>)
				let resolved = false;
				let lastErr: unknown;
				try {
					await resolveDocRef(repoRoot, "decision", refItem.ref, pkgs);
					resolved = true;
				} catch (err) {
					lastErr = err;
				}
				if (!resolved) {
					try {
						await resolveDocRef(repoRoot, "task", refItem.ref, pkgs);
						resolved = true;
					} catch (err) {
						lastErr = err;
					}
				}
				if (!resolved) {
					violations.push(
						`${relFile}:${refItem.line}: 存在しない名前空間付き参照 ${refItem.ref} (${lastErr instanceof Error ? lastErr.message : String(lastErr)})`,
					);
				}
			}
		}
	}

	if (totalRefs === 0) {
		throw new Error("走査された参照が0件です(空振り防止)");
	}

	return {
		totalFiles: markdownFiles.length,
		totalRefs,
		violations,
	};
}
