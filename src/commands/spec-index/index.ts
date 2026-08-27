// spec 索引の生成と鮮度検査。
//
//   pnpm spec:index          # spec/INDEX.md を生成(または更新)
//   pnpm check:spec-index    # 生成物が最新かを検査(pnpm lint の一部)

import { readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { loadConfig } from '../../config.ts';
import { parseSpecClauses } from '../spec-coverage/specClauses.ts';
import { discoverSpecRoots } from '../spec-coverage/specRoots.ts';
import { renderIndex } from './clause.ts';

export async function runSpecIndex(
	repoRoot: string = process.cwd(),
	checkOnly: boolean,
): Promise<void> {
	const SPEC_DIR = join(repoRoot, 'spec');
	const INDEX_PATH = join(SPEC_DIR, 'INDEX.md');

	const fullConfig = loadConfig(repoRoot);
	const specRoots = fullConfig.specRoots ?? (await discoverSpecRoots(repoRoot));
	const clauses = (await parseSpecClauses(specRoots, fullConfig.clauseFormat)).map((clause) => ({
		...clause,
		file: relative(repoRoot, clause.file),
	}));
	let customHeader: string | undefined = fullConfig.specIndex?.header;
	if (customHeader?.endsWith('.md')) {
		try {
			customHeader = await readFile(join(repoRoot, customHeader), 'utf8');
		} catch {
			// fallback to using it as literal string if not a file
		}
	}
	const expected = renderIndex(clauses, customHeader);

	if (!checkOnly) {
		await writeFile(INDEX_PATH, expected, 'utf8');
		console.log(`spec:index: Generated spec/INDEX.md (${clauses.length} clauses)`);
		return;
	}

	let actual: string | undefined;
	try {
		actual = await readFile(INDEX_PATH, 'utf8');
	} catch {
		actual = undefined;
	}

	if (actual !== expected) {
		console.error(
			actual === undefined
				? 'check-spec-index: spec/INDEX.md does not exist. Run `spec-tools spec-index` to generate it.'
				: 'check-spec-index: spec/INDEX.md is out of date. Run `spec-tools spec-index` to update.',
		);
		process.exitCode = 1;
		return;
	}

	console.log(`check-spec-index: Up to date (${clauses.length} clauses)`);
}
