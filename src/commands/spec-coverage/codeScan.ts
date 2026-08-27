// Scans source files under packages/ / tools/ / examples/ to detect clause ID references in code,
// comments, and error messages.
// Non-existent clause IDs are reported as unknown references, and those explicitly marked with the `TODO(K-...)` notation are treated as deferred.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

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

const TODO_CLAUSE_SPAN_RE = /\bTODO\(([^)]*)\)/g;

export function extractClauseRefsFromText(
	content: string,
	file: string,
	knownIds: ReadonlySet<string>,
	idPattern: string,
): {
	readonly knownRefs: readonly CodeClauseRef[];
	readonly unknownRefs: readonly CodeClauseRef[];
	readonly todoRefs: readonly CodeClauseRef[];
} {
	const knownRefs: CodeClauseRef[] = [];
	const unknownRefs: CodeClauseRef[] = [];
	const todoRefs: CodeClauseRef[] = [];
	const clauseIdGlobalRe = new RegExp(`\\b(${idPattern})\\b`, 'g');

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

		for (const match of line.matchAll(clauseIdGlobalRe)) {
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

async function walkSourceFiles(dir: string, extensions: ReadonlySet<string>): Promise<string[]> {
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
			files.push(...(await walkSourceFiles(path, extensions)));
		} else if (entry.isFile()) {
			const dotIdx = entry.name.lastIndexOf('.');
			if (dotIdx !== -1) {
				const ext = entry.name.slice(dotIdx);
				if (extensions.has(ext)) {
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
	idPattern: string,
	sourceExtensions: string[],
): Promise<CodeScanResult> {
	const knownRefs: CodeClauseRef[] = [];
	const unknownRefs: CodeClauseRef[] = [];
	const todoRefs: CodeClauseRef[] = [];

	const extensions = new Set(sourceExtensions);

	for (const root of roots) {
		const files = await walkSourceFiles(root, extensions);
		for (const file of files) {
			const content = await readFile(file, 'utf8');
			const res = extractClauseRefsFromText(content, file, knownIds, idPattern);
			knownRefs.push(...res.knownRefs);
			unknownRefs.push(...res.unknownRefs);
			todoRefs.push(...res.todoRefs);
		}
	}

	return { knownRefs, unknownRefs, todoRefs };
}
