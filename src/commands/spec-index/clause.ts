// Extraction of the clause body and construction of the index (pure function).
//
// packages/core/docs/spec/10-core-model.md is 141KB on its own, and opening the file to check a single clause
// fills the context just with that. This is the foundation to allow `spec:show` to pull up only the necessary clauses
// (v0.2 Phase 25 / docs/decisions/089).

import { formatImplPoint } from '../spec-coverage/implPoint.ts';
import type { ClauseInfo } from '../spec-coverage/specClauses.ts';

/** The body is from the clause heading (`## K-...`) up to just before the next `## ` heading. `### ` is included in the body. */
export function extractClauseBody(lines: readonly string[], headingLine: number): string {
	const start = headingLine - 1;
	let end = lines.length;
	for (let i = start + 1; i < lines.length; i++) {
		if (lines[i]?.startsWith('## ')) {
			end = i;
			break;
		}
	}
	return lines.slice(start, end).join('\n').replace(/\s+$/, '');
}

/** Neighborhood candidates to catch ID spelling errors (prioritizes the same AREA, then prefix matching). */
export function suggestIds(unknownId: string, knownIds: readonly string[], limit = 5): string[] {
	const area = unknownId.split('-').slice(0, 3).join('-');
	const sameArea = knownIds.filter((id) => id.startsWith(`${area}-`));
	if (sameArea.length > 0) {
		return sameArea.slice(0, limit);
	}
	const prefix = unknownId.split('-').slice(0, 2).join('-');
	return knownIds.filter((id) => id.startsWith(`${prefix}-`)).slice(0, limit);
}

const HEADER = [
	'# spec index (auto-generated)',
	'',
	'**This file is a product of `spec-tools spec-index`. Do not edit manually**',
	'If the content is outdated, `check-spec-index` will fail.',
	'',
	'Pull up clause bodies with **`spec-tools spec-show <clause ID>`**. Do not read the entire spec files.',
	'',
] as const;

/** Constructs the body of the index. Divides by file, and arranges clauses in their order of appearance. */
export function renderIndex(clauses: readonly ClauseInfo[], customHeader?: string): string {
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
		const list = (byFile.get(file) ?? []).slice().sort((a, b) => a.line - b.line);
		sections.push(`## ${file} (${list.length})`);
		sections.push('');
		sections.push('| Clause ID | Heading | status | since | impl | Line |');
		sections.push('|---|---|---|---|---|---|');
		for (const clause of list) {
			sections.push(
				`| \`${clause.id}\` | ${clause.title} | ${clause.status} | ${clause.since} | ${formatImplPoint(clause.impl)} | ${clause.line} |`,
			);
		}
		sections.push('');
	}

	const total = clauses.length;
	const withdrawn = clauses.filter((c) => !c.isActive).length;
	const headerStr = customHeader ?? HEADER.join('\n');
	return [
		headerStr,
		`Clauses: ${total} (of which withdrawn/inactive: ${withdrawn}).`,
		'',
		...sections,
	].join('\n');
}
