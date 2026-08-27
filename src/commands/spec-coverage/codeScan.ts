// packages/ / tools/ / examples/ 配下のソースファイルを走査し、
// コード・コメント・エラーメッセージ中の条項 ID 参照を検出する(docs/task/059)。
// 実在しない条項 ID は未知の参照として報告し、`TODO(K-...)` 記法で明示されたものは猶予として扱う。

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CLAUSE_ID_PATTERN } from './specClauses.ts';

export interface CodeClauseRef {
	readonly file: string;
	readonly line: number;
	readonly id: string;
}

export interface CodeScanResult {
	readonly knownRefs: readonly CodeClauseRef[];
	readonly unknownRefs: readonly CodeClauseRef[];
	readonly todoRefs: readonly CodeClauseRef[];
}

const CLAUSE_ID_GLOBAL_RE = new RegExp(`\\b(${CLAUSE_ID_PATTERN})\\b`, 'g');
const TODO_CLAUSE_SPAN_RE = /\bTODO\(([^)]*)\)/g;

export function extractClauseRefsFromText(
	content: string,
	file: string,
	knownIds: ReadonlySet<string>,
): {
	readonly knownRefs: readonly CodeClauseRef[];
	readonly unknownRefs: readonly CodeClauseRef[];
	readonly todoRefs: readonly CodeClauseRef[];
} {
	const knownRefs: CodeClauseRef[] = [];
	const unknownRefs: CodeClauseRef[] = [];
	const todoRefs: CodeClauseRef[] = [];

	const lines = content.split('\n');
	for (const [lineIdx, line] of lines.entries()) {
		const todoSpans: { start: number; end: number }[] = [];
		for (const todoMatch of line.matchAll(TODO_CLAUSE_SPAN_RE)) {
			if (todoMatch.index !== undefined) {
				todoSpans.push({
					start: todoMatch.index,
					end: todoMatch.index + todoMatch[0].length,
				});
			}
		}

		for (const match of line.matchAll(CLAUSE_ID_GLOBAL_RE)) {
			const id = match[1];
			const matchIndex = match.index;
			if (id === undefined || matchIndex === undefined) {
				continue;
			}

			const isInsideTodo = todoSpans.some(
				(span) => matchIndex >= span.start && matchIndex < span.end,
			);

			if (isInsideTodo) {
				todoRefs.push({ file, line: lineIdx + 1, id });
			} else if (knownIds.has(id)) {
				knownRefs.push({ file, line: lineIdx + 1, id });
			} else {
				unknownRefs.push({ file, line: lineIdx + 1, id });
			}
		}
	}

	return { knownRefs, unknownRefs, todoRefs };
}

const IGNORED_DIR_NAMES = new Set([
	'node_modules',
	'dist',
	'buildArtifact',
	'.git',
	'.turbo',
	'.tmp',
	'fixtures',
	'test-fixtures',
]);

const SCANNABLE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json']);

async function walkSourceFiles(dir: string): Promise<string[]> {
	let entries: import('node:fs').Dirent[];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const files: string[] = [];
	for (const entry of entries) {
		if (IGNORED_DIR_NAMES.has(entry.name)) {
			continue;
		}
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walkSourceFiles(path)));
		} else if (entry.isFile()) {
			const dotIdx = entry.name.lastIndexOf('.');
			if (dotIdx !== -1) {
				const ext = entry.name.slice(dotIdx);
				if (SCANNABLE_EXTENSIONS.has(ext)) {
					files.push(path);
				}
			}
		}
	}
	return files;
}

export async function scanSourceCodeRefs(
	roots: readonly string[],
	knownIds: ReadonlySet<string>,
): Promise<CodeScanResult> {
	const knownRefs: CodeClauseRef[] = [];
	const unknownRefs: CodeClauseRef[] = [];
	const todoRefs: CodeClauseRef[] = [];

	for (const root of roots) {
		const files = await walkSourceFiles(root);
		for (const file of files) {
			const content = await readFile(file, 'utf8');
			const res = extractClauseRefsFromText(content, file, knownIds);
			knownRefs.push(...res.knownRefs);
			unknownRefs.push(...res.unknownRefs);
			todoRefs.push(...res.todoRefs);
		}
	}

	return { knownRefs, unknownRefs, todoRefs };
}
