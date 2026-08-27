// Scans *.test.ts under packages/ / tools/ / examples/ as text,
// and collects the clause ID at the beginning of the test name (mandatory) and the clause ID appended with `[K-...]` at the end (optional).
// Tests are parsed statically (not executed) — vitest's `it()`/`test()` are global functions, so
// we just extract strings without an execution environment.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface TestNameEntry {
	readonly file: string;
	readonly name: string;
	/** The clause ID at the beginning of the test name. If absent, it violates Q1. */
	readonly leadingId: string | undefined;
	/** All referenced IDs: leading ID + appended `[K-...]` at the end. */
	readonly referencedIds: readonly string[];
}

async function walkTestFiles(dir: string, testSuffixes: string[]): Promise<string[]> {
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
			files.push(...(await walkTestFiles(path, testSuffixes)));
		} else if (entry.isFile() && testSuffixes.some((suffix) => entry.name.endsWith(suffix))) {
			files.push(path);
		}
	}
	return files;
}

export async function scanTestNames(
	roots: readonly string[],
	idPattern: string,
	testSuffixes: string[],
	testNamePatterns: string[],
): Promise<readonly TestNameEntry[]> {
	const leadingIdRe = new RegExp(`^(${idPattern}):`);
	const bracketIdRe = new RegExp(`\\[(${idPattern})\\]`, 'g');
	const entries: TestNameEntry[] = [];

	const regexes = testNamePatterns.map((p) => new RegExp(p, 'g'));

	for (const root of roots) {
		for (const file of await walkTestFiles(root, testSuffixes)) {
			const content = await readFile(file, 'utf8');

			for (const regex of regexes) {
				for (const match of content.matchAll(regex)) {
					// Find the first valid capture group after the full match
					let name: string | undefined;
					for (let i = 1; i < match.length; i++) {
						if (match[i] !== undefined) {
							name = match[i];
							break;
						}
					}

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
	}
	return entries;
}
