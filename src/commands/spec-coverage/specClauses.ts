// spec/*.md の条項属性行(00-conventions.md)をパースする。

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IMPL_TOKEN_SOURCE, type ImplPoint, parseImplPoint } from './implPoint.ts';

export interface ClauseInfo {
	readonly id: string;
	readonly status: 'active' | 'withdrawn';
	readonly since: string;
	readonly kind: '規範' | '情報';
	/** plan 版 + Phase。`since`(spec version)とは別概念(00-conventions.md)。 */
	readonly impl: ImplPoint;
	readonly file: string;
	/** 見出し行(1始まり)。`spec:show` / `spec:index` が位置を示すために使う。 */
	readonly line: number;
	/** 見出しの条項 ID より後ろの部分(例: 「Entity」)。 */
	readonly title: string;
}

export const CLAUSE_ID_PATTERN =
	'K-(?:CORE|TARGET-[A-Z0-9]{3,8}|PROFILE-[A-Z0-9]{2,8})-[A-Z]+-\\d{3}';
export const CLAUSE_ID_RE = new RegExp(`^${CLAUSE_ID_PATTERN}$`);
const HEADING_RE = new RegExp(`^##\\s+(${CLAUSE_ID_PATTERN})\\s+(.+)$`);
const ATTR_RE = new RegExp(
	'^\\*\\*属性\\*\\*: `status: (active|withdrawn)` / `since: ([\\d.]+)` / ' +
		`\`kind: (規範|情報)\` / \`impl: (${IMPL_TOKEN_SOURCE})\`\\s*$`,
);

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
): Promise<ReadonlyArray<ClauseInfo>> {
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

			const headingMatch = lines[i]?.match(HEADING_RE);
			if (!headingMatch) {
				continue;
			}
			const id = headingMatch[1];
			const title = headingMatch[2];
			if (id === undefined || title === undefined) {
				continue;
			}

			const existingFile = seenIds.get(id);
			if (existingFile !== undefined) {
				throw new Error(
					`条項 ID ${id} が複数箇所で見出しになっている(${existingFile} と ${file})。00-conventions.md により欠番・再利用・振り直しは禁止`,
				);
			}
			seenIds.set(id, file);

			let attrLineIndex = i + 1;
			while (attrLineIndex < lines.length && lines[attrLineIndex]?.trim() === '') {
				attrLineIndex++;
			}
			const attrMatch = lines[attrLineIndex]?.match(ATTR_RE);
			if (!attrMatch) {
				throw new Error(
					`${file}: 条項 ${id} の見出し直後に属性行が見つからない(00-conventions.md の書式違反)`,
				);
			}
			const [, status, since, kind, implStr] = attrMatch;
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
				throw new Error(
					`${file}: 条項 ${id} の impl \`${implStr}\` が書式違反(00-conventions.md「\`impl\` の書式」: v<major>_<minor>_<phase>)`,
				);
			}

			clauses.push({
				id,
				status: status as 'active' | 'withdrawn',
				since,
				kind: kind as '規範' | '情報',
				impl,
				file,
				line: i + 1,
				title: title.trim(),
			});
		}
	}

	if (clauses.length === 0) {
		throw new Error('走査して得た条項が0件(00-conventions.md「走査が空振りしたときは失敗する」)');
	}

	return clauses;
}
