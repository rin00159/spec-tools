// Tests for traversing the dependency closure and discovering packages.
// Source of truth: docs/decisions/109 Decision 4 / docs/plan/0_3/phase5.md Scope 6.
//
// It is intentional that there is no article ID in the test name (tools/ is outside the scope of Question 1).

import { mkdir, mkdtemp, symlink, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverPackages } from './closure.ts';

async function createFixtureRepo(): Promise<string> {
	return await mkdtemp(join(tmpdir(), 'scope-doc-closure-'));
}

describe('discoverPackages', () => {
	it('enumerates packages and root within workspace', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'scope' }), 'utf8');

		const pkgADir = join(repo, 'packages', 'a');
		await mkdir(pkgADir, { recursive: true });
		await writeFile(join(pkgADir, 'package.json'), JSON.stringify({ name: '@scope/a' }), 'utf8');

		const packages = await discoverPackages(repo);
		const names = packages.map((p) => p.name);
		expect(names).toContain('scope');
		expect(names).toContain('@scope/a');
	});

	it('discovers external packages reachable only via node_modules symlink, and removing symlink changes results (R5)', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'scope' }), 'utf8');

		// Package placed outside the workspace (e.g., external-libs/ext-lib)
		const extDir = join(repo, 'external-libs', 'ext-lib');
		await mkdir(extDir, { recursive: true });
		await writeFile(join(extDir, 'package.json'), JSON.stringify({ name: '@ext/lib' }), 'utf8');

		// packages/cli references it as node_modules/@ext/lib via symlink
		const pkgCli = join(repo, 'packages', 'cli');
		const cliNodeModulesScope = join(pkgCli, 'node_modules', '@ext');
		await mkdir(cliNodeModulesScope, { recursive: true });
		await writeFile(join(pkgCli, 'package.json'), JSON.stringify({ name: '@scope/cli' }), 'utf8');

		const symlinkPath = join(cliNodeModulesScope, 'lib');
		await symlink(extDir, symlinkPath, 'dir');

		// 1. With symlink, @ext/lib is discovered
		const pkgsWithSymlink = await discoverPackages(repo);
		expect(pkgsWithSymlink.map((p) => p.name)).toContain('@ext/lib');

		// 2. Without symlink, @ext/lib is no longer discovered (proof that symlink was traversed)
		await unlink(symlinkPath);
		const pkgsWithoutSymlink = await discoverPackages(repo);
		expect(pkgsWithoutSymlink.map((p) => p.name)).not.toContain('@ext/lib');
	});

	it('folds into one even if the same package is reached from both glob and symlink (R5)', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'scope' }), 'utf8');

		const pkgCore = join(repo, 'packages', 'core');
		await mkdir(pkgCore, { recursive: true });
		await writeFile(join(pkgCore, 'package.json'), JSON.stringify({ name: '@scope/core' }), 'utf8');

		const pkgCli = join(repo, 'packages', 'cli');
		const cliNodeModules = join(pkgCli, 'node_modules', '@scope');
		await mkdir(cliNodeModules, { recursive: true });
		await writeFile(join(pkgCli, 'package.json'), JSON.stringify({ name: '@scope/cli' }), 'utf8');

		// symlink to cli's node_modules/@scope/core -> packages/core
		await symlink(pkgCore, join(cliNodeModules, 'core'), 'dir');

		const packages = await discoverPackages(repo);
		const coreEntries = packages.filter((p) => p.name === '@scope/core');
		expect(coreEntries).toHaveLength(1);
	});

	it('throws if a package with docs claims the same name with different realpaths', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'scope' }), 'utf8');

		const pkgA = join(repo, 'packages', 'a');
		const pkgB = join(repo, 'packages', 'b');
		await mkdir(join(pkgA, 'docs', 'decisions'), { recursive: true });
		await mkdir(join(pkgB, 'docs', 'decisions'), { recursive: true });
		await writeFile(
			join(pkgA, 'package.json'),
			JSON.stringify({ name: '@scope/conflict' }),
			'utf8',
		);
		await writeFile(
			join(pkgB, 'package.json'),
			JSON.stringify({ name: '@scope/conflict' }),
			'utf8',
		);

		await expect(discoverPackages(repo)).rejects.toThrow(/Conflicting paths for package name/);
	});

	it('does not throw even if a third-party package without docs claims the same name with different realpaths', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'scope' }), 'utf8');

		// packages/a's node_modules/third-party (version 1)
		const pkgA = join(repo, 'packages', 'a');
		const thirdPartyA = join(pkgA, 'node_modules', 'third-party');
		await mkdir(thirdPartyA, { recursive: true });
		await writeFile(join(pkgA, 'package.json'), JSON.stringify({ name: '@scope/a' }), 'utf8');
		await writeFile(
			join(thirdPartyA, 'package.json'),
			JSON.stringify({ name: 'third-party', version: '1.0.0' }),
			'utf8',
		);

		// packages/b's node_modules/third-party (version 2)
		const pkgB = join(repo, 'packages', 'b');
		const thirdPartyB = join(pkgB, 'node_modules', 'third-party');
		await mkdir(thirdPartyB, { recursive: true });
		await writeFile(join(pkgB, 'package.json'), JSON.stringify({ name: '@scope/b' }), 'utf8');
		await writeFile(
			join(thirdPartyB, 'package.json'),
			JSON.stringify({ name: 'third-party', version: '2.0.0' }),
			'utf8',
		);

		// Succeeds without throwing because it has no docs directory
		const packages = await discoverPackages(repo);
		const thirdPartyEntries = packages.filter((p) => p.name === 'third-party');
		expect(thirdPartyEntries).toHaveLength(1);
	});
});
