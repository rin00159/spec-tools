import type { ClauseInfo } from '@kata2/spec-coverage/src/specClauses.ts';
import { describe, expect, it } from 'vitest';
import { extractClauseBody, renderIndex, suggestIds } from './clause.ts';

const lines = [
	'# 見出し',
	'',
	'## K-CORE-DEF-001 単調精緻化',
	'',
	'**属性**: `status: active`',
	'',
	'### 下位見出し',
	'',
	'本文',
	'',
	'## K-CORE-DEF-002 次の条項',
	'',
	'次の本文',
];

function clause(overrides: Partial<ClauseInfo>): ClauseInfo {
	return {
		id: 'K-CORE-DEF-001',
		status: 'active',
		since: '0.1.0',
		kind: '規範',
		impl: { major: 0, minor: 1, phase: 1 },
		file: 'packages/core/docs/spec/10-core-model.md',
		line: 3,
		title: '単調精緻化',
		...overrides,
	};
}

describe('extractClauseBody', () => {
	it('次の `## ` 見出しの直前までを本文として返す', () => {
		const body = extractClauseBody(lines, 3);
		expect(body).toContain('## K-CORE-DEF-001 単調精緻化');
		expect(body).toContain('本文');
		expect(body).not.toContain('K-CORE-DEF-002');
	});

	it('`### ` の下位見出しは本文に含める(条項が途中で切れない)', () => {
		expect(extractClauseBody(lines, 3)).toContain('### 下位見出し');
	});

	it('最後の条項はファイル末尾までを本文とする', () => {
		const body = extractClauseBody(lines, 11);
		expect(body).toContain('次の本文');
	});
});

describe('suggestIds', () => {
	it('同じ AREA の条項を候補に出す', () => {
		expect(
			suggestIds(['K-CORE-TYPE', '999'].join('-'), ['K-CORE-TYPE-001', 'K-CORE-DEF-001']),
		).toEqual(['K-CORE-TYPE-001']);
	});

	it('AREA が一致しなければ前方一致で拾う', () => {
		expect(suggestIds(['K-CORE-XXXX', '001'].join('-'), ['K-CORE-TYPE-001'])).toEqual([
			'K-CORE-TYPE-001',
		]);
	});
});

describe('renderIndex', () => {
	it('生成物であることを先頭に明記する(C2)', () => {
		expect(renderIndex([clause({})])).toContain('手で編集しない');
	});

	it('ファイルごとに分け、条項を行番号順に並べる', () => {
		const output = renderIndex([
			clause({ id: 'K-CORE-DEF-002', line: 40 }),
			clause({ id: 'K-CORE-DEF-001', line: 10 }),
		]);
		expect(output.indexOf('K-CORE-DEF-001')).toBeLessThan(output.indexOf('K-CORE-DEF-002'));
	});

	it('withdrawn の件数を数える', () => {
		expect(
			renderIndex([clause({}), clause({ id: 'K-CORE-DEF-002', status: 'withdrawn' })]),
		).toContain('withdrawn 1件');
	});
});
