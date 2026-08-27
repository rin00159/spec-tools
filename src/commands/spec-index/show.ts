// Extract the body of a clause. **Use this instead of reading the entire spec file.**
//
//   pnpm spec:show K-CORE-TYPE-011 [K-CORE-DEF-012 ...]

import { readFile } from 'node:fs/promises';
import { relative } from 'node:path';
import { parseSpecClauses } from '../spec-coverage/specClauses.ts';
import { discoverSpecRoots } from '../spec-coverage/specRoots.ts';
import { extractClauseBody, suggestIds } from './clause.ts';

export async function runSpecShow(repoRoot: string = process.cwd(), ids: string[]): Promise<void> {
	if (ids.length === 0) {
		console.error('Usage: spec-tools spec-show <id> [id...]');
		process.exitCode = 2;
		return;
	}

	const fullConfig = (await import('../../config.ts')).loadConfig(repoRoot);
	const specRoots = fullConfig.specRoots ?? (await discoverSpecRoots(repoRoot));
	const clauses = await parseSpecClauses(specRoots, fullConfig.clauseFormat);
	const byId = new Map(clauses.map((c) => [c.id, c]));
	const fileCache = new Map<string, string[]>();
	let missing = false;

	for (const id of ids) {
		const clause = byId.get(id);
		if (!clause) {
			missing = true;
			console.error(`Spec not found: ${id}`);
			const suggestions = suggestIds(
				id,
				clauses.map((c) => c.id),
			);
			if (suggestions.length > 0) {
				console.error(`  Did you mean: ${suggestions.join(' / ')}`);
			}
			continue;
		}

		let lines = fileCache.get(clause.file);
		if (!lines) {
			lines = (await readFile(clause.file, 'utf8')).split('\n');
			fileCache.set(clause.file, lines);
		}

		console.log(`# ${relative(repoRoot, clause.file)}:${clause.line} (status: ${clause.status})`);
		console.log('');
		console.log(extractClauseBody(lines, clause.line));
		console.log('');
	}

	if (missing) {
		process.exitCode = 1;
	}
}
