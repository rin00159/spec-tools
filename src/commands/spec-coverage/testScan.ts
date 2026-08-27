// packages/ / tools/ / examples/ 配下の *.test.ts をテキストとして走査し、
// テスト名先頭の条項 ID(必須)と、末尾 `[K-...]` 併記の条項 ID(任意)を集める。
// テストは静的パース(実行しない) — vitest の `it()`/`test()` はグローバル関数のため
// 実行環境なしで文字列だけを取り出す。

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface TestNameEntry {
	readonly file: string;
	readonly name: string;
	/** テスト名先頭の条項 ID。無ければ Q1 違反。 */
	readonly leadingId: string | undefined;
	/** 先頭 ID + 末尾 `[K-...]` 併記の全参照 ID。 */
	readonly referencedIds: readonly string[];
}

const TEST_CALL_RE = /\b(?:it|test)(?:\.\w+)?\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;

async function walkTestFiles(dir: string): Promise<string[]> {
	let entries: import('node:fs').Dirent[];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return [];
	}
	const files: string[] = [];
	for (const entry of entries) {
		if (entry.name === 'node_modules') {
			continue;
		}
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walkTestFiles(path)));
		} else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
			files.push(path);
		}
	}
	return files;
}

export async function scanTestNames(
	roots: readonly string[],
	idPattern: string,
): Promise<readonly TestNameEntry[]> {
	const leadingIdRe = new RegExp(`^(${idPattern}):`);
	const bracketIdRe = new RegExp(`\\[(${idPattern})\\]`, 'g');
	const entries: TestNameEntry[] = [];

	for (const root of roots) {
		for (const file of await walkTestFiles(root)) {
			const content = await readFile(file, 'utf8');
			for (const match of content.matchAll(TEST_CALL_RE)) {
				const name = match[1] ?? match[2];
				if (name === undefined) {
					continue;
				}
				const leadingMatch = name.match(leadingIdRe);
				const leadingId = leadingMatch?.[1];
				const bracketIds = [...name.matchAll(bracketIdRe)]
					.map((m) => m[1])
					.filter((id): id is string => id !== undefined);
				entries.push({
					file,
					name,
					leadingId,
					referencedIds: leadingId === undefined ? bracketIds : [leadingId, ...bracketIds],
				});
			}
		}
	}
	return entries;
}
