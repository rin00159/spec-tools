// decisions / task の参照解決と表示。
// 正本は docs/decisions/109 決定4・決定8 / docs/plan/0_3/phase5.md Scope 6。
//
//   pnpm decision:show 105
//   pnpm decision:show @kata2/target-firebase_cloudflare-html:105
//   pnpm decision:show kata2:200
//   pnpm task:show 061
//   pnpm task:show @kata2/targetlib-schemaui:200

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { discoverPackages, type PackageEntry } from './closure.ts';

export type DocType = 'decision' | 'task';

export interface ResolvedDoc {
	readonly reference: string;
	readonly filePath: string;
	readonly content: string;
}

// ファイル名に `_` を含む legacy が在る(036-v0_2-after-tasks.md)。
const NUMBERED_FILE_RE = /^(\d{3})-[a-z0-9_-]+\.md$/;

async function findNumberedFile(dir: string, targetNum: number): Promise<string | undefined> {
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		const prefix = `${String(targetNum).padStart(3, '0')}-`;
		for (const entry of entries) {
			if (entry.isFile() && entry.name.startsWith(prefix) && entry.name.endsWith('.md')) {
				return join(dir, entry.name);
			}
		}
	} catch {
		// ディレクトリが無い場合など
	}
	return undefined;
}

async function listNumberedFiles(dir: string): Promise<string[]> {
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		return entries.filter((e) => e.isFile() && NUMBERED_FILE_RE.test(e.name)).map((e) => e.name);
	} catch {
		return [];
	}
}

/**
 * stub ファイルかどうか判定し、移設先があるならそのパス・参照を返す。
 */
function parseStubTarget(content: string): string | undefined {
	// 例: **移設先**: `@kata2/pkg:105`\n`packages/pkg/docs/decisions/105-xxx.md`
	const match = content.match(/\*\*移設先\*\*:\s*`([^`]+)`/);
	return match?.[1];
}

export function suggestClosest(input: string, candidates: readonly string[], limit = 5): string[] {
	const lower = input.toLowerCase();
	const matched = candidates.filter(
		(c) => c.toLowerCase().includes(lower) || lower.includes(c.toLowerCase()),
	);
	if (matched.length > 0) {
		return matched.slice(0, limit);
	}
	return candidates.slice(0, limit);
}

export async function resolveDocRef(
	repoRoot: string,
	docType: DocType,
	ref: string,
	packages?: ReadonlyArray<PackageEntry>,
	decisionDir: string = 'docs/decisions',
	taskDir: string = 'docs/task',
): Promise<ResolvedDoc> {
	const subDir = docType === 'decision' ? decisionDir : taskDir;
	const pkgs = packages ?? (await discoverPackages(repoRoot));

	// 1. bare 番号 (例: "105", "063")
	if (/^\d+$/.test(ref)) {
		const num = Number(ref);
		if (num >= 200) {
			throw new Error(
				`200 以降の番号は名前空間付きで指定すること (例: @kata2/core:${ref} や kata2:${ref})`,
			);
		}

		const rootDir = join(repoRoot, subDir);
		const filePath = await findNumberedFile(rootDir, num);
		if (!filePath) {
			const existing = await listNumberedFiles(rootDir);
			const suggestions = suggestClosest(ref, existing);
			const hint = suggestions.length > 0 ? ` (近い候補: ${suggestions.join(', ')})` : '';
			throw new Error(`${docType} が見つからない: ${ref}${hint}`);
		}

		const rawContent = await readFile(filePath, 'utf8');
		const stubTarget = parseStubTarget(rawContent);
		if (stubTarget) {
			// stub の場合は移設先を解決して表示
			if (stubTarget.includes(':')) {
				return await resolveDocRef(repoRoot, docType, stubTarget, pkgs, decisionDir, taskDir);
			}
			const targetPath = join(repoRoot, stubTarget);
			const targetContent = await readFile(targetPath, 'utf8');
			return {
				reference: ref,
				filePath: targetPath,
				content: targetContent,
			};
		}

		return {
			reference: `kata2:${String(num).padStart(3, '0')}`,
			filePath,
			content: rawContent,
		};
	}

	// 2. 名前空間付き参照 (例: "@kata2/targetlib-schemaui:200", "kata2:200")
	if (ref.includes(':')) {
		const colonIdx = ref.lastIndexOf(':');
		const pkgName = ref.slice(0, colonIdx);
		const numStr = ref.slice(colonIdx + 1);
		const num = Number(numStr);

		if (Number.isNaN(num)) {
			throw new Error(`無効な参照形式: ${ref} (例: 105 または @kata2/core:200)`);
		}

		const pkgEntry = pkgs.find((p) => p.name === pkgName);
		if (!pkgEntry) {
			const pkgNames = pkgs.map((p) => p.name);
			const suggestions = suggestClosest(pkgName, pkgNames);
			const hint = suggestions.length > 0 ? ` (近い package: ${suggestions.join(', ')})` : '';
			throw new Error(`package が見つからない: ${pkgName}${hint}`);
		}

		const docDir = join(pkgEntry.dir, subDir);
		const filePath = await findNumberedFile(docDir, num);
		if (!filePath) {
			const existing = await listNumberedFiles(docDir);
			const suggestions = suggestClosest(numStr, existing);
			const hint =
				suggestions.length > 0 ? ` (この package 内の候補: ${suggestions.join(', ')})` : '';
			throw new Error(`${docType} が見つからない: ${ref}${hint}`);
		}

		const content = await readFile(filePath, 'utf8');
		return {
			reference: ref,
			filePath,
			content,
		};
	}

	throw new Error(`無効な参照形式: ${ref} (例: 105 または @kata2/core:200)`);
}

export async function runShow(
	repoRoot: string,
	docType: string | undefined,
	refs: string[],
): Promise<void> {
	if (docType !== 'decision' && docType !== 'task') {
		console.error('Usage: spec-tools doc-ref show <decision|task> <ref> [ref...]');
		process.exitCode = 2;
		return;
	}

	if (refs.length === 0) {
		console.error(`Usage: spec-tools doc-ref show ${docType} <ref> [ref...]`);
		console.error(`  Example: spec-tools doc-ref show ${docType} 105`);
		console.error(`           spec-tools doc-ref show ${docType} @kata2/core:200`);
		process.exitCode = 2;
		return;
	}

	let missing = false;
	const pkgs = await discoverPackages(repoRoot);

	const fullConfig = (await import('../../config.ts')).loadConfig(repoRoot);
	const decisionDir = fullConfig.docRef?.decisionDir ?? 'docs/decisions';
	const taskDir = fullConfig.docRef?.taskDir ?? 'docs/task';

	for (const ref of refs) {
		try {
			const resolved = await resolveDocRef(repoRoot, docType, ref, pkgs, decisionDir, taskDir);
			const relPath = relative(repoRoot, resolved.filePath);
			console.log(`# ${resolved.reference} (${relPath})\n`);
			console.log(resolved.content.trimEnd());
			console.log('');
		} catch (err) {
			missing = true;
			console.error(err instanceof Error ? err.message : String(err));
		}
	}

	if (missing) {
		process.exitCode = 1;
	}
}
