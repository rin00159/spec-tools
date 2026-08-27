// markdown 文書中の decisions / task 参照の走査と実在検証。
// 正本は docs/decisions/109 決定4・決定8 / kata2:200 / docs/plan/0_3/phase7.md 完了判定5。
//
// docs/decisions/<NNN> 形式・docs/task/<NNN> 形式および <name>:<NNN> 形式
// (@kata2/core:200, kata2:200 等)の参照を走査し、実体または stub が実在することを機械検査する。
// 空振り防止のため、走査対象が0件または参照が0件の場合は throw する。

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { discoverPackages, type PackageEntry } from './closure.ts';
import { resolveDocRef } from './show.ts';

export const SCAN_ROOTS = ['docs', 'spec', 'packages', '.claude', '.agents'] as const;
export const ROOT_FILES = ['CLAUDE.md', 'AGENTS.md'] as const;

export const HISTORICAL_PREFIXES = [
	'docs/acceptance/',
	'docs/plan/0_1/done/',
	'docs/plan/0_2/done/',
	'docs/plan/0_2/origin/',
	'docs/plan/0_3/done/',
	'docs/history/',
] as const;

export interface ExtractedRef {
	readonly raw: string;
	readonly type: 'decision' | 'task' | 'namespaced';
	readonly ref: string;
	readonly line: number;
}

/** 例示や文法説明のパターン(実在検査の対象外) */
function isExampleLine(line: string, examplePatterns?: readonly RegExp[]): boolean {
	if (examplePatterns) {
		return examplePatterns.some((re) => re.test(line));
	}
	return false;
}

