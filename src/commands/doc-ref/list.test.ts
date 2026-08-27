// Tests for the task / decisions list.
// The primary source is docs/decisions/109 Decision 8 / docs/plan/0_3/done/phase8.md R3.
//
// The omission of the clause ID in the test name is intentional (tools/ is out of scope for Question 1).

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { discoverPackages } from './closure.ts';
import { collectDocs } from './list.ts';

const _REPO_ROOT = resolve(import.meta.dirname, '../../..');

async function createFixtureRepo(): Promise<string> {
	const repo = await mkdtemp(join(tmpdir(), 'scope-doc-list-'));
	await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'scope' }), 'utf8');
	await writeFile(join(repo, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n', 'utf8');
	return repo;
}

describe('collectDocs', () => {
	it('collapses root stubs into their concrete implementations and does not double-count', async () => {
		const repo = await createFixtureRepo();
		const rootTask = join(repo, 'docs', 'task');
		await mkdir(rootTask, { recursive: true });
		await writeFile(
			join(rootTask, '046-moved.md'),
			'# 046 Moved\n\n**Moved To**: `@scope/core:046`\n',
			'utf8',
		);
		await writeFile(
			join(rootTask, '051-stays.md'),
			'# 051 Stays in scope\n\n**State**: Not Started\n',
			'utf8',
		);

		const pkgDir = join(repo, 'packages', 'core');
		await mkdir(join(pkgDir, 'docs', 'task'), { recursive: true });
		await writeFile(join(pkgDir, 'package.json'), JSON.stringify({ name: '@scope/core' }), 'utf8');
		await writeFile(
			join(pkgDir, 'docs', 'task', '046-moved.md'),
			'# 046 Moved\n\n**State**: Not Started\n',
			'utf8',
		);

		const packages = await discoverPackages(repo);
		const entries = collectDocs(repo, 'task', packages);

		expect(entries.map((e) => e.reference).sort()).toEqual(['051', '@scope/core:046']);
		expect(entries.filter((e) => e.number === '046')).toHaveLength(1);
	});

	it('outputs references with bare numbers for root legacy, and with namespaces for package implementations', async () => {
		const repo = await createFixtureRepo();
		const rootTask = join(repo, 'docs', 'task');
		await mkdir(rootTask, { recursive: true });
		await writeFile(join(rootTask, '051-stays.md'), '# 051 legacy\n', 'utf8');
		await writeFile(join(rootTask, '201-native.md'), '# 201 native\n', 'utf8');

		const packages = await discoverPackages(repo);
		const entries = collectDocs(repo, 'task', packages);

		expect(entries.map((e) => e.reference).sort()).toEqual(['051', 'scope:201']);
	});
});
