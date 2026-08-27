// 依存閉包の解決子。
// 正本は docs/decisions/109 決定4・決定8 / docs/plan/0_3/phase5.md Scope 6。
//
// workspace 全体(packages/*, tools/*, examples/*, apps/*)と各 package の node_modules を
// 起点とし、依存閉包を走査して package 名と実体ディレクトリ(realpath)の対応を返す。
// symlink は realpath で解決してから package 名で畳む(R5)。

import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { join } from 'node:path';

export interface PackageEntry {
	readonly name: string;
	readonly dir: string; // realpath
}

async function isDirectory(path: string): Promise<boolean> {
	try {
		const s = await stat(path);
		return s.isDirectory();
	} catch {
		return false;
	}
}

async function hasDocs(dir: string): Promise<boolean> {
	return (
		(await isDirectory(join(dir, 'docs', 'decisions'))) ||
		(await isDirectory(join(dir, 'docs', 'task')))
	);
}

async function readPackageName(dir: string): Promise<string | undefined> {
	try {
		const raw = await readFile(join(dir, 'package.json'), 'utf8');
		const data = JSON.parse(raw) as { name?: unknown };
		return typeof data.name === 'string' ? data.name : undefined;
	} catch {
		return undefined;
	}
}

async function parseWorkspacePatterns(repoRoot: string): Promise<string[]> {
	try {
		const raw = await readFile(join(repoRoot, 'pnpm-workspace.yaml'), 'utf8');
		const patterns: string[] = [];
		for (const line of raw.split('\n')) {
			const trimmed = line.trim();
			if (trimmed.startsWith('-')) {
				const val = trimmed
					.slice(1)
					.trim()
					.replace(/^['"]|['"]$/g, '');
				if (val) {
					patterns.push(val);
				}
			}
		}
		if (patterns.length > 0) {
			return patterns;
		}
	} catch {
		// pnpm-workspace.yaml が無ければ既定パターン
	}
	return ['packages/*', 'tools/*', 'examples/*', 'apps/*'];
}

/**
 * repoRoot 起点で workspace 全体と依存閉包を走査し、実在する package の一覧を返す。
 * - symlink は realpath で解決してから name で畳む(R5)。
 * - 文書を持つ package (docs/decisions/ または docs/task/ を持つもの) で異なる realpath が
 *   同じ name を名乗った場合は throw する。文書を持たない第三者 package の同名衝突は許容する。
 * - npm レジストリへは問い合わせない(ファイルシステム内で完結)。
 */
export async function discoverPackages(repoRoot: string): Promise<ReadonlyArray<PackageEntry>> {
	const realRoot = await realpath(repoRoot);
	const nameToDir = new Map<string, string>();
	const queue: string[] = [];
	const visitedDirs = new Set<string>();

	async function processCandidate(candidateDir: string): Promise<void> {
		let real: string;
		try {
			real = await realpath(candidateDir);
		} catch {
			return;
		}
		if (!(await isDirectory(real))) {
			return;
		}
		const name = await readPackageName(real);
		if (!name) {
			return;
		}

		const existingDir = nameToDir.get(name);
		if (existingDir && existingDir !== real) {
			const existingHasDocs = await hasDocs(existingDir);
			const newHasDocs = await hasDocs(real);
			if (existingHasDocs && newHasDocs) {
				throw new Error(
					`同じ package 名 "${name}" を持つ異なるパス (${existingDir} と ${real}) が文書ディレクトリを持っている`,
				);
			}
			if (newHasDocs && !existingHasDocs) {
				nameToDir.set(name, real);
			}
		} else if (!existingDir) {
			nameToDir.set(name, real);
		}

		if (!visitedDirs.has(real)) {
			visitedDirs.add(real);
			queue.push(real);
		}
	}

	// 1. ルート自身
	const rootName = (await readPackageName(realRoot)) ?? 'root';
	nameToDir.set(rootName, realRoot);
	queue.push(realRoot);
	visitedDirs.add(realRoot);

	// 2. workspace パターンからパッケージ候補を列挙
	const patterns = await parseWorkspacePatterns(repoRoot);
	for (const pattern of patterns) {
		if (pattern.endsWith('/*')) {
			const parent = pattern.slice(0, -2);
			const parentDir = join(repoRoot, parent);
			if (await isDirectory(parentDir)) {
				const entries = await readdir(parentDir, { withFileTypes: true });
				for (const entry of entries) {
					if (entry.isDirectory() || entry.isSymbolicLink()) {
						await processCandidate(join(parentDir, entry.name));
					}
				}
			}
		}
	}

	// 3. 各 package の node_modules を辿る (symlink を辿る)
	while (queue.length > 0) {
		const currentDir = queue.shift();
		if (!currentDir) {
			continue;
		}
		const nodeModulesDir = join(currentDir, 'node_modules');
		if (await isDirectory(nodeModulesDir)) {
			const entries = await readdir(nodeModulesDir, { withFileTypes: true });
			for (const entry of entries) {
				if (entry.name.startsWith('.')) {
					continue;
				}
				if (entry.name.startsWith('@')) {
					const scopePath = join(nodeModulesDir, entry.name);
					let realScope: string;
					try {
						realScope = await realpath(scopePath);
					} catch {
						continue;
					}
					if (await isDirectory(realScope)) {
						const subEntries = await readdir(realScope, {
							withFileTypes: true,
						});
						for (const sub of subEntries) {
							if (sub.name.startsWith('.')) {
								continue;
							}
							if (sub.isDirectory() || sub.isSymbolicLink()) {
								await processCandidate(join(realScope, sub.name));
							}
						}
					}
				} else if (entry.isDirectory() || entry.isSymbolicLink()) {
					await processCandidate(join(nodeModulesDir, entry.name));
				}
			}
		}
	}

	const result: PackageEntry[] = [];
	for (const [name, dir] of nameToDir.entries()) {
		result.push({ name, dir });
	}

	return result.sort((a, b) => a.name.localeCompare(b.name));
}
