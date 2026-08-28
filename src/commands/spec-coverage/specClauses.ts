// Parse the clause attribute lines (00-conventions.md) of spec/*.md.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ClauseFormatConfig } from '../../config.ts';
import { IMPL_TOKEN_SOURCE, type ImplPoint, parseImplPoint } from './implPoint.ts';

export interface ClauseInfo {
	readonly id: string;
	readonly status: string;
	readonly since: string;
	readonly kind: string;
	/** plan version + Phase. A different concept from `since` (spec version) (00-conventions.md). */
	readonly impl: ImplPoint;
	readonly file: string;
	/** Heading line (1-indexed). Used by `spec:show` / `spec:index` to indicate position. */
	readonly line: number;
	/** The part after the clause ID in the heading (e.g., "Entity"). */
	readonly title: string;
	readonly isNormative: boolean;
	readonly isActive: boolean;
}

export const DEFAULT_CLAUSE_ID_PATTERN =
	'K-(?:CORE|TARGET-[A-Z0-9]{3,8}|PROFILE-[A-Z0-9]{2,8})-[A-Z]+-\\d{3}';

async function walkMarkdownFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files: string[] = [];
	for (const entry of entries) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walkMarkdownFiles(path)));
		} else if (entry.isFile() && entry.name.endsWith('.md')) {
			files.push(path);
		}
	}
	return files;
}

export async function parseSpecClauses(
	specRoots: readonly string[],
	formatConfig?: ClauseFormatConfig,
): Promise<ReadonlyArray<ClauseInfo>> {
	const idPattern = formatConfig?.idPattern ?? DEFAULT_CLAUSE_ID_PATTERN;
	const headingRe = new RegExp(
		formatConfig?.headingPattern ?? `^##\\s+(?<id>${idPattern})\\s+(?<title>.+)$`,
	);
	const attrRe = new RegExp(
		formatConfig?.attrPattern ??
			`^\\*\\*Attributes\\*\\*: \`status: (?<status>active|withdrawn)\` / \`since: (?<since>[\\d.]+)\` / \`kind: (?<kind>normative|informative)\` / \`impl: (?<impl>${IMPL_TOKEN_SOURCE})\`\\s*$`,
	);
	const normativeKinds = new Set(formatConfig?.normativeKinds ?? ['normative']);
	const activeStatuses = new Set(formatConfig?.activeStatuses ?? ['active']);

	const files: string[] = [];
	for (const root of specRoots) {
		files.push(...(await walkMarkdownFiles(root)));
	}
	const clauses: ClauseInfo[] = [];
	const seenIds = new Map<string, string>();

	for (const file of files) {
		const lines = (await readFile(file, 'utf8')).split('\n');
		let inFence = false;
		for (let i = 0; i < lines.length; i++) {
			if (lines[i]?.trimStart().startsWith('```')) {
				inFence = !inFence;
				continue;
			}
			if (inFence) {
				continue;
			}

			let id: string | undefined;
			let title: string | undefined;

			const headingMatch = lines[i]?.match(headingRe);
			if (!headingMatch) continue;

			if (headingMatch.groups) {
				id = headingMatch.groups.id;
				title = headingMatch.groups.title;
			} else {
				id = headingMatch[1];
				title = headingMatch[2];
			}

			if (id === undefined || title === undefined) {
				continue;
			}

			const existingFile = seenIds.get(id);
			if (existingFile !== undefined) {
				throw new Error(
					`Clause ID ${id} is used as a heading in multiple places (${existingFile} and ${file}). Clause IDs must be unique.`,
				);
			}
			seenIds.set(id, file);

			let attrLineIndex = i + 1;
			while (attrLineIndex < lines.length && lines[attrLineIndex]?.trim() === '') {
				attrLineIndex++;
			}
			const attrMatch = lines[attrLineIndex]?.match(attrRe);
			if (!attrMatch) {
				throw new Error(
					`${file}: Attributes line not found immediately after heading for clause ${id}`,
				);
			}

			let status: string | undefined;
			let since: string | undefined;
			let kind: string | undefined;
			let implStr: string | undefined;
			if (attrMatch.groups) {
				status = attrMatch.groups.status;
				since = attrMatch.groups.since;
				kind = attrMatch.groups.kind;
				implStr = attrMatch.groups.impl;
			} else {
				// Legacy fallback for positional groups
				status = attrMatch[1];
				since = attrMatch[2];
				kind = attrMatch[3];
				implStr = attrMatch[4];
			}

			if (
				status === undefined ||
				since === undefined ||
				kind === undefined ||
				implStr === undefined
			) {
				continue;
			}
			const impl = parseImplPoint(implStr);
			if (impl === undefined) {
				throw new Error(`${file}: Invalid impl format \`${implStr}\` for clause ${id}`);
			}

			clauses.push({
				id,
				status,
				since,
				kind,
				impl,
				file,
				line: i + 1,
				title: title.trim(),
				isNormative: normativeKinds.has(kind),
				isActive: activeStatuses.has(status),
			});
		}
	}

	if (clauses.length === 0) {
		throw new Error(
			'No spec clauses found. Ensure the specRoot directories contain valid markdown files.',
		);
	}

	return clauses;
}
