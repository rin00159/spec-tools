// Dependency closure resolver.
// Source of truth: docs/decisions/109 Decision 4 & 8 / docs/plan/0_3/phase5.md Scope 6.
//
// Traverses the entire workspace (packages/*, tools/*, examples/*, apps/*) and each package's node_modules
// as starting points, walking the dependency closure to return the mapping between package names and real directories (realpath).
// Symlinks are resolved to realpath before folding by package name (R5).

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
		// Default pattern if pnpm-workspace.yaml does not exist
	}
	return ['packages/*', 'tools/*', 'examples/*', 'apps/*'];
}

/**
 * Traverses the entire workspace and dependency closure starting from repoRoot, and returns a list of existing packages.
 * - Symlinks are resolved to realpath before folding by name (R5).
 * - Throws if a package with docs (has docs/decisions/ or docs/task/) claims the same name with different realpaths.
 *   Name collisions for third-party packages without docs are allowed.
 * - Does not query the npm registry (completed within the file system).
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
					`Conflicting paths for package name "${name}" (${existingDir} and ${real}) both have doc directories.`,
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

	// 1. Root itself
	const rootName = (await readPackageName(realRoot)) ?? 'root';
	nameToDir.set(rootName, realRoot);
	queue.push(realRoot);
	visitedDirs.add(realRoot);

	// 2. Enumerate package candidates from workspace patterns
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

	// 3. Traverse node_modules of each package (traverse symlinks)
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
