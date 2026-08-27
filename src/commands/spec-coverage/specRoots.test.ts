// Inspection of clause file scanning root discovery and parsing.
// The original is spec/00-conventions.md "Clause file location and scanning root".
//
// The test name does not contain the clause ID on purpose (tools/ is not subject to question 1.
// 00-conventions.md "Range where leading ID is mandatory").

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSpecClauses } from './specClauses.ts';
import { discoverSpecRoots } from './specRoots.ts';

async function createFixtureRepo(): Promise<string> {
	return await mkdtemp(join(tmpdir(), 'scope-spec-roots-'));
}

const VALID_ATTR_LINE =
	'**Attributes**: `status: active` / `since: 0.1.0` / `kind: normative` / `impl: v0_1_1`';

describe('discoverSpecRoots (T1-T4)', () => {
	it('T1: A fixture with spec/, packages/a/docs/spec, and packages/b/docs/spec returns 3 roots in ascending order', async () => {
		const repo = await createFixtureRepo();
		const rootSpec = join(repo, 'spec');
		const pkgASpec = join(repo, 'packages', 'a', 'docs', 'spec');
		const pkgBSpec = join(repo, 'packages', 'b', 'docs', 'spec');

		await mkdir(rootSpec, { recursive: true });
		await mkdir(pkgASpec, { recursive: true });
		await mkdir(pkgBSpec, { recursive: true });

		const expected = [pkgASpec, pkgBSpec, rootSpec].sort();
		const actual = await discoverSpecRoots(repo);
		expect(actual).toEqual(expected);
	});

	it('T2: Adding packages/c/docs/spec to the T1 fixture makes it 4 roots without changing the inspection side', async () => {
		const repo = await createFixtureRepo();
		const rootSpec = join(repo, 'spec');
		const pkgASpec = join(repo, 'packages', 'a', 'docs', 'spec');
		const pkgBSpec = join(repo, 'packages', 'b', 'docs', 'spec');
		const pkgCSpec = join(repo, 'packages', 'c', 'docs', 'spec');

		await mkdir(rootSpec, { recursive: true });
		await mkdir(pkgASpec, { recursive: true });
		await mkdir(pkgBSpec, { recursive: true });
		await mkdir(pkgCSpec, { recursive: true });

		const expected = [pkgASpec, pkgBSpec, pkgCSpec, rootSpec].sort();
		const actual = await discoverSpecRoots(repo);
		expect(actual).toEqual(expected);
	});

	it('T3: Does not pick up packages/x/spec (without docs) or packages/x/docs/spec.md (file)', async () => {
		const repo = await createFixtureRepo();
		const rootSpec = join(repo, 'spec');
		const invalidPkg1 = join(repo, 'packages', 'x', 'spec');
		const invalidPkg2Docs = join(repo, 'packages', 'y', 'docs');
		const invalidPkg2File = join(invalidPkg2Docs, 'spec.md');

		await mkdir(rootSpec, { recursive: true });
		await mkdir(invalidPkg1, { recursive: true });
		await mkdir(invalidPkg2Docs, { recursive: true });
		await writeFile(invalidPkg2File, '# not a dir', 'utf8');

		const actual = await discoverSpecRoots(repo);
		expect(actual).toEqual([rootSpec]);
	});

	it('T4: A fixture with zero roots throws (prevent false positives)', async () => {
		const repo = await createFixtureRepo();
		await expect(discoverSpecRoots(repo)).rejects.toThrow(/No spec root directories found/);
	});
});

describe('parseSpecClauses (T5-T7)', () => {
	it('T5: A fixture with a root but 0 clauses throws', async () => {
		const rootSpec = await mkdtemp(join(tmpdir(), 'spec-tools-'));
		await writeFile(join(rootSpec, 'README.md'), '# no clauses here', 'utf8');

		await expect(parseSpecClauses([rootSpec])).rejects.toThrow(/No spec clauses found/);
	});

	it('T6: A fixture where 2 files in different roots have the same clause ID as a heading throws, and both file paths appear in the message', async () => {
		const repo = await createFixtureRepo();
		const rootSpec = join(repo, 'spec');
		const pkgSpec = join(repo, 'packages', 'a', 'docs', 'spec');
		await mkdir(rootSpec, { recursive: true });
		await mkdir(pkgSpec, { recursive: true });

		const file1 = join(rootSpec, '10-model.md');
		const file2 = join(pkgSpec, '10-model.md');

		await writeFile(file1, `## K-CORE-MODEL-001 Entity\n\n${VALID_ATTR_LINE}\n\nBody1`, 'utf8');
		await writeFile(file2, `## K-CORE-MODEL-001 Entity\n\n${VALID_ATTR_LINE}\n\nBody2`, 'utf8');

		await expect(parseSpecClauses([rootSpec, pkgSpec])).rejects.toThrowError(
			new RegExp(`K-CORE-MODEL-001.*${file1}.*${file2}|K-CORE-MODEL-001.*${file2}.*${file1}`),
		);
	});

	it('T7: Duplicates within the same root still throw (regression)', async () => {
		const repo = await createFixtureRepo();
		const rootSpec = join(repo, 'spec');
		await mkdir(rootSpec, { recursive: true });

		const file1 = join(rootSpec, 'a.md');
		const file2 = join(rootSpec, 'b.md');

		await writeFile(file1, `## K-CORE-MODEL-001 Entity\n\n${VALID_ATTR_LINE}\n\nBody1`, 'utf8');
		await writeFile(file2, `## K-CORE-MODEL-001 Duplicate\n\n${VALID_ATTR_LINE}\n\nBody2`, 'utf8');

		await expect(parseSpecClauses([rootSpec])).rejects.toThrow(/K-CORE-MODEL-001/);
	});
});
