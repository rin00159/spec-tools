// Test for --package specification and numbering in scaffold.
// The source of truth is docs/decisions/109 decision 4 / docs/plan/0_3/phase5.md completion criteria 11.
//
// Clause IDs are not placed in test names intentionally (tools/ is excluded from Question 1).

import { mkdir, mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { nextNumber, numberedFileName } from './naming.ts';

async function createFixtureRepo(): Promise<string> {
	return await mkdtemp(join(tmpdir(), 'scope-scaffold-test-'));
}

describe('scaffold --package numbering', () => {
	it('decisions directory in a new package starts from 200', async () => {
		const repo = await createFixtureRepo();
		const pkgDir = join(repo, 'packages', 'core', 'docs', 'decisions');
		await mkdir(pkgDir, { recursive: true });

		const entries = await readdir(pkgDir);
		const num = nextNumber(entries);
		expect(num).toBe(200);

		const fileName = numberedFileName(num, 'sample-decision');
		expect(fileName).toBe('200-sample-decision.md');
	});

	it('201 is numbered in a package with an existing decision (200)', async () => {
		const repo = await createFixtureRepo();
		const pkgDir = join(repo, 'packages', 'schemaui', 'docs', 'decisions');
		await mkdir(pkgDir, { recursive: true });
		await writeFile(join(pkgDir, '200-initial.md'), '# 200', 'utf8');

		const entries = await readdir(pkgDir);
		const num = nextNumber(entries);
		expect(num).toBe(201);
	});

	it('decisions in root (scope) is numbered 200 as the next of legacy 110', async () => {
		const entries = ['001-first.md', '110-last-legacy.md', 'README.md'];
		const num = nextNumber(entries);
		expect(num).toBe(200);
	});

	it('task in root (scope) is numbered 200 as the next of legacy 063', async () => {
		const entries = ['001-first.md', '063-last-legacy.md', 'README.md'];
		const num = nextNumber(entries);
		expect(num).toBe(200);
	});
});