export function extractDocRefs(
	text: string,
	decisionDir: string,
	taskDir: string,
	namespacePattern: string,
	examplePatterns?: readonly RegExp[],
): ExtractedRef[] {
	const results: ExtractedRef[] = [];
	const seen = new Set<string>();
	const lines = text.split('\n');

	const decisionBase = decisionDir.split('/').pop() || 'decisions';
	const taskBase = taskDir.split('/').pop() || 'task';
	const decisionEscaped = decisionDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const taskEscaped = taskDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

	const decisionPathRe = new RegExp(
		`(?:^|[^\\w./-])(?:(?:[\\w-]+\\/)*?${decisionBase}\\/|${decisionEscaped}\\/)(\\d{3})(?:-[a-z0-9_-]+(?:\\.md)?)?(?=$|[^\\w./-])`,
		'g',
	);
	const taskPathRe = new RegExp(
		`(?:^|[^\\w./-])(?:(?:[\\w-]+\\/)*?${taskBase}\\/|${taskEscaped}\\/)(\\d{3})(?:-[a-z0-9_-]+(?:\\.md)?)?(?=$|[^\\w./-])`,
		'g',
	);
	const namespacedRefRe = new RegExp(
		`(?:^|[^\\w./-])${namespacePattern}:(\\d{3})(?=$|[^\\w./-])`,
		'g',
	);

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		if (line === undefined || isExampleLine(line, examplePatterns)) {
			continue;
		}
		const lineNo = i + 1;

		for (const match of line.matchAll(decisionPathRe)) {
			const num = match[1];
			if (!num) continue;
			const key = `decision:${num}`;
			if (!seen.has(key)) {
				seen.add(key);
				results.push({
					raw: match[0].trim(),
					type: 'decision',
					ref: num,
					line: lineNo,
				});
			}
		}

		for (const match of line.matchAll(taskPathRe)) {
			const num = match[1];
			if (!num) continue;
			const key = `task:${num}`;
			if (!seen.has(key)) {
				seen.add(key);
				results.push({
					raw: match[0].trim(),
					type: 'task',
					ref: num,
					line: lineNo,
				});
			}
		}

		for (const match of line.matchAll(namespacedRefRe)) {
			const pkgName = match[1];
			const numStr = match[2];
			if (!pkgName || !numStr) continue;
			const namespaced = `${pkgName}:${numStr}`;
			const key = `namespaced:${namespaced}`;
			if (!seen.has(key)) {
				seen.add(key);
				results.push({
					raw: match[0].trim(),
					type: 'namespaced',
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
		} else if (entry.isFile() && entry.name.endsWith('.md')) {
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
		readonly decisionDir?: string;
		readonly taskDir?: string;
		readonly namespacePattern?: string;
		readonly historicalPrefixes?: readonly string[];
		readonly examplePatterns?: readonly string[];
	},
): Promise<ValidationResult> {
	const scanRoots = options?.scanRoots ?? SCAN_ROOTS;
	const rootFiles = options?.rootFiles ?? ROOT_FILES;
	const pkgs = options?.packages ?? (await discoverPackages(repoRoot));
	const decisionDir = options?.decisionDir ?? 'docs/decisions';
	const taskDir = options?.taskDir ?? 'docs/task';
	const namespacePattern = options?.namespacePattern ?? '(@kata2\\/[a-z0-9_-]+|kata2)';
	const historicalPrefixes = options?.historicalPrefixes ?? HISTORICAL_PREFIXES;
	const exampleRegexes = options?.examplePatterns?.map((p) => new RegExp(p)) ?? [];

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
		throw new Error('No markdown files found to scan.');
	}

	let totalRefs = 0;
	const violations: string[] = [];

	let rootDecisionsFiles: string[] = [];
	try {
		rootDecisionsFiles = readdirSync(join(repoRoot, decisionDir));
	} catch {
		// docs/decisions が存在しない場合
	}

	let rootTaskFiles: string[] = [];
	try {
		rootTaskFiles = readdirSync(join(repoRoot, taskDir));
	} catch {
		// docs/task が存在しない場合
	}

	for (const filePath of markdownFiles) {
		const relFile = relative(repoRoot, filePath);
		if (historicalPrefixes.some((prefix) => relFile.startsWith(prefix))) {
			continue;
		}

		const text = readFileSync(filePath, 'utf8');
		const refs = extractDocRefs(text, decisionDir, taskDir, namespacePattern, exampleRegexes);
		totalRefs += refs.length;

		for (const refItem of refs) {
			if (refItem.type === 'decision' || refItem.type === 'task') {
				const numStr = refItem.ref;
				const subDir = refItem.type === 'decision' ? decisionDir : taskDir;
				const rootFilesForType = refItem.type === 'decision' ? rootDecisionsFiles : rootTaskFiles;
				// 実体でも stub でもよい。根に <NNN>- で始まる md が在れば参照は切れていない。
				const found = rootFilesForType.some((f) => f.startsWith(`${numStr}-`) && f.endsWith('.md'));
				if (!found) {
					violations.push(
						`${relFile}:${refItem.line}: Missing ${refItem.type} reference ${subDir}/${numStr}`,
					);
				}
			} else {
				// namespaced ref (<name>:<NNN>)
				let resolved = false;
				let lastErr: unknown;
				try {
					await resolveDocRef(repoRoot, 'decision', refItem.ref, pkgs, decisionDir, taskDir);
					resolved = true;
				} catch (err) {
					lastErr = err;
				}
				if (!resolved) {
					try {
						await resolveDocRef(repoRoot, 'task', refItem.ref, pkgs, decisionDir, taskDir);
						resolved = true;
					} catch (err) {
						lastErr = err;
					}
				}
				if (!resolved) {
					violations.push(
						`${relFile}:${refItem.line}: Missing namespaced reference ${refItem.ref} (${lastErr instanceof Error ? lastErr.message : String(lastErr)})`,
					);
				}
			}
		}
	}

	if (totalRefs === 0) {
		throw new Error('No references found to validate.');
	}

	return {
		totalFiles: markdownFiles.length,
		totalRefs,
		violations,
	};
}
