// Tests for generating task index (docs/task/INDEX.md).
// Source of truth: spec/00-conventions.md "scope's role and source of truth priority" / docs/decisions/110 Decision 4.
//
// It is intentional that there is no article ID in the test name (tools/ is outside the scope of Question 1).

import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverPackages } from './closure.ts';
import { planIndexes } from './indexGen.ts';

const _REPO_ROOT = resolve(import.meta.dirname, '../../..');

async function createFixtureRepo(): Promise<string> {
	// Resolves macOS /var -> /private/var (discoverPackages returns realpath).
	const repo = realpathSync(await mkdtemp(join(tmpdir(), 'scope-task-index-')));
	await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'scope' }), 'utf8');
	await writeFile(join(repo, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n', 'utf8');
	return repo;
}

async function writeTask(dir: string, name: string, body: string): Promise<void> {
	await mkdir(dir, { recursive: true });
	await writeFile(join(dir, name), body, 'utf8');
}

describe('planIndexes', () => {
	it('creates an index for each package that has actual docs, and does not include root stubs', async () => {
		const repo = await createFixtureRepo();
		await writeTask(
			join(repo, 'docs', 'task'),
			'046-moved.md',
			'# 046 Moved\n\n**Moved To**: `@scope/core:046`\n',
		);
		await writeTask(
			join(repo, 'docs', 'task'),
			'051-stays.md',
			'# 051 Remains in scope\n\n**State**: Not started\n',
		);
		const pkgDir = join(repo, 'packages', 'core');
		await mkdir(pkgDir, { recursive: true });
		await writeFile(join(pkgDir, 'package.json'), JSON.stringify({ name: '@scope/core' }), 'utf8');
		await writeTask(
			join(pkgDir, 'docs', 'task'),
			'046-moved.md',
			'# 046 Moved\n\n**State**: Not started\n',
		);

		const packages = await discoverPackages(repo);
		const { writes, removals } = planIndexes(repo, 'task', packages, {});

		expect(removals).toEqual([]);
		const paths = writes.map((w) => relative(repo, w.path)).sort();
		expect(paths).toEqual([
			join('docs', 'task', 'INDEX.md'),
			join('packages', 'core', 'docs', 'task', 'INDEX.md'),
		]);

		const root = writes.find((w) => w.path === join(repo, 'docs', 'task', 'INDEX.md'));
		expect(root?.content).toContain('051');
		// Root stubs are counted on the entity side. They do not appear in the root index.
		expect(root?.content).not.toContain('046');
		expect(root?.content).toContain('Do not edit manually');
	});

	it('indexes with 0 items become deletion targets', async () => {
		const repo = await createFixtureRepo();
		await writeTask(
			join(repo, 'docs', 'task'),
			'046-moved.md',
			'# 046 Moved\n\n**Moved To**: `@scope/core:046`\n',
		);
		// The root only has stubs. Creates a state where an old index remains.
		await writeFile(join(repo, 'docs', 'task', 'INDEX.md'), '# task Index — scope (1 item)\n', 'utf8');

		const packages = await discoverPackages(repo);
		const { writes, removals } = planIndexes(repo, 'task', packages, {});

		expect(writes).toEqual([]);
		expect(removals.map((p) => relative(repo, p))).toEqual([join('docs', 'task', 'INDEX.md')]);
	});
});
