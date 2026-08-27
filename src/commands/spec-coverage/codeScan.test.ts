import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractClauseRefsFromText, scanSourceCodeRefs } from './codeScan.ts';
import { DEFAULT_CLAUSE_ID_PATTERN } from './specClauses.ts';

const FIXTURES_DIR = 'fixtures/scan-test';

describe('codeScan', () => {
	it('K-CORE-ERR-002: extractClauseRefsFromText does not include known clause IDs in unknownRefs', async () => {
		const text = await readFile(join(FIXTURES_DIR, 'valid.ts'), 'utf8');
		const known = new Set(['K-CORE-MODEL-001', 'K-CORE-MODEL-002']);
		const res = extractClauseRefsFromText(text, 'src/foo.ts', known, DEFAULT_CLAUSE_ID_PATTERN);
		expect(res.unknownRefs).toHaveLength(0);
		expect(res.todoRefs).toHaveLength(0);
	});

	it('K-CORE-ERR-002: extractClauseRefsFromText detects unknown clause IDs', async () => {
		const text = await readFile(join(FIXTURES_DIR, 'dangling.ts'), 'utf8');
		const known = new Set(['K-CORE-MODEL-001']);
		const res = extractClauseRefsFromText(text, 'src/foo.ts', known, DEFAULT_CLAUSE_ID_PATTERN);
		expect(res.unknownRefs).toEqual([
			{ file: 'src/foo.ts', line: 1, id: ['K-TARGET-FCH-UI', '999'].join('-') },
			{ file: 'src/foo.ts', line: 2, id: ['K-TARGET-FCH-UI', '998'].join('-') },
		]);
	});

	it('K-CORE-ERR-002: Clause IDs in TODO(K-...) notation go into todoRefs instead of unknownRefs', async () => {
		const text = await readFile(join(FIXTURES_DIR, 'todo.ts'), 'utf8');
		const known = new Set(['K-CORE-MODEL-001']);
		const res = extractClauseRefsFromText(text, 'src/bar.ts', known, DEFAULT_CLAUSE_ID_PATTERN);
		expect(res.unknownRefs).toHaveLength(0);
		expect(res.todoRefs).toEqual([
			{ file: 'src/bar.ts', line: 1, id: ['K-TARGET-FCH-UI', '012'].join('-') },
		]);
	});

	it('K-CORE-ERR-002: Sorts correctly even when TODO(K-...) and plain unknown IDs are mixed on the same line', async () => {
		const text = await readFile(join(FIXTURES_DIR, 'mixed.ts'), 'utf8');
		const known = new Set(['K-CORE-MODEL-001']);
		const res = extractClauseRefsFromText(text, 'src/baz.ts', known, DEFAULT_CLAUSE_ID_PATTERN);
		expect(res.todoRefs).toEqual([
			{ file: 'src/baz.ts', line: 1, id: ['K-TARGET-FCH-UI', '012'].join('-') },
		]);
		expect(res.unknownRefs).toEqual([
			{ file: 'src/baz.ts', line: 1, id: ['K-TARGET-FCH-UI', '999'].join('-') },
		]);
	});

	it('K-CORE-ERR-002: scanSourceCodeRefs can detect intentional dangling references in the fixture directory', async () => {
		const known = new Set(['K-CORE-MODEL-001']);
		const res = await scanSourceCodeRefs(
			['fixtures/dangling-ref'],
			known,
			DEFAULT_CLAUSE_ID_PATTERN,
			['.ts'],
		);
		expect(res.unknownRefs).toEqual([
			{
				file: 'fixtures/dangling-ref/sample.ts',
				line: 1,
				id: ['K-TARGET-FCH-UI', '999'].join('-'),
			},
		]);
	});
});
