// Discover the scanning roots of clause files (root spec/ and packages/*/docs/spec/).
// The original is spec/00-conventions.md "Clause file location and scanning root".

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

async function isDirectory(path: string): Promise<boolean> {
	try {
		const s = await stat(path);
		return s.isDirectory();
	} catch {
		return false;
	}
}

// Discover the scanning roots of clause files.
// Explores the root spec/ and packages/<pkg>/docs/spec/ in a glob-like manner,
// and returns the absolute paths of the existing roots in ascending order.
// The package name is not hardcoded, but discovered by directory traversal.
// Throws if 0 roots are found (prevents false positives).
export async function discoverSpecRoots(repoRoot: string): Promise<ReadonlyArray<string>> {
	const roots: string[] = [];

	const rootSpec = join(repoRoot, 'spec');
	if (await isDirectory(rootSpec)) {
		roots.push(rootSpec);
	}

	const packagesDir = join(repoRoot, 'packages');
	if (await isDirectory(packagesDir)) {
		const entries = await readdir(packagesDir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory()) {
				const pkgSpec = join(packagesDir, entry.name, 'docs', 'spec');
				if (await isDirectory(pkgSpec)) {
					roots.push(pkgSpec);
				}
			}
		}
	}

	if (roots.length === 0) {
		throw new Error('No spec root directories found.');
	}

	return roots.sort();
}
