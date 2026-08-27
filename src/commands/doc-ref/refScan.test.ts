// Tests for decisions / task reference existence check.
// The primary source is docs/decisions/109 Decision 4 and Decision 8 / scope:200 / docs/plan/0_3/phase7.md Completion Criterion 5.
//
// The omission of the clause ID in the test name is intentional (tools/ is out of scope for Question 1).

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractDocRefs, validateDocRefsInRepo } from './refScan.ts';

const _REPO_ROOT = resolve(import.meta.dirname, '../../..');

async function createFixtureRepo(): Promise<string> {
	return await mkdtemp(join(tmpdir(), 'scope-ref-scan-'));
}

describe('extractDocRefs', () => {
	it('extracts both legacy and namespaced references', () => {
		const text = `
# Some Title
Reference: docs/decisions/035 and decisions/086
task: docs/task/018
New format: @scope/targetlib-firebase:100 and @scope/targetlib-react:200
Root: scope:200
Duplicate: docs/decisions/035
`;
		const refs = extractDocRefs(
			text,
			'docs/decisions',
			'docs/task',
			'(@scope\\/[a-z0-9_-]+|scope)',
		);
		expect(refs).toEqual([
			{ raw: 'docs/decisions/035', type: 'decision', ref: '035', line: 3 },
			{ raw: 'decisions/086', type: 'decision', ref: '086', line: 3 },
			{ raw: 'docs/task/018', type: 'task', ref: '018', line: 4 },
			{
				raw: '@scope/targetlib-firebase:100',
				type: 'namespaced',
				ref: '@scope/targetlib-firebase:100',
				line: 5,
			},
			{
				raw: '@scope/targetlib-react:200',
				type: 'namespaced',
				ref: '@scope/targetlib-react:200',
				line: 5,
			},
			{ raw: 'scope:200', type: 'namespaced', ref: 'scope:200', line: 6 },
		]);
	});
});

describe('validateDocRefsInRepo (fixture)', () => {
	it('throws as a miss if there are 0 files to scan', async () => {
		const repo = await mkdtemp(join(tmpdir(), 'spec-tools-'));
		await expect(
			validateDocRefsInRepo(repo, { scanRoots: ['docs'], rootFiles: [] }),
		).rejects.toThrow(/No markdown files found/);
	});

	it('throws as a miss if there are 0 scanned references', async () => {
		const repo = await mkdtemp(join(tmpdir(), 'spec-tools-'));
		const docs = join(repo, 'docs');
		await mkdir(docs);
		await writeFile(join(docs, 'empty.md'), '# empty\n', 'utf8');
		await expect(
			validateDocRefsInRepo(repo, { scanRoots: ['docs'], rootFiles: [] }),
		).rejects.toThrow(/No references found/);
	});

	it('reports non-existent legacy and namespaced references as violations', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'scope' }), 'utf8');
		const docsDir = join(repo, 'docs');
		await mkdir(join(docsDir, 'decisions'), { recursive: true });
		await writeFile(join(docsDir, 'decisions', '001-initial.md'), '# 001 Initial\n', 'utf8');

		await mkdir(join(docsDir, 'task'), { recursive: true });
		await writeFile(
			join(docsDir, 'task', '018-moved.md'),
			'# 018 Moved\n\nBody is at the destination (no references written in fixture).\n',
			'utf8',
		);

		await writeFile(
			join(docsDir, 'test.md'),
			`
# Test Doc
Exists: docs/decisions/001
Non-existent legacy: docs/decisions/999
Task exists as stub: docs/task/018
Non-existent task: docs/task/998
Non-existent namespace: @scope/unknown:200
`,
			'utf8',
		);

		const result = await validateDocRefsInRepo(repo, {
			scanRoots: ['docs'],
			rootFiles: [],
		});
		expect(result.totalRefs).toBe(5);
		expect(result.violations.length).toBe(3);
		expect(result.violations[0]).toContain('999');
		expect(result.violations[1]).toContain('docs/task/998');
		expect(result.violations[2]).toContain('@scope/unknown:200');
	});

	it('returns empty violations if only valid references exist', async () => {
		const repo = await createFixtureRepo();
		await writeFile(join(repo, 'package.json'), JSON.stringify({ name: 'scope' }), 'utf8');
		const docsDir = join(repo, 'docs');
		await mkdir(join(docsDir, 'decisions'), { recursive: true });
		await writeFile(join(docsDir, 'decisions', '001-initial.md'), '# 001 Initial\n', 'utf8');

		const pkgDir = join(repo, 'packages', 'core');
		await mkdir(join(pkgDir, 'docs', 'decisions'), { recursive: true });
		await writeFile(join(pkgDir, 'package.json'), JSON.stringify({ name: '@scope/core' }), 'utf8');
		await writeFile(
			join(pkgDir, 'docs', 'decisions', '200-core-rule.md'),
			'# 200 Core Rule\n',
			'utf8',
		);

		await writeFile(
			join(docsDir, 'test.md'),
			`
# Test Doc
Exists legacy: docs/decisions/001
Exists namespaced: @scope/core:200
`,
			'utf8',
		);

		const result = await validateDocRefsInRepo(repo, {
			scanRoots: ['docs'],
			rootFiles: [],
		});
		expect(result.totalRefs).toBe(2);
		expect(result.violations).toEqual([]);
	});
});
