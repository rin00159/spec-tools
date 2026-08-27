import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractClauseRefsFromText, scanSourceCodeRefs } from './codeScan.ts';
import { DEFAULT_CLAUSE_ID_PATTERN } from './specClauses.ts';

const FIXTURES_DIR = 'fixtures/scan-test';

describe('codeScan', () => {
	it('K-CORE-ERR-002: extractClauseRefsFromText は既知の条項 ID を unknownRefs に含めない', async () => {
		const text = await readFile(join(FIXTURES_DIR, 'valid.ts'), 'utf8');
		const known = new Set(['K-CORE-MODEL-001', 'K-CORE-MODEL-002']);
		const res = extractClauseRefsFromText(text, 'src/foo.ts', known, DEFAULT_CLAUSE_ID_PATTERN);
		expect(res.unknownRefs).toHaveLength(0);
		expect(res.todoRefs).toHaveLength(0);
	});

	it('K-CORE-ERR-002: extractClauseRefsFromText は未知の条項 ID を検出する', async () => {
		const text = await readFile(join(FIXTURES_DIR, 'dangling.ts'), 'utf8');
		const known = new Set(['K-CORE-MODEL-001']);
		const res = extractClauseRefsFromText(text, 'src/foo.ts', known, DEFAULT_CLAUSE_ID_PATTERN);
		expect(res.unknownRefs).toEqual([
			{ file: 'src/foo.ts', line: 1, id: ['K-TARGET-FCH-UI', '999'].join('-') },
			{ file: 'src/foo.ts', line: 2, id: ['K-TARGET-FCH-UI', '998'].join('-') },
		]);
	});

	it('K-CORE-ERR-002: TODO(K-...) 記法の条項 ID は unknownRefs ではなく todoRefs に入る', async () => {
		const text = await readFile(join(FIXTURES_DIR, 'todo.ts'), 'utf8');
		const known = new Set(['K-CORE-MODEL-001']);
		const res = extractClauseRefsFromText(text, 'src/bar.ts', known, DEFAULT_CLAUSE_ID_PATTERN);
		expect(res.unknownRefs).toHaveLength(0);
		expect(res.todoRefs).toEqual([
			{ file: 'src/bar.ts', line: 1, id: ['K-TARGET-FCH-UI', '012'].join('-') },
		]);
	});

	it('K-CORE-ERR-002: 同一行に TODO(K-...) と素の未知 ID が混在する場合も正しく仕分ける', async () => {
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

	it('K-CORE-ERR-002: scanSourceCodeRefs は fixture ディレクトリ内の意図的な dangling 参照を検出できる', async () => {
		const known = new Set(['K-CORE-MODEL-001']);
		const res = await scanSourceCodeRefs(
			['fixtures/dangling-ref'],
			known,
			DEFAULT_CLAUSE_ID_PATTERN,
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
