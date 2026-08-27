// spec/*.md の条項属性行(00-conventions.md)をパースする。

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ClauseFormatConfig } from '../../config.ts';
import { IMPL_TOKEN_SOURCE, type ImplPoint, parseImplPoint } from './implPoint.ts';

export interface ClauseInfo {
	readonly id: string;
	readonly status: string;
	readonly since: string;
	readonly kind: string;
	/** plan 版 + Phase。`since`(spec version)とは別概念(00-conventions.md)。 */
	readonly impl: ImplPoint;
	readonly file: string;
	/** 見出し行(1始まり)。`spec:show` / `spec:index` が位置を示すために使う。 */
	readonly line: number;
	/** 見出しの条項 ID より後ろの部分(例: 「Entity」)。 */
	readonly title: string;
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
			`^\\*\\*属性\\*\\*: \`status: (?<status>active|withdrawn)\` / \`since: (?<since>[\\d.]+)\` / \`kind: (?<kind>規範|情報)\` / \`impl: (?<impl>${IMPL_TOKEN_SOURCE})\`\\s*$`,
	);

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
			if (headingMatch) {
				if (headingMatch.groups) {
					id = headingMatch.groups.id;
					title = headingMatch.groups.title;
				} else {
					id = headingMatch[1];
					title = headingMatch[2];
				}
			} else {
				const legacyMatch = lines[i]?.match(new RegExp(`^##\\s+(${idPattern})\\s+(.+)$`));
				if (!legacyMatch) continue;
				id = legacyMatch[1];
				title = legacyMatch[2];
			}
			if (id === undefined || title === undefined) {
				continue;
			}

			const existingFile = seenIds.get(id);
			if (existingFile !== undefined) {
				throw new Error(
					`条項 ID ${id} が複数箇所で見出しになっている(${existingFile} と ${file})。欠番・再利用・振り直しは禁止`,
				);
			}
			seenIds.set(id, file);

			let attrLineIndex = i + 1;
			while (attrLineIndex < lines.length && lines[attrLineIndex]?.trim() === '') {
				attrLineIndex++;
			}
			const attrMatch = lines[attrLineIndex]?.match(attrRe);
			if (!attrMatch) {
				throw new Error(`${file}: 条項 ${id} の見出し直後に属性行が見つからない`);
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
				throw new Error(`${file}: 条項 ${id} の impl \`${implStr}\` が書式違反`);
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
			});
		}
	}

	if (clauses.length === 0) {
		throw new Error('走査して得た条項が0件(走査が空振りしたときは失敗する)');
	}

	return clauses;
}
